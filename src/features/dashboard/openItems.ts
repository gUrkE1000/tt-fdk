import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { ViewRow } from '../../lib/database.types';
import { pendingForMe, useSubstituteRequests } from '../substitutes/api';

/**
 * „Offen für dich": alles, wo die eigene Antwort noch fehlt.
 *
 * Was „offen" heißt, entscheidet die Datenbank — `v_open_participations` ist dieselbe
 * Sicht, aus der die tägliche Sammelerinnerung ihre Liste bekommt, und
 * `v_my_open_polls` prüft Zielgruppe und eigene Stimme. Die Oberfläche setzt nur
 * zusammen und sortiert.
 */

export type OpenKind = 'match' | 'training' | 'event' | 'poll';

export interface OpenItem {
  kind: OpenKind;
  id: string;
  /** Beginn des Termins; bei einer Umfrage ihr Ablauf (kann fehlen). */
  date: string | null;
  title: string;
}

type OpenParticipationRow = Pick<
  ViewRow<'v_open_participations'>,
  'kind' | 'id' | 'starts_at' | 'title'
>;
type OpenPollRow = Pick<ViewRow<'v_my_open_polls'>, 'id' | 'title' | 'expires_at'>;

const KINDS: readonly string[] = ['match', 'training', 'event'];

/**
 * Termine nach Datum, Umfragen dahinter — eine Umfrage ohne Ablauf drängt nicht, ein
 * Spiel übermorgen schon. Umfragen mit Ablauf untereinander nach Ablauf.
 */
export function buildOpenItems(
  participations: OpenParticipationRow[],
  polls: OpenPollRow[],
): OpenItem[] {
  const dates: OpenItem[] = participations
    .filter((row) => row.id && row.kind && KINDS.includes(row.kind))
    .map((row) => ({
      kind: row.kind as OpenKind,
      id: row.id!,
      date: row.starts_at,
      title: row.title ?? '',
    }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const openPolls: OpenItem[] = polls
    .filter((row) => row.id)
    .map((row) => ({ kind: 'poll' as const, id: row.id!, date: row.expires_at, title: row.title ?? '' }))
    .sort((a, b) => {
      if (a.date === b.date) return a.title.localeCompare(b.title);
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date.localeCompare(b.date);
    });

  return [...dates, ...openPolls];
}

export function useMyOpenItems(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.open.mine(profileId),
    enabled: profileId !== null,
    queryFn: async (): Promise<OpenItem[]> => {
      const [participations, polls] = await Promise.all([
        supabase
          .from('v_open_participations')
          .select('kind, id, starts_at, title')
          .eq('profile_id', profileId!)
          .order('starts_at'),
        supabase.from('v_my_open_polls').select('id, title, expires_at'),
      ]);
      if (participations.error) throw participations.error;
      if (polls.error) throw polls.error;
      return buildOpenItems(participations.data ?? [], polls.data ?? []);
    },
  });
}

/**
 * Die Zahl für die Navigation und die Kachel: offene Rückmeldungen plus
 * Ersatzanfragen an mich. Die Ersatzanfragen stehen nicht in der Liste selbst, sondern
 * als eigener Hinweis darüber — sie haben eine Frist und sind deshalb dringender.
 */
export function useOpenCount(profileId: string | null): number {
  const items = useMyOpenItems(profileId);
  const requests = useSubstituteRequests();
  return (items.data?.length ?? 0) + pendingForMe(requests.data ?? [], profileId).length;
}
