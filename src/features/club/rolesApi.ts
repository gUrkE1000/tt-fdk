import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import type { Tables, ViewRow } from '../../lib/database.types';

/**
 * Ämter (Aufgabe 9.6).
 *
 * **Nicht zu verwechseln mit den Benutzerrollen.** `profiles.role` entscheidet, was
 * jemand darf; ein Amt sagt nur, wen man bei welchem Anliegen anspricht. Deshalb steht
 * es auch in einer eigenen Datei und nicht in `members/api.ts` — die beiden dürfen sich
 * nicht vermischen.
 */

export type ClubRole = Tables<'club_roles'>;
export type ClubRoleMember = ViewRow<'v_club_role_members'>;

export interface ClubRoleWithMembers extends ClubRole {
  memberIds: string[];
  memberNames: string[];
}

export const roleKeys = {
  all: ['club-roles'] as const,
  list: () => ['club-roles', 'list'] as const,
};

export function useClubRoles() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: async (): Promise<ClubRoleWithMembers[]> => {
      const [roles, members] = await Promise.all([
        supabase.from('club_roles').select('*').order('sort_order').order('name'),
        supabase.from('v_club_role_members').select('*').order('full_name'),
      ]);
      if (roles.error) throw roles.error;
      if (members.error) throw members.error;

      return (roles.data ?? []).map((role) => {
        const holders = (members.data ?? []).filter((entry) => entry.role_id === role.id);
        return {
          ...role,
          memberIds: holders.map((entry) => entry.profile_id ?? '').filter(Boolean),
          memberNames: holders.map((entry) => entry.full_name ?? '').filter(Boolean),
        };
      });
    },
  });
}

export interface ClubRoleInput {
  name: string;
  description: string;
  duties: string[];
  sort_order: number;
  memberIds: string[];
}

/**
 * Anlegen oder ändern — inklusive der Inhaber.
 *
 * Die Zuordnung wird ersetzt, nicht ergänzt: Der Dialog zeigt sie vollständig, also ist
 * das, was dort steht, die Wahrheit. Ein Amt, das man nur hinzufügen, aber nie abgeben
 * kann, wäre eine Liste ehemaliger Kassiere.
 */
export function useSaveClubRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: ClubRoleInput }) => {
      const row = {
        name: values.name.trim(),
        description: values.description.trim(),
        duties: values.duties,
        sort_order: values.sort_order,
      };

      let roleId = id;

      if (roleId) {
        const { error } = await supabase.from('club_roles').update(row).eq('id', roleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('club_roles')
          .insert(row)
          .select('id')
          .single();
        if (error) throw error;
        roleId = data.id;
      }

      const { error: clearError } = await supabase
        .from('club_role_members')
        .delete()
        .eq('role_id', roleId);
      if (clearError) throw clearError;

      if (values.memberIds.length > 0) {
        const { error } = await supabase
          .from('club_role_members')
          .insert(values.memberIds.map((profileId) => ({ role_id: roleId!, profile_id: profileId })));
        if (error) throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useDeleteClubRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('club_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

/**
 * „Training organisieren, Pressearbeit" oder eine pro Zeile — beides tippen Leute ein.
 *
 * Als reine Funktion, weil das Feld im Dialog ein Textfeld ist und die Datenbank eine
 * Liste erwartet: Die Umrechnung muss in beide Richtungen zusammenpassen, sonst
 * verschwinden Einträge beim zweiten Öffnen.
 */
export function parseDuties(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export function dutiesToText(duties: readonly string[] | null | undefined): string {
  return (duties ?? []).join('\n');
}
