import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { Enums, InsertDto, Tables, UpdateDto, ViewRow } from '../../lib/database.types';

export type ClubEvent = Tables<'club_events'>;
export type EventParticipant = ViewRow<'v_event_participants'>;
export type EventStatus = Enums<'event_status'>;

export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events.list(),
    queryFn: async (): Promise<ClubEvent[]> => {
      const { data, error } = await supabase
        .from('club_events')
        .select('*')
        .order('starts_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEventParticipants() {
  return useQuery({
    queryKey: queryKeys.events.participants(),
    queryFn: async (): Promise<EventParticipant[]> => {
      const { data, error } = await supabase.from('v_event_participants').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'club_events'>) => {
      const { error } = await supabase.from('club_events').insert(values);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'club_events'> }) => {
      const { error } = await supabase.from('club_events').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('club_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/**
 * Zu- oder Absage zu einem Vereinstermin.
 *
 * Die Funktion gibt einen Status zurück, statt zu scheitern: „Die Anmeldefrist ist
 * vorbei" ist keine Ausnahme, sondern eine Antwort, die man dem Mitglied zeigen will.
 */
export function useSetEventParticipation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
      guests,
    }: {
      eventId: string;
      status: EventStatus;
      guests?: number;
    }): Promise<{ status: string; taken?: number; max?: number }> => {
      const { data, error } = await supabase.rpc('rpc_set_event_participation', {
        p_event_id: eventId,
        p_status: status,
        p_guests: guests ?? 0,
      });
      if (error) throw error;
      return (data ?? { status: 'unknown' }) as { status: string };
    },
    onSuccess: () => invalidate(queryClient),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
}
