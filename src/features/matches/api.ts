import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { fetchAll } from '../../lib/fetchAll';
import { queryKeys } from '../../lib/queryKeys';
import type { Enums, InsertDto, Tables, UpdateDto } from '../../lib/database.types';

export type Match = Tables<'matches'>;
export type Participation = Tables<'match_participations'>;
export type Volunteer = Tables<'match_volunteers'>;

/** Ein Spieltermin mit den Zahlen, die die Liste ohne zweite Abfrage braucht. */
export interface MatchRow extends Match {
  confirmedCount: number;
}

export function useMatches() {
  return useQuery({
    queryKey: queryKeys.matches.list(),
    queryFn: async (): Promise<MatchRow[]> => {
      // Beide Listen wachsen mit jeder Saison; eine Saison hat schon über 1000
      // Beteiligungszeilen. Deshalb blättern statt einer Abfrage.
      const [matches, participations] = await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from('matches')
            .select('*', { count: 'exact' })
            .order('dtstart')
            .order('id')
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from('match_participations')
            .select('match_id, profile_id, response, removed', { count: 'exact' })
            .order('match_id')
            .order('profile_id')
            .range(from, to),
        ),
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

/**
 * Alle Beteiligungszeilen auf einmal. Für die Kartenansichten braucht es sie ohnehin zu
 * jedem sichtbaren Spiel; eine Abfrage je Karte wären zwanzig Abfragen für eine Seite.
 */
export function useAllParticipations() {
  return useQuery({
    queryKey: queryKeys.matches.participations('alle'),
    queryFn: async (): Promise<Participation[]> => {
      return fetchAll((from, to) =>
        supabase
          .from('match_participations')
          .select('*', { count: 'exact' })
          .order('match_id')
          .order('profile_id')
          .range(from, to),
      );
    },
  });
}

export function useAllVolunteers() {
  return useQuery({
    queryKey: ['match-volunteers', 'alle'],
    queryFn: async (): Promise<Volunteer[]> => {
      return fetchAll((from, to) =>
        supabase
          .from('match_volunteers')
          .select('*', { count: 'exact' })
          .order('match_id')
          .order('profile_id')
          .range(from, to),
      );
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
    }) => {
      const { error } = await supabase.rpc('rpc_set_match_response', {
        p_match_id: matchId,
        p_response: response,
        p_comment: comment ?? '',
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateMatches(queryClient),
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
}
