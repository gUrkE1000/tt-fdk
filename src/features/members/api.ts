import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { Enums, InsertDto, Tables, UpdateDto } from '../../lib/database.types';

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
 *
 * Gefiltert wird bewusst im Browser (`filterMembers`), nicht in der Datenbank: ein
 * Verein hat Dutzende bis wenige Hundert Mitglieder, die Liste liegt ohnehin komplett
 * vor, und jeder Tastendruck im Suchfeld spart so eine Anfrage.
 */

export type Member = Tables<'profiles'>;
export type MemberRanking = Tables<'member_rankings'>;
export type Group = Tables<'groups'>;
export type RankingType = Enums<'ranking_type'>;

/**
 * Was jedes Mitglied über andere lesen darf. Kontaktdaten, Geburtstag und persönliche
 * Einstellungen gehören nicht dazu: Die Datenbank gibt diese Spalten über `profiles`
 * gar nicht mehr her (Spaltenrechte). Wer sie braucht, nimmt das Verzeichnis
 * (`v_members_directory`, mit Freigabe) oder – als Admin – `useAdminMembers`.
 */
export const MEMBER_SUMMARY_COLUMNS =
  'id, first_name, last_name, full_name, gender, member_number, role, status, no_games, qttr, contact_visible, hide_birthday, auth_linked_at, deleted_at, created_at, updated_at';

export type MemberSummary = Pick<
  Member,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'gender'
  | 'member_number'
  | 'role'
  | 'status'
  | 'no_games'
  | 'qttr'
  | 'contact_visible'
  | 'hide_birthday'
  | 'auth_linked_at'
  | 'deleted_at'
  | 'created_at'
  | 'updated_at'
>;

// ---------------------------------------------------------------- Lesen

/** Die Mitgliederliste für alle Seiten außer der Verwaltung – ohne Kontaktdaten. */
export function useMembers(options: { includeDeleted?: boolean } = {}) {
  const includeDeleted = options.includeDeleted ?? false;

  return useQuery({
    queryKey: queryKeys.members.list({ includeDeleted }),
    queryFn: async (): Promise<MemberSummary[]> => {
      let query = supabase.from('profiles').select(MEMBER_SUMMARY_COLUMNS).order('full_name');
      if (!includeDeleted) query = query.is('deleted_at', null);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MemberSummary[];
    },
  });
}

/** Alle Profile mit allen Spalten – nur für Administratoren (die Datenbank prüft das). */
async function fetchAdminMembers(): Promise<Member[]> {
  const { data, error } = await supabase.rpc('rpc_admin_members');
  if (error) throw error;
  return ((data ?? []) as Member[]).sort((a, b) =>
    (a.full_name ?? '').localeCompare(b.full_name ?? '', 'de'),
  );
}

export function useAdminMembers(options: { includeDeleted?: boolean } = {}) {
  const includeDeleted = options.includeDeleted ?? false;

  return useQuery({
    queryKey: queryKeys.members.adminList({ includeDeleted }),
    queryFn: async (): Promise<Member[]> => {
      const rows = await fetchAdminMembers();
      return includeDeleted ? rows : rows.filter((row) => row.deleted_at === null);
    },
  });
}

export function useMember(id: string | null) {
  return useQuery({
    queryKey: queryKeys.members.detail(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<Member | null> => {
      const rows = await fetchAdminMembers();
      return rows.find((row) => row.id === id) ?? null;
    },
  });
}

/** Alle Ränge auf einmal: die Mitgliederliste zeigt sie in einer Spalte. */
export function useRankings() {
  return useQuery({
    queryKey: queryKeys.members.rankings(),
    queryFn: async (): Promise<MemberRanking[]> => {
      const { data, error } = await supabase.from('member_rankings').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface GroupWithMembers extends Group {
  memberIds: string[];
}

export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: async (): Promise<GroupWithMembers[]> => {
      const [groups, links] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('group_members').select('*'),
      ]);
      if (groups.error) throw groups.error;
      if (links.error) throw links.error;

      return (groups.data ?? []).map((group) => ({
        ...group,
        memberIds: (links.data ?? [])
          .filter((link) => link.group_id === group.id)
          .map((link) => link.profile_id),
      }));
    },
  });
}

// ---------------------------------------------------------------- Schreiben

export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: InsertDto<'profiles'>): Promise<string> => {
      const { data, error } = await supabase
        .from('profiles')
        .insert(values)
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidateMembers(queryClient),
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
      invalidateMembers(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(variables.id) });
    },
  });
}

/** Löschen heißt hier: `deleted_at` setzen. Die Historie bleibt auswertbar. */
export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMembers(queryClient),
  });
}

export function useActivateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('rpc_activate_member', { p_profile_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateMembers(queryClient),
  });
}

export interface RankingInput {
  type: RankingType;
  teamNumber: number;
  positionNumber: number;
}

/**
 * Ränge eines Mitglieds vollständig ersetzen. Erst löschen, dann schreiben: so
 * verschwinden entfernte Altersklassen, ohne dass der Aufrufer sie aufzählen muss.
 */
export function useSaveRankings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, rankings }: { profileId: string; rankings: RankingInput[] }) => {
      const remove = await supabase.from('member_rankings').delete().eq('profile_id', profileId);
      if (remove.error) throw remove.error;

      if (rankings.length === 0) return;

      const insert = await supabase.from('member_rankings').insert(
        rankings.map((ranking) => ({
          profile_id: profileId,
          ranking_type: ranking.type,
          team_number: ranking.teamNumber,
          position_number: ranking.positionNumber,
        })),
      );
      if (insert.error) throw insert.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members.rankings() });
    },
  });
}

export function useBulkUpdateQttr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: { id: string; qttr: number | null }[]): Promise<number> => {
      const { data, error } = await supabase.rpc('rpc_update_qttr_bulk', { p_values: values });
      if (error) throw new Error(error.message);
      return (data as number | null) ?? 0;
    },
    onSuccess: () => invalidateMembers(queryClient),
  });
}

// ---------------------------------------------------------------- Gruppen

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('groups').insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

export function useRenameGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('groups').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

/** Zuordnung einer Gruppe vollständig ersetzen — gleiche Begründung wie bei den Rängen. */
export function useSetGroupMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, memberIds }: { groupId: string; memberIds: string[] }) => {
      const remove = await supabase.from('group_members').delete().eq('group_id', groupId);
      if (remove.error) throw remove.error;

      if (memberIds.length === 0) return;

      const insert = await supabase
        .from('group_members')
        .insert(memberIds.map((profileId) => ({ group_id: groupId, profile_id: profileId })));
      if (insert.error) throw insert.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

function invalidateMembers(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
  // Das eigene Profil steckt in der Sitzung und muss ebenfalls neu geladen werden.
  void queryClient.invalidateQueries({ queryKey: ['profile'] });
}
