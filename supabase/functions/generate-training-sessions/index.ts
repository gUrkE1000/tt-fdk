// Trainingstermine erzeugen (Aufgabe 6.3).
//
// Läuft täglich um 03:00 UTC und zusätzlich direkt nach jeder Änderung an einem Training
// (Trigger mit pg_net). Er materialisiert acht Wochen im Voraus: aus der Regel
// „dienstags 19 Uhr, zweiwöchentlich" werden Zeilen, an denen Rückmeldungen hängen können.
//
// Gelöscht wird dabei nie. Ein Termin, den es nicht mehr geben soll, wird abgesagt —
// mit Grund. Die Entscheidung darüber trifft `_shared/sessionPlanner.ts`, dort ohne Uhr
// und ohne Datenbank vollständig getestet. Hier bleibt das Holen und das Ausführen.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  HORIZON_DAYS,
  addDays,
  planSessions,
  type CancellationPeriod,
  type ExistingSession,
  type HolidayPeriod,
  type PlannedTraining,
} from '../_shared/sessionPlanner.ts';

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

  // Ein einzelnes Training, wenn der Trigger nach dem Speichern ruft — sonst alle.
  let onlyTraining: string | null = null;
  try {
    const body = await request.json();
    const value = (body as { training_id?: unknown } | null)?.training_id;
    if (typeof value === 'string' && value.length > 0) onlyTraining = value;
  } catch {
    // Kein Body ist der Normalfall beim nächtlichen Lauf.
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDays(today, HORIZON_DAYS);

  const result = await generate(admin, today, horizon, onlyTraining);
  return json(result);
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
  // Trainer dürfen den Lauf anstoßen: sie ändern ein Training und wollen die Termine sehen.
  return (
    (row?.role === 'admin' || row?.role === 'trainer') &&
    row.status === 'active' &&
    !row.deleted_at
  );
}

interface Result {
  created: number;
  cancelled: number;
  uncancelled: number;
  rescheduled: number;
  autoAttendance: number;
}

async function generate(
  admin: SupabaseClient,
  from: string,
  to: string,
  onlyTraining: string | null,
): Promise<Result> {
  const result: Result = {
    created: 0,
    cancelled: 0,
    uncancelled: 0,
    rescheduled: 0,
    autoAttendance: 0,
  };

  let query = admin
    .from('trainings')
    .select(
      'id, weekday, time_start, time_end, venue_id, rhythm, start_date,' +
        ' skip_public_holidays, skip_school_holidays, active',
    );
  if (onlyTraining) query = query.eq('id', onlyTraining);

  const { data: trainingRows } = await query;
  const trainings = (trainingRows ?? []) as {
    id: string;
    weekday: number;
    time_start: string;
    time_end: string | null;
    venue_id: string | null;
    rhythm: 'weekly' | 'biweekly' | 'monthly';
    start_date: string;
    skip_public_holidays: boolean;
    skip_school_holidays: boolean;
    active: boolean;
  }[];

  if (trainings.length === 0) return result;

  const [holidays, cancellations, sessions] = await Promise.all([
    loadHolidays(admin, from, to),
    loadCancellations(admin, from, to),
    loadSessions(admin, from, to, trainings.map((training) => training.id)),
  ]);

  for (const row of trainings) {
    const training: PlannedTraining = {
      id: row.id,
      weekday: row.weekday,
      timeStart: row.time_start,
      timeEnd: row.time_end,
      venueId: row.venue_id,
      rhythm: row.rhythm,
      startDate: row.start_date,
      skipPublicHolidays: row.skip_public_holidays,
      skipSchoolHolidays: row.skip_school_holidays,
      active: row.active,
    };

    const plan = planSessions({
      training,
      holidays,
      cancellations,
      existing: sessions.get(row.id) ?? [],
      from,
      to,
    });

    if (plan.create.length > 0) {
      const { data: inserted } = await admin
        .from('training_sessions')
        .insert(
          plan.create.map((entry) => ({
            training_id: entry.trainingId,
            session_date: entry.sessionDate,
            starts_at: entry.startsAt,
            ends_at: entry.endsAt,
            cancelled: entry.cancelled,
            cancel_reason: entry.cancelReason,
            cancellation_id: entry.cancellationId,
          })),
        )
        .select('id, session_date, cancelled');

      const rows = (inserted ?? []) as {
        id: string;
        session_date: string;
        cancelled: boolean;
      }[];
      result.created += rows.length;
      result.autoAttendance += await applyAutoAttendance(admin, row.id, rows);
    }

    for (const entry of plan.cancel) {
      await admin
        .from('training_sessions')
        .update({
          cancelled: true,
          cancel_reason: entry.reason,
          cancellation_id: entry.cancellationId,
        })
        .eq('id', entry.id);
      result.cancelled += 1;
    }

    for (const entry of plan.uncancel) {
      await admin
        .from('training_sessions')
        .update({ cancelled: false, cancel_reason: '', cancellation_id: null })
        .eq('id', entry.id);
      result.uncancelled += 1;
    }

    for (const entry of plan.reschedule) {
      await admin
        .from('training_sessions')
        .update({ starts_at: entry.startsAt, ends_at: entry.endsAt })
        .eq('id', entry.id);
      result.rescheduled += 1;
    }
  }

  return result;
}

