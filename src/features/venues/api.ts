import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { InsertDto, Tables, UpdateDto } from '../../lib/database.types';

export type Venue = Tables<'venues'>;

export function useVenues() {
  return useQuery({
    queryKey: queryKeys.venues.list(),
    queryFn: async (): Promise<Venue[]> => {
      const { data, error } = await supabase.from('venues').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'venues'>) => {
      const { error } = await supabase.from('venues').insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.venues.all });
    },
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'venues'> }) => {
      const { error } = await supabase.from('venues').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.venues.all });
    },
  });
}

/**
 * Orte werden nicht gelöscht, sondern stillgelegt: an ihnen hängen vergangene Spiele und
 * Trainings, die nachvollziehbar bleiben sollen. Ein inaktiver Ort steht nur nicht mehr
 * zur Auswahl.
 */
export function useSetVenueActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('venues').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.venues.all });
    },
  });
}
