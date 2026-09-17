// Erinnerungen einreihen (Aufgabe 4.5).
//
// Läuft alle zehn Minuten. Zwei Aufgaben:
//   1. Erinnerung an ein Spiel, je Person mit ihrem eigenen Vorlauf.
//   2. Ein täglicher Sammelhinweis auf alles, wozu noch eine Antwort fehlt.
//
// Wer was bekommt, entscheidet `_shared/reminderPlanner.ts` — dort ohne Uhr und ohne
// Datenbank vollständig getestet. Hier bleibt das Holen und das Einreihen.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  formatOpenItems,
  planMatchReminders,
  planOpenReminders,
  type OpenItem,
  type ReminderCandidate,
  type ReminderMatch,
} from '../_shared/reminderPlanner.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  const now = new Date();
  const settings = await loadSettings(admin);

  const matchReminders = await doMatchReminders(admin, now);
  const openReminders = await doOpenReminders(admin, now, settings);

  return json({ matchReminders, openReminders });
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
  return row?.role === 'admin' && row.status === 'active' && !row.deleted_at;
}

interface Settings {
  openReminderDays: number;
  openReminderTime: string;
}

async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin
    .from('club_settings')
    .select('key, value')
    .in('key', ['open_reminder_days', 'open_reminder_time']);

  const map = Object.fromEntries(
    ((data ?? []) as { key: string; value: string }[]).map((row) => [row.key, row.value]),
  );

  return {
    openReminderDays: Number(map.open_reminder_days || '14'),
    openReminderTime: map.open_reminder_time || '18:00',
  };
}

async function doMatchReminders(admin: SupabaseClient, now: Date): Promise<number> {
  // Nur Spiele im nächsten Monat: weiter voraus erinnert niemand.
  const horizon = new Date(now.getTime() + 31 * 24 * 3600_000).toISOString();

  const { data: matchRows } = await admin
    .from('matches')
    .select('id, dtstart, version, active, required_players')
    .eq('active', true)
    .gt('dtstart', now.toISOString())
    .lt('dtstart', horizon);

  const matches: ReminderMatch[] = ((matchRows ?? []) as {
    id: string;
    dtstart: string;
    version: number;
    active: boolean;
  }[]).map((row) => ({
    id: row.id,
    startsAt: row.dtstart,
    version: row.version,
    active: row.active,
  }));

  if (matches.length === 0) return 0;

  const matchIds = matches.map((match) => match.id);

  const [{ data: participations }, { data: profiles }, { data: sent }] = await Promise.all([
    admin
      .from('match_participations')
      .select('match_id, profile_id, response, removed, lineup_position')
      .in('match_id', matchIds),
    admin.from('profiles').select('id, reminder_games_hours, deleted_at, no_games'),
    admin.from('match_reminders').select('match_id, profile_id, match_version').in('match_id', matchIds),
  ]);

  const hoursOf = new Map(
    ((profiles ?? []) as {
      id: string;
      reminder_games_hours: number;
      deleted_at: string | null;
      no_games: boolean;
    }[])
      .filter((row) => !row.deleted_at && !row.no_games)
      .map((row) => [row.id, row.reminder_games_hours]),
  );

  const candidates: ReminderCandidate[] = ((participations ?? []) as {
    match_id: string;
    profile_id: string;
    response: string;
    removed: boolean;
    lineup_position: number | null;
  }[]).map((row) => ({
    matchId: row.match_id,
    profileId: row.profile_id,
    hoursBefore: hoursOf.get(row.profile_id) ?? 0,
    // Erinnert wird, wer aufgestellt ist oder noch nicht abgesagt hat. Wer abgesagt
    // hat, braucht keine Erinnerung an ein Spiel, zu dem er nicht kommt.
    eligible:
      hoursOf.has(row.profile_id) &&
      !row.removed &&
      (row.lineup_position !== null || row.response !== 'no'),
  }));

  const actions = planMatchReminders({
    now,
    matches,
    candidates,
    alreadySent: ((sent ?? []) as {
      match_id: string;
      profile_id: string;
      match_version: number;
    }[]).map((row) => ({
      matchId: row.match_id,
      profileId: row.profile_id,
      matchVersion: row.match_version,
    })),
  });

  for (const action of actions) {
    // Erst merken, dann einreihen: Bricht der Lauf zwischen beidem ab, fehlt eine
    // Erinnerung. Andersherum kämen bei jedem Lauf neue — und das merkt jeder.
    const { error } = await admin.from('match_reminders').insert({
      match_id: action.matchId,
      profile_id: action.profileId,
      match_version: action.matchVersion,
    });

    // Ein Schlüsselkonflikt heißt: ein paralleler Lauf war schneller.
    if (error) continue;

    await admin.rpc('enqueue_match_reminder', {
      p_match_id: action.matchId,
      p_profile_id: action.profileId,
    });
  }

  return actions.length;
}

async function doOpenReminders(
  admin: SupabaseClient,
  now: Date,
  settings: Settings,
): Promise<number> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);

  const [{ data: openRows }, { data: sentRows }] = await Promise.all([
    admin.from('v_open_participations').select('*'),
    admin.from('open_reminder_log').select('profile_id').eq('sent_on', today),
  ]);

  const openItems: OpenItem[] = ((openRows ?? []) as {
    profile_id: string;
    kind: string;
    id: string;
    starts_at: string;
    title: string;
  }[]).map((row) => ({
    profileId: row.profile_id,
    kind: row.kind as OpenItem['kind'],
    id: row.id,
    startsAt: row.starts_at,
    title: row.title,
  }));

  const actions = planOpenReminders({
    now,
    sendAfter: settings.openReminderTime,
    withinDays: settings.openReminderDays,
    openItems,
    sentToday: ((sentRows ?? []) as { profile_id: string }[]).map((row) => row.profile_id),
    today,
  });

  for (const action of actions) {
    const { error } = await admin
      .from('open_reminder_log')
      .insert({ profile_id: action.profileId, sent_on: today });

    if (error) continue;

    await admin.rpc('enqueue_notification', {
      p_profile: action.profileId,
      p_type: 'open_participations',
      p_payload: { list: formatOpenItems(action.items) },
    });
  }

  return actions.length;
}