async function loadHolidays(
  admin: SupabaseClient,
  from: string,
  to: string,
): Promise<HolidayPeriod[]> {
  const { data: settings } = await admin
    .from('club_settings')
    .select('value')
    .eq('key', 'bundesland')
    .maybeSingle();

  const bundesland = (settings as { value?: string } | null)?.value || 'NW';

  // Überlappung, nicht Enthaltensein: Ferien beginnen gern vor dem Fenster.
  const { data } = await admin
    .from('holidays')
    .select('kind, start_date, end_date')
    .eq('bundesland', bundesland)
    .lte('start_date', to)
    .gte('end_date', from);

  return ((data ?? []) as { kind: 'public' | 'school'; start_date: string; end_date: string }[]).map(
    (row) => ({ kind: row.kind, startDate: row.start_date, endDate: row.end_date }),
  );
}

async function loadCancellations(
  admin: SupabaseClient,
  from: string,
  to: string,
): Promise<CancellationPeriod[]> {
  const { data } = await admin
    .from('training_cancellations')
    .select('id, training_id, venue_id, from_date, to_date, reason')
    .lte('from_date', to)
    .gte('to_date', from);

  return ((data ?? []) as {
    id: string;
    training_id: string | null;
    venue_id: string | null;
    from_date: string;
    to_date: string;
    reason: string;
  }[]).map((row) => ({
    id: row.id,
    trainingId: row.training_id,
    venueId: row.venue_id,
    fromDate: row.from_date,
    toDate: row.to_date,
    reason: row.reason,
  }));
}

async function loadSessions(
  admin: SupabaseClient,
  from: string,
  to: string,
  trainingIds: string[],
): Promise<Map<string, ExistingSession[]>> {
  const { data } = await admin
    .from('training_sessions')
    .select('id, training_id, session_date, starts_at, ends_at, cancelled, cancellation_id')
    .in('training_id', trainingIds)
    .gte('session_date', from)
    .lte('session_date', to);

  const byTraining = new Map<string, ExistingSession[]>();

  for (const row of (data ?? []) as {
    id: string;
    training_id: string;
    session_date: string;
    starts_at: string;
    ends_at: string | null;
    cancelled: boolean;
    cancellation_id: string | null;
  }[]) {
    const list = byTraining.get(row.training_id) ?? [];
    list.push({
      id: row.id,
      sessionDate: row.session_date,
      // Postgres liefert `+00`, der Planer rechnet in ISO. Ohne diese Angleichung
      // hielte jeder Lauf jeden Termin für verschoben.
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: row.ends_at === null ? null : new Date(row.ends_at).toISOString(),
      cancelled: row.cancelled,
      cancellationId: row.cancellation_id,
    });
    byTraining.set(row.training_id, list);
  }

  return byTraining;
}

/**
 * Automatische Zusagen (Aufgabe 6.7).
 *
 * Wer regelmäßig kommt, sagt einmal bis zu einem Datum zu und wird danach nicht mehr
 * gefragt. Gesetzt wird das beim Anlegen des Termins — später ändern kann es jeder
 * jederzeit selbst.
 */
async function applyAutoAttendance(
  admin: SupabaseClient,
  trainingId: string,
  sessions: readonly { id: string; session_date: string; cancelled: boolean }[],
): Promise<number> {
  const open = sessions.filter((session) => !session.cancelled);
  if (open.length === 0) return 0;

  const { data } = await admin
    .from('training_auto_attendance')
    .select('profile_id, until_date, late')
    .eq('training_id', trainingId);

  const entries = (data ?? []) as { profile_id: string; until_date: string; late: boolean }[];
  if (entries.length === 0) return 0;

  const rows = open.flatMap((session) =>
    entries
      .filter((entry) => entry.until_date >= session.session_date)
      .map((entry) => ({
        session_id: session.id,
        profile_id: entry.profile_id,
        status: entry.late ? 'late' : 'yes',
        guests: 0,
        source: 'auto',
      })),
  );

  if (rows.length === 0) return 0;

  // `ignoreDuplicates`: eine von Hand gesetzte Rückmeldung wiegt schwerer als die
  // Dauerzusage und darf nicht überschrieben werden.
  const { error } = await admin
    .from('training_attendance')
    .upsert(rows, { onConflict: 'session_id,profile_id', ignoreDuplicates: true });

  return error ? 0 : rows.length;
}
