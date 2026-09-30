import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { ViewRow } from '../../lib/database.types';
import { matchesSearch } from '../../lib/search';

export type DirectoryEntry = ViewRow<'v_members_directory'>;

/**
 * Das Mitgliederverzeichnis für alle. Gelesen wird die View, nicht die Tabelle: dort sind
 * E-Mail, Telefon und Geburtstag schon maskiert, wenn das Mitglied sie nicht freigegeben
 * hat. Die Maskierung gehört in die Datenbank, nicht in die Oberfläche — sonst käme man
 * mit jedem anderen Client an die Daten.
 */
export function useDirectory() {
  return useQuery({
    queryKey: queryKeys.members.directory(),
    queryFn: async (): Promise<DirectoryEntry[]> => {
      const { data, error } = await supabase
        .from('v_members_directory')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Sucht über Namen; leere Eingabe lässt alles durch. Dieselbe Normalisierung wie die
 * globale Suche: „mueller" findet „Müller", die Reihenfolge der Wörter ist egal.
 */
export function searchDirectory(entries: DirectoryEntry[], search: string): DirectoryEntry[] {
  return entries.filter((entry) => matchesSearch([entry.full_name], search));
}
