// Ersatzkette ausführen (Aufgabe 5.3).
//
// Zwei Wege hierher: alle zehn Minuten per Cron für die Fristen, und sofort nach jeder
// Absage. Das Sofortige ist der wichtigere Fall — wer freitags absagt, soll nicht bis
// zum nächsten Zehnminutentakt warten, bis der Ersatz gefragt wird.
//
// Was zu tun ist, entscheidet `_shared/substituteEngine.ts`. Hier steht das Laden, das
// Ausführen und das Benachrichtigen.

import { authorize, corsHeaders, environment, json, readBody, type SupabaseClient } from '../_shared/http.ts';
import { berlinToday } from '../_shared/guards.ts';
import {
  planSubstituteStep,
  type EngineAbsence,
  type EngineAction,
  type EngineCandidate,
  type EngineInput,
  type EngineParticipation,
  type EngineRequest,
  type SubstituteMode,
} from '../_shared/substituteEngine.ts';

/** Weiter voraus lohnt der Aufwand nicht; Absagen kommen selten drei Wochen vorher. */
const HORIZON_DAYS = 21;

interface MatchRow {
  id: string;
  team_id: string;
  version: number;
  dtstart: string;
  active: boolean;
  required_players: number;
  lineup_locked: boolean;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders('POST') });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const env = environment();
  if (!env) return json({ error: 'not_configured' }, 500);
  const { admin } = env;

  if (!(await authorize(request, env, ['admin', 'team_leader']))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const body = await readBody<{ matchId: string }>(request);

  const now = new Date();
  const matches = await loadMatches(admin, now, typeof body.matchId === 'string' ? body.matchId : undefined);

  const summary = { matches: matches.length, requested: 0, expired: 0, cancelled: 0, exhausted: 0 };

  for (const match of matches) {
    const actions = await planForMatch(admin, match, now);
    for (const action of actions) {
      await apply(admin, match, action, summary);
    }
  }

  return json(summary);
});

async function loadMatches(
  admin: SupabaseClient,
  now: Date,
  matchId?: string,
): Promise<MatchRow[]> {
  let query = admin
    .from('matches')
    .select('id, team_id, version, dtstart, active, required_players, lineup_locked')
    .eq('active', true)
    .gt('dtstart', now.toISOString());

  if (matchId) {
    query = query.eq('id', matchId);
  } else {
    query = query.lt(
      'dtstart',
      new Date(now.getTime() + HORIZON_DAYS * 24 * 3600_000).toISOString(),
    );
  }

  const { data } = await query;
  return (data ?? []) as MatchRow[];
}

