// Erinnerungen einreihen (Aufgabe 4.5).
//
// Läuft alle zehn Minuten. Vier Aufgaben:
//   1. Erinnerung an ein Spiel, je Person mit ihrem eigenen Vorlauf.
//   2. Erinnerung an einen Trainingstermin, mit dem Vorlauf des Trainings.
//   3. Erinnerung an einen Vereinstermin, mit dem vereinsweiten Vorlauf.
//   4. Ein täglicher Sammelhinweis auf alles, wozu noch eine Antwort fehlt.
//
// Die Asymmetrie in 1 und 2 ist Absicht: Beim Spiel entscheidet die Person, wie früh sie
// erinnert werden will, beim Training das Training. Wer dienstags um 19 Uhr trainiert,
// entscheidet am Nachmittag — nicht einen Tag vorher.
//
// Wer was bekommt, entscheidet `_shared/reminderPlanner.ts` — dort ohne Uhr und ohne
// Datenbank vollständig getestet. Hier bleibt das Holen und das Einreihen.

import { authorize, corsHeaders, environment, json, type SupabaseClient } from '../_shared/http.ts';
import { berlinToday, fetchAllPages } from '../_shared/guards.ts';
import {
  formatOpenItems,
  planEventReminders,
  planMatchReminders,
  planOpenReminders,
  planTrainingReminders,
  type OpenItem,
  type ReminderCandidate,
  type ReminderMatch,
  type ReminderSession,
} from '../_shared/reminderPlanner.ts';

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders('POST') });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const env = environment();
  if (!env) return json({ error: 'not_configured' }, 500);
  const { admin } = env;

  if (!(await authorize(request, env, ['admin']))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const now = new Date();
  const settings = await loadSettings(admin);

  const matchReminders = await doMatchReminders(admin, now);
  const trainingReminders = await doTrainingReminders(admin, now);
  const eventReminders = await doEventReminders(admin, now, settings);
  const openReminders = await doOpenReminders(admin, now, settings);

  return json({ matchReminders, trainingReminders, eventReminders, openReminders });
});

interface Settings {
  openReminderDays: number;
  openReminderTime: string;
  eventReminderHours: number;
}

async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin
    .from('club_settings')
    .select('key, value')
    .in('key', ['open_reminder_days', 'open_reminder_time', 'event_reminder_hours']);

  const map = Object.fromEntries(
    ((data ?? []) as { key: string; value: string }[]).map((row) => [row.key, row.value]),
  );

  return {
    openReminderDays: Number(map.open_reminder_days || '14'),
    openReminderTime: map.open_reminder_time || '18:00',
    eventReminderHours: Number(map.event_reminder_hours || '24'),
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
    fetchAllPages((from, to) =>
      admin
        .from('profiles')
        .select('id, reminder_games_hours, deleted_at, no_games')
        .order('id')
        .range(from, to),
    ).then((data) => ({ data })),
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

    const { error: enqueueError } = await admin.rpc('enqueue_match_reminder', {
      p_match_id: action.matchId,
      p_profile_id: action.profileId,
    });
    if (enqueueError) console.error('enqueue_match_reminder:', enqueueError.message);
  }

  return actions.length;
}

