import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { InsertDto, Tables, UpdateDto, ViewRow } from '../../lib/database.types';

export type Poll = Tables<'polls'>;
export type PollOption = Tables<'poll_options'>;
export type PollResult = ViewRow<'v_poll_results'>;
export type PollVoter = ViewRow<'v_poll_voters'>;

export interface PollWithDetails extends Poll {
  teamIds: string[];
  groupIds: string[];
  options: PollOption[];
}

export function usePolls() {
  return useQuery({
    queryKey: queryKeys.polls.list(),
    queryFn: async (): Promise<PollWithDetails[]> => {
      const [polls, targets, options] = await Promise.all([
        supabase.from('polls').select('*').order('created_at', { ascending: false }),
        supabase.from('poll_targets').select('*'),
        supabase.from('poll_options').select('*').order('position'),
      ]);
      if (polls.error) throw polls.error;
      if (targets.error) throw targets.error;
      if (options.error) throw options.error;

      return (polls.data ?? []).map((poll) => ({
        ...poll,
        teamIds: (targets.data ?? [])
          .filter((row) => row.poll_id === poll.id && row.team_id !== null)
          .map((row) => row.team_id as string),
        groupIds: (targets.data ?? [])
          .filter((row) => row.poll_id === poll.id && row.group_id !== null)
          .map((row) => row.group_id as string),
        options: (options.data ?? []).filter((row) => row.poll_id === poll.id),
      }));
    },
  });
}

export function usePollResults() {
  return useQuery({
    queryKey: queryKeys.polls.results(),
    queryFn: async (): Promise<PollResult[]> => {
      const { data, error } = await supabase.from('v_poll_results').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Wer was angekreuzt hat — für den Typ „Personen" und für die eigene Stimme. */
export function usePollVoters() {
  return useQuery({
    queryKey: queryKeys.polls.voters(),
    queryFn: async (): Promise<PollVoter[]> => {
      const { data, error } = await supabase.from('v_poll_voters').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface PollInput {
  poll: InsertDto<'polls'> | UpdateDto<'polls'>;
  teamIds: string[];
  groupIds: string[];
  /** Antworttexte in der gewünschten Reihenfolge. */
  options: string[];
  /**
   * Die Zielgruppe per App/E-Mail auf die neue Umfrage hinweisen. Gilt nur beim
   * Anlegen, und erst nach dem Speichern von Zielen und Antworten — vorher stünde
   * nicht fest, wer gemeint ist.
   */
  announce?: boolean;
}

export function useSavePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: PollInput }) => {
      let pollId = id;

      if (pollId) {
        const { error } = await supabase
          .from('polls')
          .update(input.poll as UpdateDto<'polls'>)
          .eq('id', pollId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('polls')
          .insert(input.poll as InsertDto<'polls'>)
          .select('id')
          .single();
        if (error) throw error;
        pollId = data.id;
      }

      // Ziele und Antworten vollständig ersetzen — wie der Kader einer Mannschaft.
      const dropTargets = await supabase.from('poll_targets').delete().eq('poll_id', pollId);
      if (dropTargets.error) throw dropTargets.error;

      const targets = [
        ...input.teamIds.map((teamId) => ({ poll_id: pollId!, team_id: teamId, group_id: null })),
        ...input.groupIds.map((groupId) => ({
          poll_id: pollId!,
          team_id: null,
          group_id: groupId,
        })),
      ];
      if (targets.length > 0) {
        const { error } = await supabase.from('poll_targets').insert(targets);
        if (error) throw error;
      }

      // Antworten nur beim Anlegen schreiben: Später zu ersetzen würde abgegebene
      // Stimmen mitnehmen, weil sie an der Antwortzeile hängen.
      if (!id) {
        const rows = input.options
          .map((text, index) => ({ poll_id: pollId!, text: text.trim(), position: index }))
          .filter((row) => row.text !== '');

        if (rows.length > 0) {
          const { error } = await supabase.from('poll_options').insert(rows);
          if (error) throw error;
        }

        if (input.announce) {
          const { error } = await supabase.rpc('rpc_announce_poll', { p_poll_id: pollId! });
          if (error) throw error;
        }
      }

      return pollId!;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useVotePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (optionIds: string[]): Promise<{ status: string; max?: number }> => {
      const { data, error } = await supabase.rpc('rpc_vote_poll', { p_option_ids: optionIds });
      if (error) throw error;
      return (data ?? { status: 'unknown' }) as { status: string };
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useRetractPollVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pollId: string): Promise<{ status: string }> => {
      const { data, error } = await supabase.rpc('rpc_retract_poll_vote', { p_poll_id: pollId });
      if (error) throw error;
      return (data ?? { status: 'unknown' }) as { status: string };
    },
    onSuccess: () => invalidate(queryClient),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.open.all });
}
