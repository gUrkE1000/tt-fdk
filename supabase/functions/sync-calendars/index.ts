// Kalenderabgleich mit myTischtennis (Aufgabe 3.3).
//
// Läuft nachts per Cron über alle Mannschaften mit hinterlegter Kalenderadresse und auf
// Zuruf aus dem Import-Dialog für eine einzelne Mannschaft.
//
// Die eigentliche Entscheidung — was ist neu, was verlegt, was entfallen — trifft
// `planSync` in `_shared/syncPlanner.ts`. Die Funktion hier holt nur die Daten, führt den
// Plan aus und schreibt das Protokoll. Diese Trennung ist der Grund, warum der heikelste
// Teil des Imports vollständig ohne Datenbank getestet werden kann.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseIcs, extractMatchday } from '../_shared/ics.ts';
import { determineHomeAway } from '../_shared/homeAway.ts';
import { planSync, type ExistingMatch, type SyncAction } from '../_shared/syncPlanner.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'not_configured' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const allowed = await authorize(request, admin, supabaseUrl, anonKey);
  if (!allowed) return json({ error: 'unauthorized' }, 401);

  let body: SyncRequest = {};
  try {
    if (request.headers.get('content-length') !== '0') {
      body = (await request.json()) as SyncRequest;
    }
  } catch {
    body = {};
  }

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

  if (body.teamId) query = query.eq('id', body.teamId);

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

/**
 * Zwei Wege herein: das Cron-Secret aus `private.cron_config` für den nächtlichen Lauf,
 * oder das Token eines Admins beziehungsweise Mannschaftsführers aus dem Import-Dialog.
 */
async function authorize(
  request: Request,
  admin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string,
): Promise<boolean> {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret) {
    const { data } = await admin
      .schema('private')
      .from('cron_config')
      .select('value')
      .eq('key', 'cron_secret')
      .maybeSingle();

    const expected = (data as { value?: string } | null)?.value;
    // Länge und Inhalt müssen stimmen; ein leer konfiguriertes Secret öffnet nichts.
    return Boolean(expected) && cronSecret === expected;
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: user } = await caller.auth.getUser();
  if (!user?.user) return false;

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status, deleted_at')
    .eq('id', user.user.id)
    .maybeSingle();

  const row = profile as { role?: string; status?: string; deleted_at?: string | null } | null;
  return (
    row?.status === 'active' &&
    !row.deleted_at &&
    (row.role === 'admin' || row.role === 'team_leader')
  );
}

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
    const url = (team.webcal_url ?? '').replace(/^webcal:\/\//i, 'https://');
    const response = await fetch(url, { headers: { Accept: 'text/calendar' } });
    if (!response.ok) {
      return { ...empty, status: 'failed', message: `HTTP ${response.status}` };
    }
    icsText = await response.text();
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

  const counts = { inserted: 0, rescheduled: 0, updated: 0, deactivated: 0 };

  for (const action of plan.actions) {
    await applyAction(admin, team.id, action, counts);
  }

  return {
    ...empty,
    ...counts,
    status: plan.status,
    message: plan.warning,
  };
}

async function applyAction(
  admin: SupabaseClient,
  teamId: string,
  action: SyncAction,
  counts: { inserted: number; rescheduled: number; updated: number; deactivated: number },
): Promise<void> {
  const now = new Date().toISOString();

  if (action.kind === 'insert') {
    await admin.from('matches').insert({
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
    counts.inserted += 1;
    return;
  }

  if (action.kind === 'reschedule') {
    // Die Fassung steigt: alle bisherigen Zusagen gelten damit nicht mehr, ohne dass eine
    // einzige Zeile gelöscht wird. Wer zugesagt hatte, wird erneut gefragt.
    await admin
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

    await admin.from('match_changes').insert({
      match_id: action.id,
      change_type: 'sync_reschedule',
      old_value: { dtstart: action.fromDtstart },
      new_value: { dtstart: action.match.dtstart },
    });

    counts.rescheduled += 1;
    return;
  }

  if (action.kind === 'update_details') {
    await admin
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
    counts.updated += 1;
    return;
  }

  if (action.kind === 'clear_override') {
    await admin
      .from('matches')
      .update({
        external_uid: action.uid,
        dtstart_override: null,
        dtend_override: null,
        last_synced_at: now,
      })
      .eq('id', action.id);

    await admin.from('match_changes').insert({
      match_id: action.id,
      change_type: 'sync_override_cleared',
      new_value: { reason: 'Der Verband hat die Verlegung übernommen.' },
    });

    counts.updated += 1;
    return;
  }

  if (action.kind === 'deactivate') {
    await admin
      .from('matches')
      .update({
        active: false,
        cancel_reason: 'Im Verbandskalender nicht mehr enthalten',
        last_synced_at: now,
      })
      .eq('id', action.id);

    await admin.from('match_changes').insert({
      match_id: action.id,
      change_type: 'sync_deactivated',
      new_value: { reason: 'Im Verbandskalender nicht mehr enthalten' },
    });

    counts.deactivated += 1;
    return;
  }

  // touch — unverändert, aber die UID kann trotzdem eine neue sein.
  await admin
    .from('matches')
    .update({ external_uid: action.uid, last_synced_at: now })
    .eq('id', action.id);
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
