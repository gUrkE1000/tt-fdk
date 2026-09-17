import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import type { ViewRow } from '../../lib/database.types';

export type PreferenceRow = ViewRow<'v_my_notification_preferences'>;

export interface PreferenceChange {
  type: string;
  email: boolean;
  push: boolean;
}

/**
 * Die Einstellungs-Matrix.
 *
 * Gelesen wird über die View: sie liefert auch für Typen eine Zeile, zu denen noch keine
 * eigene Einstellung existiert. Die Regel „fehlende Zeile heißt an" bleibt damit in der
 * Datenbank und muss nicht in der Oberfläche wiederholt werden.
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async (): Promise<PreferenceRow[]> => {
      const { data, error } = await supabase
        .from('v_my_notification_preferences')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      changes,
    }: {
      profileId: string;
      changes: PreferenceChange[];
    }) => {
      if (changes.length === 0) return;

      const { error } = await supabase.from('notification_preferences').upsert(
        changes.map((change) => ({
          profile_id: profileId,
          type: change.type,
          email: change.email,
          push: change.push,
        })),
        { onConflict: 'profile_id,type' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}

/** Nur geänderte Zeilen schreiben — sonst legt ein Klick fünfzehn Zeilen an. */
export function changedPreferences(
  stored: PreferenceRow[],
  draft: Record<string, { email: boolean; push: boolean }>,
): PreferenceChange[] {
  const changes: PreferenceChange[] = [];

  for (const row of stored) {
    if (!row.type) continue;
    const next = draft[row.type];
    if (!next) continue;
    if (next.email === row.email && next.push === row.push) continue;
    changes.push({ type: row.type, email: next.email, push: next.push });
  }

  return changes;
}
