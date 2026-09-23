// Kalenderabgleich mit myTischtennis (Aufgabe 3.3).
//
// Läuft nachts per Cron über alle Mannschaften mit hinterlegter Kalenderadresse und auf
// Zuruf aus dem Import-Dialog für eine einzelne Mannschaft.
//
// Die eigentliche Entscheidung — was ist neu, was verlegt, was entfallen — trifft
// `planSync` in `_shared/syncPlanner.ts`. Die Funktion hier holt nur die Daten, führt den
// Plan aus und schreibt das Protokoll. Diese Trennung ist der Grund, warum der heikelste
// Teil des Imports vollständig ohne Datenbank getestet werden kann.

import { authorize, corsHeaders, environment, json, readBody, type SupabaseClient } from '../_shared/http.ts';
import { isSafeFeedUrl } from '../_shared/guards.ts';
import { parseIcs, extractMatchday } from '../_shared/ics.ts';
import { determineHomeAway } from '../_shared/homeAway.ts';
import { planSync, type ExistingMatch, type SyncAction } from '../_shared/syncPlanner.ts';

/** Länger wartet der Abgleich nicht auf einen Verbandskalender. */
const FETCH_TIMEOUT_MS = 20_000;

/** Ein Saisonkalender hat einige Dutzend Kilobyte. Alles über 5 MB ist kein Spielplan. */
const MAX_FEED_BYTES = 5 * 1024 * 1024;

interface SyncRequest {
  teamId?: string;
}

interface TeamRow {
  id: string;
  name: string;
  webcal_url: string | null;
  sync_enabled: boolean;
  active: boolean;
}

interface TeamResult {
  team: string;
  status: 'success' | 'warning' | 'failed';
  inserted: number;
  rescheduled: number;
  updated: number;
  deactivated: number;
  message?: string;
  /** Wie viele Schreibvorgänge in der Datenbank gescheitert sind. */
  writeErrors?: number;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders('POST') });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const env = environment();
  if (!env) return json({ error: 'not_configured' }, 500);
  const { admin } = env;

  // Cron-Secret für den nächtlichen Lauf, sonst Admin oder Mannschaftsführer aus dem
  // Import-Dialog.
  if (!(await authorize(request, env, ['admin', 'team_leader']))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const body = await readBody<SyncRequest>(request);

  // Der Lauf wird protokolliert, bevor er beginnt. Bricht die Funktion ab, bleibt ein
  // `pending`-Eintrag stehen — das ist als Fehlerbild brauchbarer als gar nichts.
  const { data: run } = await admin.from('sync_runs').insert({ status: 'pending' }).select('id').single();
  const runId = run?.id as string | undefined;

  const aliases = await loadAliases(admin);

  let query = admin
    .from('teams')
    .select('id, name, webcal_url, sync_enabled, active')
    .eq('active', true)
    .eq('sync_enabled', true)
    .not('webcal_url', 'is', null);

  if (typeof body.teamId === 'string' && body.teamId) query = query.eq('id', body.teamId);

  const { data: teams, error: teamsError } = await query;

  if (teamsError) {
    await finish(admin, runId, 'failed', { error: teamsError.message });
    return json({ error: 'teams_unavailable', detail: teamsError.message }, 500);
  }

  const results: TeamResult[] = [];

  for (const team of (teams ?? []) as TeamRow[]) {
    results.push(await syncTeam(admin, team, aliases));
  }

  const status: 'success' | 'warning' | 'failed' = results.some((r) => r.status === 'failed')
    ? 'failed'
    : results.some((r) => r.status === 'warning')
      ? 'warning'
      : 'success';

  await finish(admin, runId, status, { teams: results });

  return json({ status, teams: results });
});

