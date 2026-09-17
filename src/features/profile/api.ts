import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { Tables, UpdateDto, ViewRow } from '../../lib/database.types';

export type Absence = ViewRow<'v_absences'>;
export type Profile = Tables<'profiles'>;

/**
 * Abwesenheiten werden über die View gelesen: dort ist der Grund für Fremde maskiert.
 * Geschrieben wird direkt auf die Tabelle — die Policy lässt nur die eigenen Zeilen durch.
 */
export function useMyAbsences(profileId: string | null) {
  return useQuery({
    queryKey: ['absences', profileId],
    enabled: profileId !== null,
    queryFn: async (): Promise<Absence[]> => {
      const { data, error } = await supabase
        .from('v_absences')
        .select('*')
        .eq('profile_id', profileId!)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface AbsenceInput {
  profileId: string;
  startDate: string;
  endDate: string;
  comment?: string | null;
}

export function useCreateAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AbsenceInput) => {
      const { error } = await supabase.from('absences').insert({
        profile_id: input.profileId,
        start_date: input.startDate,
        end_date: input.endDate,
        comment_private: input.comment?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['absences'] });
    },
  });
}

export function useDeleteAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('absences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['absences'] });
    },
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'profiles'> }) => {
      const { error } = await supabase.from('profiles').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
    },
  });
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Soft-Delete: das Konto verschwindet, die Historie bleibt lesbar. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('rpc_delete_my_account' as never);
  if (error) throw new Error(error.message);
}
