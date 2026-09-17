import type { Enums } from '../../lib/database.types';
import type { Member } from './api';

/**
 * Die Filterleiste der Mitgliederliste als reine Funktion.
 *
 * Bewusst ohne React und ohne Datenzugriff: so lässt sich jede Kombination in
 * Millisekunden durchtesten, und die Liste verhält sich auch dann noch richtig, wenn
 * später Mannschaften (Phase 3) und Trainings (Phase 6) als weitere Dimensionen
 * dazukommen.
 */

export interface MemberFilters {
  search: string;
  role: Enums<'user_role'> | 'all';
  status: Enums<'member_status'> | 'all';
  groupId: string | 'all';
  /** Ab Phase 3 bzw. 6 gefüllt; bis dahin immer „alle". */
  teamId: string | 'all';
  trainingId: string | 'all';
}

export const EMPTY_FILTERS: MemberFilters = {
  search: '',
  role: 'all',
  status: 'all',
  groupId: 'all',
  teamId: 'all',
  trainingId: 'all',
};

export function hasActiveFilters(filters: MemberFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.role !== 'all' ||
    filters.status !== 'all' ||
    filters.groupId !== 'all' ||
    filters.teamId !== 'all' ||
    filters.trainingId !== 'all'
  );
}

export interface FilterContext {
  /** Mitglieds-IDs je Gruppe. */
  groupMembers: Record<string, string[]>;
  teamMembers?: Record<string, string[]>;
  trainingMembers?: Record<string, string[]>;
}

export function filterMembers(
  members: Member[],
  filters: MemberFilters,
  context: FilterContext = { groupMembers: {} },
): Member[] {
  const needle = filters.search.trim().toLowerCase();

  return members.filter((member) => {
    if (needle) {
      // Gesucht wird über Name, E-Mail und Mitgliedsnummer: wer eine Liste abarbeitet,
      // tippt mal das eine, mal das andere.
      const haystack = [member.full_name, member.email, member.member_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (filters.role !== 'all' && member.role !== filters.role) return false;
    if (filters.status !== 'all' && member.status !== filters.status) return false;

    if (filters.groupId !== 'all') {
      const ids = context.groupMembers[filters.groupId] ?? [];
      if (!ids.includes(member.id)) return false;
    }

    if (filters.teamId !== 'all') {
      const ids = context.teamMembers?.[filters.teamId] ?? [];
      if (!ids.includes(member.id)) return false;
    }

    if (filters.trainingId !== 'all') {
      const ids = context.trainingMembers?.[filters.trainingId] ?? [];
      if (!ids.includes(member.id)) return false;
    }

    return true;
  });
}
