import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import type { Tables, ViewRow } from '../../lib/database.types';

/**
 * Die Betriebssicht (Aufgabe 8.4).
 *
 * Alles hier ist nur für Administratoren sichtbar — nicht weil die Oberfläche es
 * verbirgt, sondern weil die Policies und `v_cron_status` es tun. Ein Mannschaftsführer,
 * der diese Abfragen von Hand stellte, bekäme leere Listen.
 */

export type SyncRun = Tables<'sync_runs'>;
export type NotificationRow = Tables<'notifications'>;
export type CronStatus = ViewRow<'v_cron_status'>;

export const adminKeys = {
  syncRuns: ['admin', 'sync-runs'] as const,
  notifications: (status: string) => ['admin', 'notifications', status] as const,
  cron: ['admin', 'cron'] as const,
};

/** Die letzten Läufe des Kalenderabgleichs. Zwanzig reichen für „läuft es noch?". */
export function useSyncRuns(limit = 20) {
  return useQuery({
    queryKey: adminKeys.syncRuns,
    queryFn: async (): Promise<SyncRun[]> => {
      const { data, error } = await supabase
        .from('sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type NotificationFilter = 'problems' | 'all';

/**
 * Das Postfach.
 *
 * Voreinstellung sind die Problemfälle: Wer hier nachsieht, sucht nicht die
 * hundertste erfolgreich verschickte Erinnerung, sondern die eine, die nicht ankam.
 */
export function useNotificationLog(filter: NotificationFilter = 'problems', limit = 50) {
  return useQuery({
    queryKey: adminKeys.notifications(filter),
    queryFn: async (): Promise<NotificationRow[]> => {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filter === 'problems') query = query.in('status', ['failed', 'skipped']);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRetryNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc('rpc_retry_notification', { p_id: id });
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
  });
}

export function useCronStatus() {
  return useQuery({
    queryKey: adminKeys.cron,
    queryFn: async (): Promise<CronStatus[]> => {
      const { data, error } = await supabase.from('v_cron_status').select('*').order('jobname');
      if (error) throw error;
      return data ?? [];
    },
  });
}
