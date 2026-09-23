import { useMemo } from 'react';
import { useSession } from '../auth/session';
import { useTeams } from '../teams/api';

/**
 * Wer an einer Spielkarte „Spieler verwalten", „Aufstellung teilen" und
 * „Spielverlegung" bekommt: wer die Mannschaft führt — und der Administrator, der unter
 * „Spieltermine" ohnehin jede Mannschaft verwaltet (RLS: `leads_match` oder
 * `is_admin`). Eine Stelle, damit Karte, „Meine Spiele", „Mein Verein" und
 * „Offen für dich" dieselbe Antwort geben.
 */
export function useCanManageMatch(): (teamId: string | null | undefined) => boolean {
  const { profile, role } = useSession();
  const teams = useTeams();
  const profileId = profile?.id ?? null;

  return useMemo(() => {
    const led = new Set(
      (teams.data ?? [])
        .filter((team) => profileId !== null && team.leaderIds.includes(profileId))
        .map((team) => team.id),
    );
    return (teamId) => Boolean(teamId) && (role === 'admin' || led.has(teamId!));
  }, [teams.data, profileId, role]);
}