async function loadAliases(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin
    .from('club_settings')
    .select('key, value')
    .in('key', ['club_name', 'club_short_name', 'club_aliases']);

  const settings = Object.fromEntries(
    ((data ?? []) as { key: string; value: string }[]).map((row) => [row.key, row.value]),
  );

  return [
    settings.club_name ?? '',
    settings.club_short_name ?? '',
    ...(settings.club_aliases ?? '').split(','),
  ]
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function syncTeam(
  admin: SupabaseClient,
  team: TeamRow,
  aliases: string[],
): Promise<TeamResult> {
  const empty: TeamResult = {
    team: team.name,
    status: 'success',
    inserted: 0,
    rescheduled: 0,
    updated: 0,
    deactivated: 0,
  };

  let icsText: string;
  try {
    // webcal:// ist http(s) mit anderem Namen; fetch kennt das Schema nicht.
    const url = (team.webcal_url ?? '').trim().replace(/^webcal:\/\//i, 'https://');
    if (!isSafeFeedUrl(url)) {
      return {
        ...empty,
        status: 'failed',
        message: 'Die Kalenderadresse muss mit https:// oder webcal:// beginnen und auf einen öffentlichen Server zeigen.',
      };
    }

    const response = await fetch(url, {
      headers: { Accept: 'text/calendar' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ...empty, status: 'failed', message: `HTTP ${response.status}` };
    }
    if (!isSafeFeedUrl(response.url || url)) {
      return { ...empty, status: 'failed', message: 'Der Kalender leitet auf eine unzulässige Adresse um.' };
    }
    icsText = await readLimited(response, MAX_FEED_BYTES);
  } catch (error) {
    return {
      ...empty,
      status: 'failed',
      message: error instanceof Error ? error.message : 'Kalender nicht erreichbar',
    };
  }

  let events;
  try {
    events = parseIcs(icsText);
  } catch (error) {
    return {
      ...empty,
      status: 'failed',
      message: error instanceof Error ? error.message : 'Kalender nicht lesbar',
    };
  }

  const { data: existingRows, error: existingError } = await admin
    .from('matches')
    .select(
      'id, external_uid, dtstart, dtend, summary, description, location_text, opponent, is_home, matchday, active, version, dtstart_override',
    )
    .eq('team_id', team.id)
    .not('external_uid', 'is', null);

  if (existingError) {
    return { ...empty, status: 'failed', message: existingError.message };
  }

  const plan = planSync({
    existing: (existingRows ?? []) as ExistingMatch[],
    events,
    resolve: (event) => {
      const info = determineHomeAway(event.summary, team.name, aliases);
      return {
        isHome: info.isHome,
        opponent: info.opponent,
        matchday: extractMatchday(event.description, event.summary),
      };
    },
  });

  const counts = { inserted: 0, rescheduled: 0, updated: 0, deactivated: 0, writeErrors: 0 };

  for (const action of plan.actions) {
    await applyAction(admin, team.id, action, counts);
  }

  // Ein Plan, der sich nicht vollständig schreiben ließ, ist kein Erfolg — auch wenn der
  // Kalender selbst in Ordnung war.
  const status = counts.writeErrors > 0 ? 'failed' : plan.status;
  const message =
    counts.writeErrors > 0
      ? `${counts.writeErrors} Änderung(en) ließen sich nicht speichern.${plan.warning ? ` ${plan.warning}` : ''}`
      : plan.warning;

  return { ...empty, ...counts, status, message };
}

async function applyAction(
  admin: SupabaseClient,
  teamId: string,
  action: SyncAction,
  counts: { inserted: number; rescheduled: number; updated: number; deactivated: number; writeErrors: number },
): Promise<void> {
  const now = new Date().toISOString();

  /** Schreibt, zählt Fehler und sagt, ob es geklappt hat. */
  const ok = (result: { error: { message: string } | null }, what: string): boolean => {
    if (!result.error) return true;
    console.error(`${what}:`, result.error.message);
    counts.writeErrors += 1;
    return false;
  };

  if (action.kind === 'insert') {
    const inserted = await admin.from('matches').insert({
      team_id: teamId,
      source: 'ics',
      external_uid: action.match.external_uid,
      summary: action.match.summary,
      opponent: action.match.opponent,
      description: action.match.description,
      location_text: action.match.location_text,
      is_home: action.match.is_home,
      dtstart_external: action.match.dtstart,
      dtend_external: action.match.dtend,
      matchday: action.match.matchday,
      last_synced_at: now,
    });
    if (ok(inserted, 'insert')) counts.inserted += 1;
    return;
  }

  if (action.kind === 'reschedule') {
    // Die Fassung steigt: alle bisherigen Zusagen gelten damit nicht mehr, ohne dass eine
    // einzige Zeile gelöscht wird. Wer zugesagt hatte, wird erneut gefragt.
    const updated = await admin
      .from('matches')
      .update({
        // Die UID wird mitgeschrieben: Feeds, die sie je Export neu vergeben, würden das
        // Spiel sonst beim nächsten Lauf erneut als unbekannt sehen. Siehe `matchFingerprint`.
        external_uid: action.match.external_uid,
        dtstart_external: action.match.dtstart,
        dtend_external: action.match.dtend,
        summary: action.match.summary,
        opponent: action.match.opponent,
        description: action.match.description,
        location_text: action.match.location_text,
        is_home: action.match.is_home,
        matchday: action.match.matchday,
        version: action.newVersion,
        active: true,
        last_synced_at: now,
      })
      .eq('id', action.id);
    if (!ok(updated, 'reschedule')) return;

    ok(
      await admin.from('match_changes').insert({
        match_id: action.id,
        change_type: 'sync_reschedule',
        old_value: { dtstart: action.fromDtstart },
        new_value: { dtstart: action.match.dtstart },
      }),
      'match_changes',
    );

    counts.rescheduled += 1;
    return;
  }

  if (action.kind === 'update_details') {
    const updated = await admin
      .from('matches')
      .update({
        external_uid: action.match.external_uid,
        summary: action.match.summary,
        opponent: action.match.opponent,
        description: action.match.description,
        location_text: action.match.location_text,
        is_home: action.match.is_home,
        matchday: action.match.matchday,
        active: true,
        last_synced_at: now,
      })
      .eq('id', action.id);
    if (ok(updated, 'update_details')) counts.updated += 1;
    return;
  }

  if (action.kind === 'clear_override') {
    const updated = await admin
      .from('matches')
      .update({
        external_uid: action.uid,
        dtstart_override: null,
        dtend_override: null,
        last_synced_at: now,
      })
      .eq('id', action.id);
    if (!ok(updated, 'clear_override')) return;

    ok(
      await admin.from('match_changes').insert({
        match_id: action.id,
        change_type: 'sync_override_cleared',
        new_value: { reason: 'Der Verband hat die Verlegung übernommen.' },
      }),
      'match_changes',
    );

    counts.updated += 1;
    return;
  }

  if (action.kind === 'deactivate') {
    const updated = await admin
      .from('matches')
      .update({
        active: false,
        cancel_reason: 'Im Verbandskalender nicht mehr enthalten',
        last_synced_at: now,
      })
      .eq('id', action.id);
    if (!ok(updated, 'deactivate')) return;

    ok(
      await admin.from('match_changes').insert({
        match_id: action.id,
        change_type: 'sync_deactivated',
        new_value: { reason: 'Im Verbandskalender nicht mehr enthalten' },
      }),
      'match_changes',
    );

    counts.deactivated += 1;
    return;
  }

  // touch — unverändert, aber die UID kann trotzdem eine neue sein.
  ok(
    await admin
      .from('matches')
      .update({ external_uid: action.uid, last_synced_at: now })
      .eq('id', action.id),
    'touch',
  );
}

/** Den Body lesen, aber nicht mehr als `limit` Bytes — ein riesiger Feed sprengte sonst den Speicher. */
async function readLimited(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > limit) throw new Error('Der Kalender ist zu groß.');

  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error('Der Kalender ist zu groß.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function finish(
  admin: SupabaseClient,
  runId: string | undefined,
  status: 'success' | 'warning' | 'failed',
  summary: unknown,
): Promise<void> {
  if (!runId) return;
  await admin
    .from('sync_runs')
    .update({ status, summary, completed_at: new Date().toISOString() })
    .eq('id', runId);
}
