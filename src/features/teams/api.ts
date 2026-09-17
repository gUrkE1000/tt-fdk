import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { InsertDto, Tables, UpdateDto } from '../../lib/database.types';

export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;

export interface TeamWithRoster extends Team {
  leaderIds: string[];
  /** Stammspieler, in der Reihenfolge ihrer Ränge nicht garantiert — die macht die Datenbank. */
  regularIds: string[];
  /** Ersatzspieler in der Reihenfolge ihres Rangs: Position 0 wird zuerst gefragt. */
  substituteIds: string[];
}

/**
 * Mannschaften mit Kader. Drei Abfragen statt eines verschachtelten `select`, weil die
 * Zuordnung in eigenen Tabellen steht und die Listen klein sind — ein Verein hat
 * Mannschaften im einstelligen Bereich.
 */
export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams.list(),
    queryFn: async (): Promise<TeamWithRoster[]> => {
      const [teams, leaders, members] = await Promise.all([
        supabase.from('teams').select('*').order('sort_order').order('name'),
        supabase.from('team_leaders').select('*'),
        supabase.from('team_members').select('*'),
      ]);
      if (teams.error) throw teams.error;
      if (leaders.error) throw leaders.error;
      if (members.error) throw members.error;

      return (teams.data ?? []).map((team) => {
        const roster = (members.data ?? []).filter((row) => row.team_id === team.id);

        return {
          ...team,
          leaderIds: (leaders.data ?? [])
            .filter((row) => row.team_id === team.id)
            .map((row) => row.profile_id),
          regularIds: roster.filter((row) => row.kind === 'regular').map((row) => row.profile_id),
          substituteIds: roster
            .filter((row) => row.kind === 'substitute')
            .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
            .map((row) => row.profile_id),
        };
      });
    },
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'teams'>): Promise<string> => {
      const { data, error } = await supabase.from('teams').insert(values).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidateTeams(queryClient),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'teams'> }) => {
      const { error } = await supabase.from('teams').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateTeams(queryClient),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateTeams(queryClient),
  });
}

export interface RosterInput {
  teamId: string;
  leaderIds: string[];
  regularIds: string[];
  /** Reihenfolge ist die Aussage: Index 0 bekommt Ersatzrang 1. */
  substituteIds: string[];
}

/**
 * Kader vollständig ersetzen.
 *
 * Erst löschen, dann schreiben — und zwar in einer festen Reihenfolge: zuerst alle alten
 * Zeilen weg, dann die neuen. Sonst stolpert der Trigger, der nicht mehr Stammspieler als
 * Mannschaftsgröße zulässt, über einen Zwischenstand, in dem alte und neue Spieler
 * gleichzeitig eingetragen sind.
 */
export function useSaveRoster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RosterInput) => {
      const dropLeaders = await supabase
        .from('team_leaders')
        .delete()
        .eq('team_id', input.teamId);
      if (dropLeaders.error) throw dropLeaders.error;

      const dropMembers = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', input.teamId);
      if (dropMembers.error) throw dropMembers.error;

      if (input.leaderIds.length > 0) {
        const { error } = await supabase
          .from('team_leaders')
          .insert(input.leaderIds.map((id) => ({ team_id: input.teamId, profile_id: id })));
        if (error) throw error;
      }

      const rows = [
        ...input.regularIds.map((id) => ({
          team_id: input.teamId,
          profile_id: id,
          kind: 'regular' as const,
          rank: null,
        })),
        ...input.substituteIds.map((id, index) => ({
          team_id: input.teamId,
          profile_id: id,
          kind: 'substitute' as const,
          rank: index + 1,
        })),
      ];

      if (rows.length > 0) {
        const { error } = await supabase.from('team_members').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateTeams(queryClient),
  });
}

function invalidateTeams(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
}