async function planForMatch(
  admin: SupabaseClient,
  match: MatchRow,
  now: Date,
): Promise<EngineAction[]> {
  const [team, participations, members, requests, absences, exhausted] = await Promise.all([
    admin
      .from('teams')
      .select('id, substitute_mode, manual_request_auto_add, substitute_timeout_hours')
      .eq('id', match.team_id)
      .maybeSingle(),
    admin
      .from('match_participations')
      .select('profile_id, response, version_responded, lineup_position, removed')
      .eq('match_id', match.id),
    admin
      .from('team_members')
      .select('profile_id, kind, rank')
      .eq('team_id', match.team_id),
    admin
      .from('substitute_requests')
      .select('id, profile_id, rank, status, expires_at, match_version, created_by')
      .eq('match_id', match.id),
    // Nur Abwesenheiten, die das Spiel noch betreffen können. Ohne Filter lud jeder Lauf
    // alle Abwesenheiten aller Jahre — und PostgREST schnitt bei 1000 Zeilen ab, sodass
    // Abwesende trotzdem als Ersatz angefragt wurden.
    admin
      .from('absences')
      .select('profile_id, start_date, end_date')
      .gte('end_date', berlinToday(now))
      .lte('start_date', berlinToday(new Date(match.dtstart))),
    admin
      .from('notifications')
      .select('id')
      .eq('type', 'substitute_chain_exhausted')
      .contains('payload', { match_id: match.id, match_version: match.version })
      .limit(1),
  ]);

  const teamRow = team.data as {
    id: string;
    substitute_mode: SubstituteMode;
    manual_request_auto_add: boolean;
    substitute_timeout_hours: number;
  } | null;

  if (!teamRow) return [];

  const roster = (members.data ?? []) as { profile_id: string; kind: string; rank: number | null }[];
  const regulars = new Set(
    roster.filter((row) => row.kind === 'regular').map((row) => row.profile_id),
  );

  const candidates: EngineCandidate[] = roster
    .filter((row) => row.kind === 'substitute')
    .map((row, index) => ({ profileId: row.profile_id, rank: row.rank ?? 100 + index }));

  const input: EngineInput = {
    now,
    timeoutHours: teamRow.substitute_timeout_hours,
    match: {
      id: match.id,
      version: match.version,
      startsAt: match.dtstart,
      active: match.active,
      requiredPlayers: match.required_players,
      lineupLocked: match.lineup_locked,
    },
    team: {
      id: teamRow.id,
      substituteMode: teamRow.substitute_mode,
      manualAutoAdd: teamRow.manual_request_auto_add,
    },
    participations: ((participations.data ?? []) as {
      profile_id: string;
      response: string;
      version_responded: number | null;
      lineup_position: number | null;
      removed: boolean;
    }[]).map<EngineParticipation>((row) => ({
      profileId: row.profile_id,
      response: row.response as EngineParticipation['response'],
      versionResponded: row.version_responded,
      lineupPosition: row.lineup_position,
      removed: row.removed,
      isRegular: regulars.has(row.profile_id),
    })),
    candidates,
    requests: ((requests.data ?? []) as {
      id: string;
      profile_id: string;
      rank: number | null;
      status: string;
      expires_at: string;
      match_version: number;
      created_by: string;
    }[]).map<EngineRequest>((row) => ({
      id: row.id,
      profileId: row.profile_id,
      rank: row.rank,
      status: row.status as EngineRequest['status'],
      expiresAt: row.expires_at,
      matchVersion: row.match_version,
      createdBy: row.created_by as EngineRequest['createdBy'],
    })),
    absences: ((absences.data ?? []) as {
      profile_id: string;
      start_date: string;
      end_date: string;
    }[]).map<EngineAbsence>((row) => ({
      profileId: row.profile_id,
      startDate: row.start_date,
      endDate: row.end_date,
    })),
    exhaustedNotified: (exhausted.data ?? []).length > 0,
  };

  return planSubstituteStep(input);
}

async function apply(
  admin: SupabaseClient,
  match: MatchRow,
  action: EngineAction,
  summary: { requested: number; expired: number; cancelled: number; exhausted: number },
): Promise<void> {
  if (action.kind === 'expire') {
    await admin
      .from('substitute_requests')
      .update({ status: 'expired', answered_at: new Date().toISOString() })
      .eq('id', action.requestId)
      .eq('status', 'pending');
    summary.expired += 1;
    return;
  }

  if (action.kind === 'cancel') {
    await admin
      .from('substitute_requests')
      .update({ status: 'cancelled', answered_at: new Date().toISOString() })
      .eq('id', action.requestId)
      .eq('status', 'pending');
    summary.cancelled += 1;
    return;
  }

  if (action.kind === 'request') {
    // Die Datenbankfunktion schreibt die Anfrage und verschickt die Benachrichtigung
    // in einem Schritt — dieselbe, die auch der Mannschaftsführer von Hand auslöst.
    const { error } = await admin.rpc('enqueue_substitute_request', {
      p_match_id: match.id,
      p_profile_id: action.profileId,
      p_rank: action.rank,
      p_expires_at: action.expiresAt,
    });
    if (error) console.error('enqueue_substitute_request:', error.message);
    else summary.requested += 1;
    return;
  }

  // exhausted
  const { error } = await admin.rpc('notify_chain_exhausted', { p_match_id: match.id });
  if (error) console.error('notify_chain_exhausted:', error.message);
  else summary.exhausted += 1;
}
