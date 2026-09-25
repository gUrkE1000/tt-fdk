import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import type { InsertDto, Tables, UpdateDto, ViewRow } from '../../lib/database.types';

/**
 * Schlüsselverwaltung (Aufgabe 9.1).
 *
 * `holder_id` wird hier nie geschrieben. Jede Übergabe geht durch
 * `rpc_hand_over_key`, weil dieselbe Handlung zwei Zeilen ändern muss: den
 * aktuellen Inhaber und das Protokoll. Zwei Aufrufe aus dem Browser wären zwei
 * Gelegenheiten, dass nur die Hälfte ankommt.
 */

export type Key = Tables<'keys'>;
export type KeyRow = ViewRow<'v_keys'>;
export type KeyHandover = Tables<'key_handovers'>;
export type SessionKeys = ViewRow<'v_session_keys'>;

export const keyKeys = {
  all: ['keys'] as const,
  list: () => ['keys', 'list'] as const,
  handovers: (keyId: string) => ['keys', 'handovers', keyId] as const,
  sessions: () => ['keys', 'sessions'] as const,
};

export function useKeys() {
  return useQuery({
    queryKey: keyKeys.list(),
    queryFn: async (): Promise<KeyRow[]> => {
      const { data, error } = await supabase.from('v_keys').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Der Weg eines Schlüssels, jüngste Übergabe zuerst. */
export function useKeyHandovers(keyId: string | null) {
  return useQuery({
    queryKey: keyKeys.handovers(keyId ?? ''),
    enabled: keyId !== null,
    queryFn: async (): Promise<KeyHandover[]> => {
      const { data, error } = await supabase
        .from('key_handovers')
        .select('*')
        .eq('key_id', keyId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Ob zu einem Trainingstermin jemand mit Schlüssel kommt (Zielbild 4.4). */
export function useSessionKeys() {
  return useQuery({
    queryKey: keyKeys.sessions(),
    queryFn: async (): Promise<SessionKeys[]> => {
      const { data, error } = await supabase.from('v_session_keys').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Wer den Schlüssel zu einem Trainingstermin bringt. `profileId` = die eigene ID:
 * selbst eintragen; `null`: austragen; eine andere ID: jemanden eintragen (Trainer,
 * Admin). Die Regeln prüft `rpc_set_session_key_bearer`.
 */
export function useSetSessionKeyBearer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, profileId }: { sessionId: string; profileId: string | null }) => {
      const { error } = await supabase.rpc('rpc_set_session_key_bearer', {
        p_session_id: sessionId,
        p_profile_id: profileId,
      });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keyKeys.sessions() }),
  });
}

export function useCreateKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'keys'>) => {
      const { error } = await supabase.from('keys').insert(values);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keyKeys.all }),
  });
}

export function useUpdateKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'keys'> }) => {
      const { error } = await supabase.from('keys').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keyKeys.all }),
  });
}

export function useDeleteKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keyKeys.all }),
  });
}

export type HandoverStatus = 'ok' | 'gone' | 'not_allowed' | 'unknown_member' | 'unchanged';

export function useHandOverKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      keyId: string;
      to: string | null;
      note?: string;
    }): Promise<HandoverStatus> => {
      const { data, error } = await supabase.rpc('rpc_hand_over_key', {
        p_key_id: input.keyId,
        p_to: input.to,
        p_note: input.note ?? '',
      });
      if (error) throw error;
      return ((data as { status?: string } | null)?.status ?? 'gone') as HandoverStatus;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keyKeys.all });
      // Die Trainingskarte zeigt den Schlüsselhinweis — der ändert sich mit.
      void queryClient.invalidateQueries({ queryKey: ['trainings'] });
    },
  });
}
