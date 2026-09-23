import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

/**
 * Vereinseinstellungen liegen als Schlüssel-Wert-Paare in `club_settings` — ein Zeile je
 * Einstellung statt einer Tabelle mit dreißig Spalten. Neue Einstellungen brauchen so
 * keine Migration, und die Oberfläche liest sie alle mit einer Abfrage.
 */

export type ClubSettings = Record<string, string>;

export function useClubSettings() {
  return useQuery({
    queryKey: queryKeys.clubSettings,
    queryFn: async (): Promise<ClubSettings> => {
      const { data, error } = await supabase.from('club_settings').select('key, value');
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    },
  });
}

export function useUpdateClubSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ClubSettings) => {
      const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from('club_settings').upsert(rows, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clubSettings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicClubInfo });
    },
  });
}

/**
 * Ein neuer Vereinscode entwertet den alten. Das ist der ganze Zweck: ein Code, der in
 * einer WhatsApp-Gruppe gelandet ist, lässt sich so in zwei Klicks ungültig machen.
 */
/**
 * Zwölf Zeichen aus 32 Möglichkeiten sind 60 Bit Zufall. Die Prüfung des Codes ist ohne
 * Anmeldung erreichbar und lässt sich beliebig oft aufrufen — ein kurzer Code wäre
 * durchzuprobieren. Getippt wird er ohnehin selten: Der Link und der QR-Code tragen ihn.
 */
export const REGISTRATION_CODE_LENGTH = 12;

export function generateRegistrationCode(): string {
  // Ohne I, O, 0 und 1 — die verwechselt beim Abtippen sonst jeder. 32 Zeichen teilen
  // 256 glatt, `byte % 32` ist also gleichverteilt.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(REGISTRATION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
