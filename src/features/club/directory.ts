import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { ViewRow } from '../../lib/database.types';

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

/** Sucht über Namen; leere Eingabe lässt alles durch. */
export function searchDirectory(entries: DirectoryEntry[], search: string): DirectoryEntry[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => (entry.full_name ?? '').toLowerCase().includes(needle));
}

/** Ansprechpartner: Admins, Trainer und Mannschaftsführer, in dieser Reihenfolge. */
const CONTACT_ORDER = ['admin', 'trainer', 'team_leader'] as const;

export function contactPeople(entries: DirectoryEntry[]): DirectoryEntry[] {
  return entries
    .filter((entry) => CONTACT_ORDER.includes(entry.role as (typeof CONTACT_ORDER)[number]))
    .sort((a, b) => {
      const byRole =
        CONTACT_ORDER.indexOf(a.role as (typeof CONTACT_ORDER)[number]) -
        CONTACT_ORDER.indexOf(b.role as (typeof CONTACT_ORDER)[number]);
      if (byRole !== 0) return byRole;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'de');
    });
}
