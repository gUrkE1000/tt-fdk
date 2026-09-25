import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { todayInBerlin } from '../../lib/dates';
import { fetchAll } from '../../lib/fetchAll';
import { queryKeys } from '../../lib/queryKeys';
import { applyOptimistic, dropOpenItem, optimisticUpdate } from '../../lib/optimistic';
import type { Enums, InsertDto, Tables, UpdateDto, ViewRow } from '../../lib/database.types';

export type Training = Tables<'trainings'>;
export type TrainingCancellation = Tables<'training_cancellations'>;

export interface TrainingWithPeople extends Training {
  trainerIds: string[];
  memberIds: string[];
  statisticsGroupIds: string[];
}

/**
 * Trainings mit Trainern, Zuordnung und Statistikgruppen.
 *
 * Vier Abfragen statt eines verschachtelten `select`, wie bei den Mannschaften: die
 * Zuordnung steht in eigenen Tabellen, und die Listen sind klein — ein Verein hat
 * Trainings im einstelligen Bereich.
 */
export function useTrainings() {
  return useQuery({
    queryKey: queryKeys.trainings.list(),
    queryFn: async (): Promise<TrainingWithPeople[]> => {
      const [trainings, trainers, members, groups] = await Promise.all([
        supabase.from('trainings').select('*').order('weekday').order('time_start'),
        supabase.from('training_trainers').select('*'),
        supabase.from('training_members').select('*'),
        supabase.from('training_statistics_groups').select('*'),
      ]);
      if (trainings.error) throw trainings.error;
      if (trainers.error) throw trainers.error;
      if (members.error) throw members.error;
      if (groups.error) throw groups.error;

      return (trainings.data ?? []).map((training) => ({
        ...training,
        trainerIds: (trainers.data ?? [])
          .filter((row) => row.training_id === training.id)
          .map((row) => row.profile_id),
        memberIds: (members.data ?? [])
          .filter((row) => row.training_id === training.id)
          .map((row) => row.profile_id),
        statisticsGroupIds: (groups.data ?? [])
          .filter((row) => row.training_id === training.id)
          .map((row) => row.group_id),
      }));
    },
  });
}

