import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useAllParticipations, useAllVolunteers, useMatches, type MatchRow } from './api';
import { isFinished } from './filters';
import GameCard from './GameCard';
import MatchDialogs, { type OpenMatchDialog } from './MatchDialogs';
import { useCanManageMatch } from './canManage';

export type MyGamesScope = 'all' | 'home' | 'away' | 'past';

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
  // Vergangene Spiele reichen weiter zurück als das Standardfenster.
  const range = scope === 'past' ? 'all' : 'recent';
  const matches = useMatches(range);
  const participations = useAllParticipations(range);
  const volunteers = useAllVolunteers(range);
  const teams = useTeams();
  const venues = useVenues();
  const members = useMembers();

  const [dialog, setDialog] = useState<OpenMatchDialog | null>(null);

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

    // Vergangene Spiele: die letzten zuerst — wer sie sucht, will meist das von
    // letzter Woche, nicht das vom Saisonbeginn.
    if (scope === 'past') {
      const past = (matches.data ?? [])
        .filter((match) => myMatchIds.has(match.id) && match.active && isFinished(match))
        .sort((a, b) => (b.dtstart ?? '').localeCompare(a.dtstart ?? ''));
      return limit === undefined ? past : past.slice(0, limit);
    }

    const rows = (matches.data ?? [])
      .filter((match) => myMatchIds.has(match.id))
      .filter((match) => match.active && !isFinished(match))
      .filter((match) =>
        scope === 'all' ? true : scope === 'home' ? match.is_home : !match.is_home,
      );

    return limit === undefined ? rows : rows.slice(0, limit);
  }, [matches.data, participations.data, profileId, scope, limit]);

  // Mannschaftsführer der Mannschaft oder Administrator.
  const canManage = useCanManageMatch();

  const status = queryStatus(matches, participations);
  if (status.loading) return <LoadingState rows={limit ? Math.min(limit, 3) : 3} />;
  if (status.error) return <ErrorState onRetry={status.retry} />;

  if (mine.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={empty?.title ?? (scope === 'past' ? 'Noch keine vergangenen Spiele' : 'Keine offenen Spiele')}
        description={
          empty?.description ??
          (scope === 'past'
            ? 'Hier stehen die Spiele, an denen du beteiligt warst, sobald sie vorbei sind.'
            : 'Sobald du einer Mannschaft zugeordnet bist und Termine anstehen, erscheinen sie hier.')
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
            canManage={canManage(match.team_id)}
            onManagePlayers={() => setDialog({ kind: 'manage', match })}
            onShareLineup={() => setDialog({ kind: 'share', match })}
            onReschedule={() => setDialog({ kind: 'reschedule', match })}
          />
        ))}
      </div>

      <MatchDialogs
        open={dialog}
        onClose={() => setDialog(null)}
        teams={teams.data ?? []}
        venues={venues.data ?? []}
        participations={participations.data ?? []}
        volunteers={volunteers.data ?? []}
        members={members.data ?? []}
        nameOf={nameOf}
      />
    </>
  );
}
