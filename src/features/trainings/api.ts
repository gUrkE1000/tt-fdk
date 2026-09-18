import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { InsertDto, Tables, UpdateDto } from '../../lib/database.types';

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
