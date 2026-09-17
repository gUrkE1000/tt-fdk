import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { Enums, Tables, UpdateDto } from '../../lib/database.types';

/**
 * Datenzugriff für Mitglieder — und zugleich die Vorlage für alle weiteren Features.
 *
 * Das Muster:
 *   1. Komponenten importieren Hooks von hier, nie `supabase` direkt. So bleibt der
 *      Datenzugriff an einer Stelle und lässt sich in Tests mit einem Mock ersetzen.
 *   2. Schlüssel kommen aus `lib/queryKeys`, damit das Ungültigmachen nicht rät.
 *   3. Jede Mutation macht am Ende genau die Abfragen ungültig, die sie berührt hat.
 *   4. Fehler werden nicht geschluckt: `throw` landet im `error` des Hooks, die
 *      aufrufende Komponente zeigt einen Toast.
 */

export type Member = Tables<'profiles'>;

export interface MemberFilters {
  search?: string;
  role?: Enums<'user_role'> | null;
  status?: Enums<'member_status'> | null;
  groupId?: string | null;
}

export function useMembers(filters: MemberFilters = {}) {
  return useQuery({
    queryKey: queryKeys.members.list(filters),
    queryFn: async (): Promise<Member[]> => {
      let query = supabase
        .from('profiles')
        .select('*')
        .is('deleted_at', null)
        .order('full_name');

      if (filters.role) query = query.eq('role', filters.role);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.search?.trim()) {
        query = query.ilike('full_name', `%${filters.search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMember(id: string | null) {
  return useQuery({
    queryKey: queryKeys.members.detail(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<Member | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: UpdateDto<'profiles'> }) => {
      const { error } = await supabase.from('profiles').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(variables.id) });
      // Das eigene Profil steckt in der Sitzung und muss ebenfalls neu geladen werden.
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
