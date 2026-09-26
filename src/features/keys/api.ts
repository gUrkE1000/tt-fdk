import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import type { ViewRow } from '../../lib/database.types';

/**
 * Schlüssel am Trainingstermin: wer ihn zu einem Termin bringt, und wer an dem Tag
 * Schlüsseldienst hat. Die frühere Schlüsselverwaltung (wer welchen Schlüssel hat,
 * Übergaben) gibt es nicht mehr (Migration remove_key_management).
 */

export type SessionKeys = ViewRow<'v_session_keys'>;

export const keyKeys = {
  sessions: () => ['keys', 'sessions'] as const,
};

/** Schlüsselbringer und Schlüsseldienst je Trainingstermin. */
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