export function useCreateTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'trainings'>): Promise<string> => {
      const { data, error } = await supabase.from('trainings').insert(values).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'trainings'> }) => {
      const { error } = await supabase.from('trainings').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trainings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export interface TrainingPeopleInput {
  trainingId: string;
  trainerIds: string[];
  memberIds: string[];
  statisticsGroupIds: string[];
}

/**
 * Trainer, Zuordnung und Statistikgruppen auf genau diese Listen bringen.
 *
 * Die Trainer zuletzt: Nimmt sich ein Trainer selbst heraus, darf er danach nichts mehr
 * an diesem Training schreiben — die übrigen Listen müssen dann schon stehen.
 */
export function useSaveTrainingPeople() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TrainingPeopleInput) => {
      await replaceRows('training_members', 'profile_id', input.trainingId, input.memberIds);
      await replaceRows(
        'training_statistics_groups',
        'group_id',
        input.trainingId,
        input.statisticsGroupIds,
      );
      await replaceRows('training_trainers', 'profile_id', input.trainingId, input.trainerIds);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Nur die Zuordnung, ohne Trainer und Gruppen — für „Mitglieder zuweisen“. */
export function useAssignTrainingMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ trainingId, memberIds }: { trainingId: string; memberIds: string[] }) => {
      await replaceRows('training_members', 'profile_id', trainingId, memberIds);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// ---------------------------------------------------------------------------- Termine

export type TrainingSession = Tables<'training_sessions'>;
export type SessionParticipant = ViewRow<'v_session_participants'>;
export type SessionCounts = ViewRow<'v_session_counts'>;
export type AttendanceStatus = Enums<'attendance_status'>;

/** So weit reicht der Blick auf der Terminkarte — zwei Wochen, wie im Zielbild. */
export const SESSION_WINDOW_DAYS = 14;

export function useTrainingSessions(days = SESSION_WINDOW_DAYS) {
  return useQuery({
    queryKey: queryKeys.trainings.sessions(),
    queryFn: async (): Promise<TrainingSession[]> => {
      const today = todayInBerlin();
      const until = todayInBerlin(new Date(Date.now() + days * 86_400_000));

      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('session_date', today)
        .lte('session_date', until)
        .order('starts_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Ein einzelner Trainingstermin — für die Terminseite, auf die der Kalender verlinkt.
 * Unabhängig vom Zwei-Wochen-Fenster der Liste. `null`: gibt es nicht, oder die RLS
 * gibt ihn nicht heraus.
 */
export function useTrainingSession(sessionId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.trainings.all, 'session', sessionId ?? ''],
    enabled: sessionId !== null,
    queryFn: async (): Promise<TrainingSession | null> => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('id', sessionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Wer zu welchem Termin kommt — und wie viele.
 *
 * Zwei Abfragen, weil die Datenbank zwei Antworten gibt: Namen nur für den, der sie sehen
 * darf, Zahlen auch dann, wenn die Liste verborgen ist. Bei einem inkognito geführten
 * Training bleiben beide leer.
 */
export function useSessionParticipants() {
  return useQuery({
    queryKey: queryKeys.trainings.attendance(),
    queryFn: async (): Promise<SessionParticipant[]> => {
      return fetchAll((from, to) =>
        supabase
          .from('v_session_participants')
          .select('*', { count: 'exact' })
          .order('session_id')
          .order('profile_id')
          .range(from, to),
      );
    },
  });
}

export interface SessionAssignee {
  session_id: string;
  profile_id: string;
}

/**
 * Systemtraining: wer welchem Termin zugeteilt ist. Die Datenbank gibt jedem die
 * eigenen Zuteilungen und die Listen, deren Teilnehmer er auch sonst sehen darf.
 */
export function useSessionAssignees() {
  return useQuery({
    queryKey: queryKeys.trainings.assignees(),
    queryFn: async (): Promise<SessionAssignee[]> => {
      return fetchAll((from, to) =>
        supabase
          .from('training_session_participants')
          .select('session_id, profile_id', { count: 'exact' })
          .order('session_id')
          .order('profile_id')
          .range(from, to),
      );
    },
  });
}

/** Die Teilnehmer eines Termins festlegen (ersetzt die bisherige Liste). */
export function useSetSessionAssignees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      profileIds,
    }: {
      sessionId: string;
      profileIds: string[];
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('rpc_set_session_participants', {
        p_session_id: sessionId,
        p_profile_ids: profileIds,
      });
      if (error) throw new Error(error.message);
      return (data as number | null) ?? 0;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainings.assignees() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainings.attendance() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });
}

export function useSessionCounts() {
  return useQuery({
    queryKey: [...queryKeys.trainings.attendance(), 'counts'],
    queryFn: async (): Promise<SessionCounts[]> => {
      return fetchAll((from, to) =>
        supabase
          .from('v_session_counts')
          .select('*', { count: 'exact' })
          .order('session_id')
          .range(from, to),
      );
    },
  });
}

export function useSetAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      status,
      guests,
      profileId,
      comment,
    }: {
      sessionId: string;
      status: AttendanceStatus;
      guests?: number;
      profileId?: string;
      /** Ohne Angabe bleibt die bisherige Bemerkung stehen. */
      comment?: string;
      /** Der Angemeldete — nur für die sofortige Anzeige, der Server nimmt die Sitzung. */
      self?: string | null;
    }) => {
      const { error } = await supabase.rpc('rpc_set_training_attendance', {
        p_session_id: sessionId,
        p_status: status,
        p_guests: guests ?? 0,
        p_profile_id: profileId ?? null,
        ...(comment !== undefined ? { p_comment: comment } : {}),
      });
      if (error) throw error;
    },
    onMutate: async ({ sessionId, status, guests, profileId, comment, self }) => {
      const target = profileId ?? self ?? null;
      if (!target) return { rollback: () => {} };

      const rollback = await applyOptimistic(queryClient, [
        optimisticUpdate<SessionParticipant[]>({
          queryKey: queryKeys.trainings.attendance(),
          exact: true,
          update: (rows) => {
            const exists = rows.some(
              (row) => row.session_id === sessionId && row.profile_id === target,
            );
            if (!exists) {
              return [
                ...rows,
                {
                  session_id: sessionId,
                  profile_id: target,
                  status,
                  guests: guests ?? 0,
                  comment: comment ?? '',
                } as SessionParticipant,
              ];
            }
            return rows.map((row) =>
              row.session_id === sessionId && row.profile_id === target
                ? { ...row, status, guests: guests ?? 0, comment: comment ?? row.comment }
                : row,
            );
          },
        }),
        ...(target === self ? [dropOpenItem('training', sessionId)] : []),
      ]);
      return { rollback };
    },
    onError: (_error, _vars, context) => context?.rollback(),
    onSettled: () => invalidate(queryClient),
  });
}

