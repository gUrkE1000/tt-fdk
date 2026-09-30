import { useQuery } from '@tanstack/react-query';
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
