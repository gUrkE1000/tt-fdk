import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { fetchAll } from '../../lib/fetchAll';
import { todayInBerlin } from '../../lib/dates';
import { queryKeys } from '../../lib/queryKeys';
import { keyKeys } from './api';

/**
 * Schlüsseldienst (Migration feedback_round): wer die Halle an welchem Wochentag auf-
 * und zuschließt, und wer an einem einzelnen Tag vertritt.
 */

export interface KeyDutyWeekday {
  weekday: number;
  profile_id: string;
}

export interface KeyDutyDate {
  duty_date: string;
  weekday: number;
  profile_id: string;
  full_name: string | null;
  is_override: boolean;
  regular_id: string | null;
}

const KEYS = {
  all: ['key-duty'] as const,
  weekdays: () => ['key-duty', 'weekdays'] as const,
  dates: () => ['key-duty', 'dates'] as const,
};

export function useKeyDutyWeekdays() {
  return useQuery({
    queryKey: KEYS.weekdays(),
    queryFn: async (): Promise<KeyDutyWeekday[]> => {
      const { data, error } = await supabase
        .from('key_duty_weekdays')
        .select('weekday, profile_id')
        .order('weekday');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Die kommenden Tage mit Schlüsseldienst, ab heute. */
export function useKeyDutyDates() {
  return useQuery({
    queryKey: KEYS.dates(),
    queryFn: async (): Promise<KeyDutyDate[]> => {
      const rows = await fetchAll((from, to) =>
        supabase
          .from('v_key_duty_dates')
          .select('*', { count: 'exact' })
          .gte('duty_date', todayInBerlin())
          .order('duty_date')
          .range(from, to),
      );
      return rows as KeyDutyDate[];
    },
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: KEYS.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    // Die Terminkarte zeigt den Schlüsseldienst des Tages.
    void queryClient.invalidateQueries({ queryKey: keyKeys.sessions() });
  };
}

/** Den festen Inhaber eines Wochentags setzen (`null` = niemand). Nur Administrator. */
export function useSetKeyDutyWeekday() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ weekday, profileId }: { weekday: number; profileId: string | null }) => {
      if (profileId === null) {
        const { error } = await supabase.from('key_duty_weekdays').delete().eq('weekday', weekday);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('key_duty_weekdays')
        .upsert({ weekday, profile_id: profileId, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Vertretung für einen Tag (`null` = zurück zum festen Inhaber). */
export function useSetKeyDutyOverride() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ date, profileId }: { date: string; profileId: string | null }) => {
      const { error } = await supabase.rpc('rpc_set_key_duty_override', {
        p_date: date,
        p_profile_id: profileId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}
