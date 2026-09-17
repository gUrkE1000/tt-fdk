// Ersatzkette ausführen (Aufgabe 5.3).
//
// Zwei Wege hierher: alle zehn Minuten per Cron für die Fristen, und sofort nach jeder
// Absage. Das Sofortige ist der wichtigere Fall — wer freitags absagt, soll nicht bis
// zum nächsten Zehnminutentakt warten, bis der Ersatz gefragt wird.
//
// Was zu tun ist, entscheidet `_shared/substituteEngine.ts`. Hier steht das Laden, das
// Ausführen und das Benachrichtigen.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  if (!(await authorize(request, admin, supabaseUrl, anonKey))) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: { matchId?: string } = {};
  try {
    if (request.headers.get('content-length') !== '0') {
      body = (await request.json()) as { matchId?: string };
    }
  } catch {
    body = {};
  }

  const now = new Date();
  const matches = await loadMatches(admin, now, body.matchId);

  const summary = { matches: matches.length, requested: 0, expired: 0, cancelled: 0, exhausted: 0 };

  for (const match of matches) {
    const actions = await planForMatch(admin, match, now);
    for (const action of actions) {
      await apply(admin, match, action, summary);
    }
  }

  return json(summary);
});

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
    admin.from('absences').select('profile_id, start_date, end_date'),
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
    if (!error) summary.requested += 1;
    return;
  }

  // exhausted
  await admin.rpc('notify_chain_exhausted', { p_match_id: match.id });
  summary.exhausted += 1;
}
