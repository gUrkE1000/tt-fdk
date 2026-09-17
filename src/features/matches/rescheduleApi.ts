import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { Tables, ViewRow } from '../../lib/database.types';

export type ReschedulePoll = Tables<'reschedule_polls'>;
export type RescheduleVote = Tables<'reschedule_votes'>;
export type RescheduleResult = ViewRow<'v_reschedule_results'>;

export function useReschedulePolls() {
  return useQuery({
    queryKey: ['reschedule-polls'],
    queryFn: async (): Promise<ReschedulePoll[]> => {
      const { data, error } = await supabase
        .from('reschedule_polls')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRescheduleVotes() {
  return useQuery({
    queryKey: ['reschedule-votes'],
    queryFn: async (): Promise<RescheduleVote[]> => {
      const { data, error } = await supabase.from('reschedule_votes').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRescheduleResults() {
  return useQuery({
    queryKey: ['reschedule-results'],
    queryFn: async (): Promise<RescheduleResult[]> => {
      const { data, error } = await supabase
        .from('v_reschedule_results')
        .select('*')
        .order('option_index');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStartReschedulePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, options }: { matchId: string; options: string[] }) => {
      const { error } = await supabase.rpc('rpc_start_reschedule_poll', {
        p_match_id: matchId,
        p_options: options,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useVoteReschedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionIndex,
      available,
    }: {
      pollId: string;
      optionIndex: number;
      available: boolean;
    }) => {
      const { error } = await supabase.rpc('rpc_vote_reschedule', {
        p_poll_id: pollId,
        p_option_index: optionIndex,
        p_available: available,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useApplyReschedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) => {
      const { error } = await supabase.rpc('rpc_apply_reschedule', {
        p_poll_id: pollId,
        p_option_index: optionIndex,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useCloseReschedulePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const { error } = await supabase.rpc('rpc_close_reschedule_poll', { p_poll_id: pollId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Die laufende oder zuletzt abgeschlossene Umfrage zu einem Spiel. */
export function pollFor(polls: ReschedulePoll[], matchId: string): ReschedulePoll | null {
  const forMatch = polls.filter((poll) => poll.match_id === matchId);
  return forMatch.find((poll) => poll.status === 'open') ?? forMatch[0] ?? null;
}

/** Meine Stimmen zu einer Umfrage, nach Option. */
export function myVotes(
  votes: RescheduleVote[],
  pollId: string,
  profileId: string | null,
): Record<number, boolean> {
  if (!profileId) return {};
  return Object.fromEntries(
    votes
      .filter((vote) => vote.poll_id === pollId && vote.profile_id === profileId)
      .map((vote) => [vote.option_index, vote.available]),
  );
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['reschedule-polls'] });
  void queryClient.invalidateQueries({ queryKey: ['reschedule-votes'] });
  void queryClient.invalidateQueries({ queryKey: ['reschedule-results'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
}
