import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { EmptyState, PageHeader } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import {
  useAllParticipations,
  useAllVolunteers,
  useMatches,
  type MatchRow,
} from './api';
import { isFinished } from './filters';
import GameCard from './GameCard';
import SubstituteBanner from '../substitutes/SubstituteBanner';

type Scope = 'all' | 'home' | 'away';

const CHIPS: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'home', label: 'Heim' },
  { value: 'away', label: 'Auswärts' },
];

/**
 * „Meine Spiele": alle kommenden Termine, an denen ich beteiligt bin — im Kader oder weil
 * mich jemand dazugeholt hat. Vergangene Spiele stehen nicht hier; wer sie sucht, findet
 * sie unter Spieltermine.
 */
export default function MyGamesPage() {
  const { profile } = useSession();
  const matches = useMatches();
  const participations = useAllParticipations();
  const volunteers = useAllVolunteers();
  const teams = useTeams();
  const venues = useVenues();
  const members = useMembers();

  const [scope, setScope] = useState<Scope>('all');

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

    return (matches.data ?? [])
      .filter((match) => myMatchIds.has(match.id))
      .filter((match) => match.active && !isFinished(match))
      .filter((match) =>
        scope === 'all' ? true : scope === 'home' ? match.is_home : !match.is_home,
      );
  }, [matches.data, participations.data, profileId, scope]);

  const leaderTeamIds = useMemo(
    () =>
      new Set(
        (teams.data ?? [])
          .filter((team) => profileId && team.leaderIds.includes(profileId))
          .map((team) => team.id),
      ),
    [teams.data, profileId],
  );

  return (
    <div>
      <PageHeader
        title="Meine Spiele"
        description="Alles, wozu du dich zurückmelden solltest."
      />

      <SubstituteBanner
        describe={(request) => {
          const forMatch = (matches.data ?? []).find((entry) => entry.id === request.match_id);
          if (!forMatch) return 'Ein Spieltermin';
          const team = (teams.data ?? []).find((entry) => entry.id === forMatch.team_id);
          return `${team?.name ?? 'Mannschaft'} gegen ${forMatch.opponent || 'unbekannt'}`;
        }}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={scope === chip.value}
            onClick={() => setScope(chip.value)}
            className={cn(
              'min-h-touch rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              scope === chip.value
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {mine.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Keine offenen Spiele"
          description="Sobald du einer Mannschaft zugeordnet bist und Termine anstehen, erscheinen sie hier."
        />
      ) : (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
