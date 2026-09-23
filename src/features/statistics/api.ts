import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { fetchAll } from '../../lib/fetchAll';
import type { ViewRow } from '../../lib/database.types';

/**
 * Trainingsstatistik (Aufgabe 9.9).
 *
 * Gefiltert wird hier nicht: Die View gibt nur her, was dieses Mitglied sehen darf
 * (`may_see_training_statistics`). Ein Filter in der Oberfläche wäre Bequemlichkeit,
 * keine Grenze — Anwesenheit ist eine Aussage über eine Person.
 */

export type StatisticsRow = ViewRow<'v_training_statistics'>;

export function useTrainingStatistics() {
  return useQuery({
    queryKey: ['statistics', 'trainings'],
    queryFn: async (): Promise<StatisticsRow[]> => {
      // Eine Zeile je Person und vergangenem Termin: Ein Jahr sind schnell über 1000.
      // Ohne Blättern fehlten ausgerechnet die neuesten Termine.
      return fetchAll((from, to) =>
        supabase
          .from('v_training_statistics')
          .select('*', { count: 'exact' })
          .order('session_date')
          .order('training_id')
          .order('profile_id')
          .range(from, to),
      );
    },
  });
}
