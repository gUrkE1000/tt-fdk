import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { fetchAll } from '../../lib/fetchAll';
import { queryKeys } from '../../lib/queryKeys';
import { applyOptimistic, dropOpenItem, optimisticUpdate } from '../../lib/optimistic';
import type { Enums, InsertDto, Tables, UpdateDto } from '../../lib/database.types';

export type Match = Tables<'matches'>;
export type Participation = Tables<'match_participations'>;
export type Volunteer = Tables<'match_volunteers'>;

/** Ein Spieltermin mit den Zahlen, die die Liste ohne zweite Abfrage braucht. */
export interface MatchRow extends Match {
  confirmedCount: number;
}

/**
 * Welche Spiele eine Liste braucht.
 *
 * `recent` (Voreinstellung): ab {@link RECENT_MATCH_DAYS} Tagen zurück — alles, was
 * Übersicht, „Meine Spiele", der Kalender der Mannschaft und die Aufstellung brauchen.
 * `all`: die ganze Historie, nur für „Spieltermine → Beendete" und „Vergangene".
 *
 * Früher lud jede Seite alle Spiele und alle Rückmeldungen seit Beginn — Jahr für Jahr
 * mehr, auf dem Handy im Mobilnetz spürbar. Gefiltert wird in der Datenbank, nicht
 * erst hier.
 */
export type MatchScope = 'recent' | 'all';

export const RECENT_MATCH_DAYS = 30;

/** Beginn des Fensters für `recent`, als ISO-Zeitpunkt. */
export function recentSince(now: Date = new Date()): string {
  return new Date(now.getTime() - RECENT_MATCH_DAYS * 86_400_000).toISOString();
}

export function useMatches(scope: MatchScope = 'recent') {
  return useQuery({
    queryKey: queryKeys.matches.list(scope),
    queryFn: async (): Promise<MatchRow[]> => {
      const since = scope === 'recent' ? recentSince() : null;

      // Beide Listen wachsen mit jeder Saison; eine Saison hat schon über 1000
      // Beteiligungszeilen. Deshalb blättern statt einer Abfrage.
      const [matches, participations] = await Promise.all([
        fetchAll((from, to) => {
          let query = supabase.from('matches').select('*', { count: 'exact' });
          if (since) query = query.gte('dtstart', since);
          return query.order('dtstart').order('id').range(from, to);
        }),
        fetchAll((from, to) => {
          // `matches!inner` filtert die Rückmeldungen über das Datum ihres Spiels —
          // die Tabelle selbst kennt kein Datum.
          let query = supabase
            .from('match_participations')
            .select('match_id, profile_id, response, removed, matches!inner(dtstart)', {
              count: 'exact',
            });
          if (since) query = query.gte('matches.dtstart', since);
          return query.order('match_id').order('profile_id').range(from, to);
        }),
      ]);

      const confirmed = new Map<string, number>();
      for (const row of participations) {
        if (row.response !== 'yes' || row.removed) continue;
        confirmed.set(row.match_id, (confirmed.get(row.match_id) ?? 0) + 1);
      }

      return matches.map((match) => ({
        ...match,
        confirmedCount: confirmed.get(match.id) ?? 0,
      }));
    },
  });
}

/** Entfernt das eingebettete Spiel, das nur zum Filtern mitkam. */
function withoutEmbedded<T extends { matches?: unknown }>(rows: T[]): Omit<T, 'matches'>[] {
  return rows.map(({ matches: _matches, ...rest }) => rest);
}

/**
 * Alle Beteiligungszeilen im Fenster auf einmal. Für die Kartenansichten braucht es sie
 * ohnehin zu jedem sichtbaren Spiel; eine Abfrage je Karte wären zwanzig Abfragen für
 * eine Seite.
 */
export function useAllParticipations(scope: MatchScope = 'recent') {
  return useQuery({
    queryKey: queryKeys.matches.participations(scope === 'all' ? 'alle' : 'aktuell'),
    queryFn: async (): Promise<Participation[]> => {
      const since = scope === 'recent' ? recentSince() : null;
      const rows = await fetchAll((from, to) => {
        let query = supabase
          .from('match_participations')
          .select('*, matches!inner(dtstart)', { count: 'exact' });
        if (since) query = query.gte('matches.dtstart', since);
        return query.order('match_id').order('profile_id').range(from, to);
      });
      return withoutEmbedded(rows) as Participation[];
    },
  });
}

export function useAllVolunteers(scope: MatchScope = 'recent') {
  return useQuery({
    queryKey: ['match-volunteers', scope === 'all' ? 'alle' : 'aktuell'],
    queryFn: async (): Promise<Volunteer[]> => {
      const since = scope === 'recent' ? recentSince() : null;
      const rows = await fetchAll((from, to) => {
        let query = supabase
          .from('match_volunteers')
          .select('*, matches!inner(dtstart)', { count: 'exact' });
        if (since) query = query.gte('matches.dtstart', since);
        return query.order('match_id').order('profile_id').range(from, to);
      });
      return withoutEmbedded(rows) as Volunteer[];
    },
  });
}