async function doTrainingReminders(admin: SupabaseClient, now: Date): Promise<number> {
  // Weiter als zwei Wochen voraus erinnert kein Training; der längste Vorlauf ist 336 Stunden.
  const horizon = new Date(now.getTime() + 15 * 24 * 3600_000).toISOString();

  const { data: sessionRows } = await admin
    .from('training_sessions')
    .select('id, training_id, starts_at, cancelled, reminder_sent_at')
    .eq('cancelled', false)
    .is('reminder_sent_at', null)
    .gt('starts_at', now.toISOString())
    .lt('starts_at', horizon);

  const rows = (sessionRows ?? []) as {
    id: string;
    training_id: string;
    starts_at: string;
    cancelled: boolean;
    reminder_sent_at: string | null;
  }[];

  if (rows.length === 0) return 0;

  const trainingIds = [...new Set(rows.map((row) => row.training_id))];
  const sessionIds = rows.map((row) => row.id);

  const [{ data: trainingRows }, { data: memberRows }, { data: answeredRows }, { data: filterRows }, { data: profileRows }] =
    await Promise.all([
      admin
        .from('trainings')
        .select('id, reminder_hours, is_open, active')
        .in('id', trainingIds),
      admin.from('training_members').select('training_id, profile_id').in('training_id', trainingIds),
      admin.from('training_attendance').select('session_id, profile_id').in('session_id', sessionIds),
      admin.from('training_reminder_filter').select('profile_id, training_id'),
      fetchAllPages((from, to) =>
        admin.from('profiles').select('id, status, deleted_at').order('id').range(from, to),
      ).then((data) => ({ data })),
    ]);

  const trainings = new Map(
    ((trainingRows ?? []) as {
      id: string;
      reminder_hours: number;
      is_open: boolean;
      active: boolean;
    }[]).map((row) => [row.id, row]),
  );

  const activeProfiles = ((profileRows ?? []) as {
    id: string;
    status: string;
    deleted_at: string | null;
  }[])
    .filter((row) => row.status === 'active' && !row.deleted_at)
    .map((row) => row.id);

  // Bei einem offenen Training ist der Kreis der ganze Verein (Zielbild 4.4). Wem das
  // zu viel ist, schränkt über `training_reminder_filter` ein.
  const assignments: { trainingId: string; profileId: string }[] = [];
  for (const trainingId of trainingIds) {
    const training = trainings.get(trainingId);
    if (!training || !training.active) continue;

    if (training.is_open) {
      for (const profileId of activeProfiles) assignments.push({ trainingId, profileId });
    }
  }
  for (const row of (memberRows ?? []) as { training_id: string; profile_id: string }[]) {
    assignments.push({ trainingId: row.training_id, profileId: row.profile_id });
  }

  const sessions: ReminderSession[] = rows
    .filter((row) => trainings.get(row.training_id)?.active)
    .map((row) => ({
      id: row.id,
      trainingId: row.training_id,
      startsAt: row.starts_at,
      cancelled: row.cancelled,
      reminderSentAt: row.reminder_sent_at,
      reminderHours: trainings.get(row.training_id)?.reminder_hours ?? 0,
    }));

  const actions = planTrainingReminders({
    now,
    sessions,
    assignments,
    answered: ((answeredRows ?? []) as { session_id: string; profile_id: string }[]).map((row) => ({
      sessionId: row.session_id,
      profileId: row.profile_id,
    })),
    filters: ((filterRows ?? []) as { profile_id: string; training_id: string }[]).map((row) => ({
      profileId: row.profile_id,
      trainingId: row.training_id,
    })),
  });

  let sent = 0;

  for (const action of actions) {
    // Erst merken, dann einreihen — wie beim Spiel. Der Merkposten hängt hier am Termin,
    // nicht an der Person: Ein zweiter Lauf soll niemanden noch einmal fragen.
    // Das Update trifft nur eine Zeile, wenn sie noch frei war. Ein paralleler Lauf, der
    // schneller war, hinterlässt eine leere Rückgabe — ohne Fehler. Deshalb die Zeilen
    // zurückgeben lassen und zählen, nicht nur auf `error` schauen.
    const { data: claimed, error } = await admin
      .from('training_sessions')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', action.sessionId)
      .is('reminder_sent_at', null)
      .select('id');

    if (error || !claimed || claimed.length === 0) continue;

    for (const profileId of action.profileIds) {
      const { error: enqueueError } = await admin.rpc('enqueue_training_reminder', {
        p_session_id: action.sessionId,
        p_profile_id: profileId,
      });
      if (enqueueError) console.error('enqueue_training_reminder:', enqueueError.message);
      else sent += 1;
    }
  }

  return sent;
}

async function doEventReminders(
  admin: SupabaseClient,
  now: Date,
  settings: Settings,
): Promise<number> {
  const horizon = new Date(
    now.getTime() + (settings.eventReminderHours + 24) * 3600_000,
  ).toISOString();

  const { data: eventRows } = await admin
    .from('club_events')
    .select('id, starts_at, reminder_sent_at')
    .is('reminder_sent_at', null)
    .gt('starts_at', now.toISOString())
    .lt('starts_at', horizon);

  const events = ((eventRows ?? []) as {
    id: string;
    starts_at: string;
    reminder_sent_at: string | null;
  }[]).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    reminderSentAt: row.reminder_sent_at,
  }));

  if (events.length === 0) return 0;

  const { data: attendingRows } = await admin
    .from('event_participations')
    .select('event_id, profile_id, status')
    .in('event_id', events.map((event) => event.id))
    .eq('status', 'yes');

  const actions = planEventReminders({
    now,
    events,
    hoursBefore: settings.eventReminderHours,
    attending: ((attendingRows ?? []) as { event_id: string; profile_id: string }[]).map(
      (row) => ({ eventId: row.event_id, profileId: row.profile_id }),
    ),
  });

  let sent = 0;

  for (const action of actions) {
    const { data: claimed, error } = await admin
      .from('club_events')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', action.eventId)
      .is('reminder_sent_at', null)
      .select('id');

    if (error || !claimed || claimed.length === 0) continue;

    for (const profileId of action.profileIds) {
      const { error: enqueueError } = await admin.rpc('enqueue_event_reminder', {
        p_event_id: action.eventId,
        p_profile_id: profileId,
      });
      if (enqueueError) console.error('enqueue_event_reminder:', enqueueError.message);
      else sent += 1;
    }
  }

  return sent;
}

async function doOpenReminders(
  admin: SupabaseClient,
  now: Date,
  settings: Settings,
): Promise<number> {
  const today = berlinToday(now);

  // Nur, was im Erinnerungszeitraum liegt — und alle Seiten davon. Ohne Datumsfilter und
  // ohne Blättern schnitt PostgREST die Liste bei 1000 Zeilen ab, und ein zufälliger Teil
  // der Mitglieder bekam keine Sammelerinnerung.
  const until = new Date(now.getTime() + (settings.openReminderDays + 1) * 24 * 3600_000);

  const [openRows, { data: sentRows }] = await Promise.all([
    fetchAllPages((from, to) =>
      admin
        .from('v_open_participations')
        .select('profile_id, kind, id, starts_at, title')
        .lte('starts_at', until.toISOString())
        .order('profile_id')
        .order('kind')
        .order('id')
        .range(from, to),
    ),
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

    const { error: enqueueError } = await admin.rpc('enqueue_notification', {
      p_profile: action.profileId,
      p_type: 'open_participations',
      p_payload: { list: formatOpenItems(action.items) },
    });
    if (enqueueError) console.error('enqueue_notification:', enqueueError.message);
  }

  return actions.length;
}
