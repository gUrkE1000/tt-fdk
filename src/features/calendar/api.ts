import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { CalendarItem } from './events';

/**
 * Alles, was im Kalender steht — aus einer View statt aus fünf Abfragen. Die Regeln,
 * was auftaucht, stehen in der Datenbank, und die RLS gilt dort weiter.
 */
export function useCalendarItems() {
  return useQuery({
    queryKey: queryKeys.calendar.items(),
    queryFn: async (): Promise<CalendarItem[]> => {
      const { data, error } = await supabase
        .from('v_calendar_items')
        .select('*')
        .order('starts_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}
