import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useAllParticipations, useAllVolunteers, useMatches, type MatchRow } from './api';
import { isFinished } from './filters';
import GameCard from './GameCard';
import RescheduleDialog from './RescheduleDialog';

export type MyGamesScope = 'all' | 'home' | 'away';

export interface MyGamesListProps {
  scope?: MyGamesScope;
  /** Höchstens so viele Karten — für die Übersicht, die nicht die ganze Saison zeigt. */
  limit?: number;
  empty?: { title: string; description: string };
}

/**
 * Die eigenen kommenden Spiele als Karten.
 *
 * Steht als eigene Komponente da, weil „Meine Spiele" und der Reiter „Spiele" der Übersicht
 * dieselbe Liste zeigen. Zwei Abschriften wären zwei Stellen, an denen künftig entschieden
 * wird, was „mein Spiel" heißt.
 */
export default function MyGamesList({ scope = 'all', limit, empty }: MyGamesListProps) {
  const { profile } = useSession();
  const matches = useMatches();
  const participations = useAllParticipations();
  const volunteers = useAllVolunteers();
  const teams = useTeams();
  const venues = useVenues();
  const members = useMembers();

  const [rescheduling, setRescheduling] = useState<MatchRow | null>(null);

  const profileId = profile?.id ?? null;

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const mine = useMemo(() => {
    if (!profileId) return [] as MatchRow[];

    const myMatchIds = new Set(
      (participations.data ?? [])
        .filter((entry) => entry.profile_id === profileId)
        .map((entry) => entry.match_id),
    );

    const rows = (matches.data ?? [])
      .filter((match) => myMatchIds.has(match.id))
      .filter((match) => match.active && !isFinished(match))
      .filter((match) =>
        scope === 'all' ? true : scope === 'home' ? match.is_home : !match.is_home,
      );

    return limit === undefined ? rows : rows.slice(0, limit);
  }, [matches.data, participations.data, profileId, scope, limit]);

  const leaderTeamIds = useMemo(
    () =>
      new Set(
        (teams.data ?? [])
          .filter((team) => profileId && team.leaderIds.includes(profileId))
          .map((team) => team.id),
      ),
    [teams.data, profileId],
  );

  if (mine.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={empty?.title ?? 'Keine offenen Spiele'}
        description={
          empty?.description ??
          'Sobald du einer Mannschaft zugeordnet bist und Termine anstehen, erscheinen sie hier.'
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {mine.map((match) => (
          <GameCard
            key={match.id}
            match={match}
            team={(teams.data ?? []).find((team) => team.id === match.team_id)}
            venue={(venues.data ?? []).find((venue) => venue.id === match.venue_id)}
            participations={(participations.data ?? []).filter(
              (entry) => entry.match_id === match.id,
            )}
            volunteers={(volunteers.data ?? []).filter((entry) => entry.match_id === match.id)}
            nameOf={nameOf}
            profileId={profileId}
            canManage={leaderTeamIds.has(match.team_id)}
            onReschedule={() => setRescheduling(match)}
          />
        ))}
      </div>

      <RescheduleDialog
        open={rescheduling !== null}
        onOpenChange={(next) => !next && setRescheduling(null)}
        match={rescheduling}
      />
    </>
  );
}
