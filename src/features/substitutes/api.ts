import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { ViewRow } from '../../lib/database.types';

export type SubstituteRequest = ViewRow<'v_substitute_requests'>;

/**
 * Ersatzanfragen. Gelesen wird die View: sie bringt den Namen und die Angabe mit,
 * ob die Anfrage noch zur aktuellen Fassung des Termins gehört — beides braucht die
 * Oberfläche, und beides aus zwei Abfragen zusammenzusetzen wäre unnötig.
 */
export function useSubstituteRequests() {
  return useQuery({
    queryKey: ['substitute-requests'],
    queryFn: async (): Promise<SubstituteRequest[]> => {
      const { data, error } = await supabase
        .from('v_substitute_requests')
        .select('*')
        .order('rank');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSubstituteRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, profileId }: { matchId: string; profileId: string }) => {
      const { error } = await supabase.rpc('rpc_create_substitute_request', {
        p_match_id: matchId,
        p_profile_id: profileId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useCancelSubstituteRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('rpc_cancel_substitute_request', {
        p_request_id: requestId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useAnswerSubstituteRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      answer,
    }: {
      requestId: string;
      answer: 'yes' | 'no';
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('rpc_answer_substitute_request', {
        p_request_id: requestId,
        p_answer: answer,
      });
      if (error) throw new Error(error.message);
      return ((data as { status?: string } | null)?.status ?? 'error');
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Die offenen Anfragen an mich — Grundlage des Banners auf der Startseite. */
export function pendingForMe(
  requests: SubstituteRequest[],
  profileId: string | null,
): SubstituteRequest[] {
  if (!profileId) return [];
  return requests.filter(
    (request) =>
      request.profile_id === profileId &&
      request.status === 'pending' &&
      request.current_version === true &&
      new Date(request.expires_at ?? 0) > new Date(),
  );
}

/** Die Kette zu einem Spiel, in der Reihenfolge, in der gefragt wurde. */
export function chainFor(requests: SubstituteRequest[], matchId: string): SubstituteRequest[] {
  return requests
    .filter((request) => request.match_id === matchId && request.current_version === true)
    .sort((a, b) => {
      const byRank = (a.rank ?? 99) - (b.rank ?? 99);
      if (byRank !== 0) return byRank;
      return (a.requested_at ?? '').localeCompare(b.requested_at ?? '');
    });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['substitute-requests'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.open.all });
}