/**
 * Einem offenen Training beitreten oder es wieder verlassen.
 *
 * Direkt auf `training_members`, ohne RPC: Die Policy erlaubt genau diesen einen Fall —
 * die eigene Zeile bei einem offenen Training, das keine Einladung verlangt.
 */
export function useJoinTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ trainingId, profileId }: { trainingId: string; profileId: string }) => {
      const { error } = await supabase
        .from('training_members')
        .insert({ training_id: trainingId, profile_id: profileId });
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useLeaveTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ trainingId, profileId }: { trainingId: string; profileId: string }) => {
      const { error } = await supabase
        .from('training_members')
        .delete()
        .eq('training_id', trainingId)
        .eq('profile_id', profileId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// ---------------------------------------------------------------------- Dauerzusagen

export type AutoAttendance = Tables<'training_auto_attendance'>;

/**
 * Die eigenen Dauerzusagen.
 *
 * Gesetzt werden sie nicht hier, sondern beim Erzeugen eines Termins (Aufgabe 6.3):
 * Wer bis Ostern zusagt, bekommt die Zusage an jedem neuen Termin bis dahin — und kann
 * sie an jedem einzelnen wieder ändern.
 */
export function useMyAutoAttendance(profileId: string) {
  return useQuery({
    queryKey: queryKeys.trainings.autoAttendance(profileId),
    queryFn: async (): Promise<AutoAttendance[]> => {
      const { data, error } = await supabase
        .from('training_auto_attendance')
        .select('*')
        .eq('profile_id', profileId)
        .order('until_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveAutoAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'training_auto_attendance'>) => {
      // Je Person und Training höchstens eine Zusage; eine zweite verlängert die erste.
      const { error } = await supabase
        .from('training_auto_attendance')
        .upsert(values, { onConflict: 'profile_id,training_id' });
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteAutoAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, trainingId }: { profileId: string; trainingId: string }) => {
      const { error } = await supabase
        .from('training_auto_attendance')
        .delete()
        .eq('profile_id', profileId)
        .eq('training_id', trainingId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// ---------------------------------------------------------------------------- Ausfälle

export function useTrainingCancellations() {
  return useQuery({
    queryKey: queryKeys.trainings.cancellations(),
    queryFn: async (): Promise<TrainingCancellation[]> => {
      const { data, error } = await supabase
        .from('training_cancellations')
        .select('*')
        .order('from_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCancellation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'training_cancellations'>) => {
      const { error } = await supabase.from('training_cancellations').insert(values);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteCancellation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_cancellations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// ---------------------------------------------------------------------------- Intern

type PeopleTable = 'training_trainers' | 'training_members' | 'training_statistics_groups';

/**
 * Die Zeilen eines Trainings auf genau `ids` bringen: erst ergänzen, dann das Übrige
 * entfernen.
 *
 * Nicht „alles löschen, neu schreiben": Die Policies fragen bei jedem Schreiben, ob der
 * Angemeldete das Training leitet — und das steht in `training_trainers`. Hätte ein
 * Trainer dort erst alles gelöscht, wäre er beim Wiedereintragen schon keiner mehr.
 */
async function replaceRows(
  table: PeopleTable,
  column: 'profile_id' | 'group_id',
  trainingId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length > 0) {
    // Der Aufruf ist für die drei Tabellen gleich, ihre Zeilentypen sind es nicht.
    // Ein Typparameter je Tabelle wäre hier mehr Gerüst als Gewinn.
    const rows = ids.map((id) => ({ training_id: trainingId, [column]: id }));
    const { error } = await supabase
      .from(table)
      .upsert(rows as never, { onConflict: `training_id,${column}`, ignoreDuplicates: true });
    if (error) throw error;
  }

  const stale = supabase.from(table).delete().eq('training_id', trainingId);
  const { error } = await (ids.length > 0
    ? stale.not(column as never, 'in', `(${ids.join(',')})`)
    : stale);
  if (error) throw error;
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.trainings.all });
  // Eine Rückmeldung ändert auch „Meine Termine", den Kalender und „Offen für dich".
  void queryClient.invalidateQueries({ queryKey: queryKeys.open.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
}