export function useParticipations(matchId: string | null) {
  return useQuery({
    queryKey: queryKeys.matches.participations(matchId ?? ''),
    enabled: matchId !== null,
    queryFn: async (): Promise<Participation[]> => {
      const { data, error } = await supabase
        .from('match_participations')
        .select('*')
        .eq('match_id', matchId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'matches'>) => {
      const { error } = await supabase.from('matches').insert(values);
      if (error) throw error;
    },
    onSuccess: () => invalidateMatches(queryClient),
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'matches'> }) => {
      const { error } = await supabase.from('matches').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMatches(queryClient),
  });
}

export function useDeleteMatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('matches').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => invalidateMatches(queryClient),
  });
}

/**
 * Die eigene Rückmeldung. Geht über die Datenbankfunktion, nicht über ein UPDATE: dort
 * hängen Rechteprüfung, Meldeschluss, Protokoll und die Neuberechnung der Aufstellung
 * daran. Ein direkter Schreibzugriff auf `match_participations` ist ohnehin für niemanden
 * erlaubt.
 */
export function useSetResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      response,
      comment,
    }: {
      matchId: string;
      response: Enums<'participation_response'>;
      comment?: string;
      /** Wer antwortet — nur für die sofortige Anzeige; der Server nimmt die Sitzung. */
      profileId?: string | null;
    }) => {
      const { error } = await supabase.rpc('rpc_set_match_response', {
        p_match_id: matchId,
        p_response: response,
        p_comment: comment ?? '',
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ matchId, response, comment, profileId }) => {
      // Die aktuelle Fassung des Spiels, damit die sofort gezeigte Antwort nicht als
      // „veraltet" markiert wird.
      const version =
        queryClient
          .getQueriesData<MatchRow[]>({ queryKey: [...queryKeys.matches.all, 'list'] })
          .flatMap(([, rows]) => rows ?? [])
          .find((match) => match.id === matchId)?.version ?? 1;

      const rollback = await applyOptimistic(queryClient, [
        optimisticUpdate<Participation[]>({
          queryKey: [...queryKeys.matches.all, 'participations'],
          update: (rows) =>
            rows.map((row) =>
              row.match_id === matchId && row.profile_id === profileId
                ? {
                    ...row,
                    response,
                    comment: comment ?? row.comment,
                    version_responded: version,
                  }
                : row,
            ),
        }),
        dropOpenItem('match', matchId),
      ]);
      return { rollback };
    },
    onError: (_error, _vars, context) => context?.rollback(),
    onSettled: () => invalidateMatches(queryClient),
  });
}

export function useManagePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      profileId,
      action,
    }: {
      matchId: string;
      profileId: string;
      action: 'add' | 'remove' | 'decline' | 'reset';
    }) => {
      const { error } = await supabase.rpc('rpc_manage_player', {
        p_match_id: matchId,
        p_profile_id: profileId,
        p_action: action,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateMatches(queryClient),
  });
}

export function useSetLineup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, order }: { matchId: string; order: string[] }) => {
      const { error } = await supabase.rpc('rpc_set_lineup', {
        p_match_id: matchId,
        p_positions: order.map((profileId, index) => ({
          profile_id: profileId,
          position: index + 1,
        })),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateMatches(queryClient),
  });
}

export function useUnlockLineup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc('rpc_unlock_lineup', { p_match_id: matchId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateMatches(queryClient),
  });
}

/**
 * Die Aufstellung per E-Mail an die Aufgestellten. Der Text kommt aus dem Dialog, weil er
 * dort ohnehin steht und der Mannschaftsführer ihn vor dem Versand ändern können soll.
 */
export function useShareLineupByEmail() {
  return useMutation({
    mutationFn: async ({ matchId, text }: { matchId: string; text: string }): Promise<number> => {
      const { data, error } = await supabase.rpc('rpc_share_lineup', {
        p_match_id: matchId,
        p_text: text,
      });
      if (error) throw new Error(error.message);
      return (data as number | null) ?? 0;
    },
  });
}

export function useVolunteers(matchId: string | null) {
  return useQuery({
    queryKey: ['match-volunteers', matchId],
    enabled: matchId !== null,
    queryFn: async (): Promise<Volunteer[]> => {
      const { data, error } = await supabase
        .from('match_volunteers')
        .select('*')
        .eq('match_id', matchId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleVolunteer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      profileId,
      kind,
      on,
    }: {
      matchId: string;
      profileId: string;
      kind: Enums<'volunteer_kind'>;
      on: boolean;
    }) => {
      if (on) {
        const { error } = await supabase
          .from('match_volunteers')
          .insert({ match_id: matchId, profile_id: profileId, kind });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('match_volunteers')
          .delete()
          .eq('match_id', matchId)
          .eq('profile_id', profileId)
          .eq('kind', kind);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['match-volunteers'] });
    },
  });
}

function invalidateMatches(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
  // Eine Rückmeldung ändert auch „Meine Termine", den Kalender und „Offen für dich".
  void queryClient.invalidateQueries({ queryKey: queryKeys.open.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
}
