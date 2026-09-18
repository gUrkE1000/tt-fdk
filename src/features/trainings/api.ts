import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
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
 * Trainer, Zuordnung und Statistikgruppen vollständig ersetzen — erst löschen, dann
 * schreiben, wie beim Kader einer Mannschaft.
 */
export function useSaveTrainingPeople() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TrainingPeopleInput) => {
      await replaceRows(
        'training_trainers',
        input.trainingId,
        input.trainerIds.map((id) => ({ training_id: input.trainingId, profile_id: id })),
      );
      await replaceRows(
        'training_members',
        input.trainingId,
        input.memberIds.map((id) => ({ training_id: input.trainingId, profile_id: id })),
      );
      await replaceRows(
        'training_statistics_groups',
        input.trainingId,
        input.statisticsGroupIds.map((id) => ({ training_id: input.trainingId, group_id: id })),
      );
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Nur die Zuordnung, ohne Trainer und Gruppen — für „Mitglieder zuweisen“. */
export function useAssignTrainingMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ trainingId, memberIds }: { trainingId: string; memberIds: string[] }) => {
      await replaceRows(
        'training_members',
        trainingId,
        memberIds.map((id) => ({ training_id: trainingId, profile_id: id })),
      );
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
      const today = new Date().toISOString().slice(0, 10);
      const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

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
      const { data, error } = await supabase.from('v_session_participants').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSessionCounts() {
  return useQuery({
    queryKey: [...queryKeys.trainings.attendance(), 'counts'],
    queryFn: async (): Promise<SessionCounts[]> => {
      const { data, error } = await supabase.from('v_session_counts').select('*');
      if (error) throw error;
      return data ?? [];
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
    }: {
      sessionId: string;
      status: AttendanceStatus;
      guests?: number;
      profileId?: string;
    }) => {
      const { error } = await supabase.rpc('rpc_set_training_attendance', {
        p_session_id: sessionId,
        p_status: status,
        p_guests: guests ?? 0,
        p_profile_id: profileId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
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

async function replaceRows(
  table: PeopleTable,
  trainingId: string,
  rows: Record<string, string>[],
): Promise<void> {
  const dropped = await supabase.from(table).delete().eq('training_id', trainingId);
  if (dropped.error) throw dropped.error;

  if (rows.length === 0) return;

  // Der Aufruf ist für die drei Tabellen gleich, ihre Zeilentypen sind es nicht.
  // Ein Typparameter je Tabelle wäre hier mehr Gerüst als Gewinn.
  const { error } = await supabase.from(table).insert(rows as never);
  if (error) throw error;
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.trainings.all });
}
