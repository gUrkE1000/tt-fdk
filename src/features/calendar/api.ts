import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { fetchAll } from '../../lib/fetchAll';
import { queryKeys } from '../../lib/queryKeys';
import type { ViewRow } from '../../lib/database.types';
import type { CalendarItem } from './events';

export type MyDate = ViewRow<'v_my_upcoming'>;

/**
 * Alles, was im Kalender steht — aus einer View statt aus fünf Abfragen. Die Regeln,
 * was auftaucht, stehen in der Datenbank, und die RLS gilt dort weiter.
 */
export function useCalendarItems() {
  return useQuery({
    queryKey: queryKeys.calendar.items(),
    queryFn: async (): Promise<CalendarItem[]> => {
      return fetchAll((from, to) =>
        supabase
          .from('v_calendar_items')
          .select('*', { count: 'exact' })
          .order('starts_at')
          .order('kind')
          .order('id')
          .range(from, to),
      );
    },
  });
}

/**
 * Die eigenen Termine mit dem eigenen Status — Grundlage für „Meine Termine", das
 * Dashboard und den ICS-Feed. Damit rechnet nicht jede Stelle für sich.
 */
export function useMyUpcoming(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.calendar.mine(profileId),
    enabled: profileId !== null,
    queryFn: async (): Promise<MyDate[]> => {
      return fetchAll((from, to) =>
        supabase
          .from('v_my_upcoming')
          .select('*', { count: 'exact' })
          .eq('profile_id', profileId!)
          .order('starts_at')
          .order('kind')
          .order('id')
          .range(from, to),
      );
    },
  });
}
