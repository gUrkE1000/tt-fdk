import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  EmptyState,
  FilterBar,
  Select,
  ShowMore,
  ErrorState,
  LoadingState,
  usePaged,
} from '../../components/ui';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useAllParticipations, useAllVolunteers, useMatches } from '../matches/api';
import {
  EMPTY_MATCH_FILTERS,
  filterMatches,
  hasActiveMatchFilters,
  isFinished,
  type MatchFilters,
} from '../matches/filters';
import GameCard from '../matches/GameCard';
import MatchDialogs, { type OpenMatchDialog } from '../matches/MatchDialogs';
import { useCanManageMatch } from '../matches/canManage';
import { useVenueBlockFor } from '../matches/venueBlock';

/**
 * Alle kommenden Spiele des Vereins, nicht nur die eigenen. Dieselben Karten wie unter
 * „Meine Spiele" — wer hier auf Zusage tippt, meldet sich genauso zurück.
 */
export default function ClubGamesTab() {
  const { profile } = useSession();
  const matches = useMatches();
  const teams = useTeams();
  const venues = useVenues();
  const members = useMembers();
  const participations = useAllParticipations();
  const volunteers = useAllVolunteers();

  const [filters, setFilters] = useState<MatchFilters>(EMPTY_MATCH_FILTERS);
  const [dialog, setDialog] = useState<OpenMatchDialog | null>(null);

  // Ohne useMemo wäre `?? []` bei jedem Rendern ein neues Array — und jedes useMemo,
  // das davon abhängt, rechnete jedes Mal neu.
  const teamList = useMemo(() => teams.data ?? [], [teams.data]);
  const venueList = venues.data ?? [];

  const nameOf = useMemo(() => {
    const names = new Map(
      (members.data ?? []).map((member) => [member.id, member.full_name ?? '']),
    );
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const rankingTypes = useMemo(
    () => Object.fromEntries(teamList.map((team) => [team.id, team.ranking_type])),
    [teamList],
  );

  const visible = useMemo(
    () =>
      filterMatches(matches.data ?? [], filters, rankingTypes).filter(
        (match) => match.active && !isFinished(match),
      ),
    [matches.data, filters, rankingTypes],
  );

  const { shown, rest, more } = usePaged(visible, filters);

  // Mannschaftsführer der Mannschaft oder Administrator.
  const canManage = useCanManageMatch();
  const venueBlockFor = useVenueBlockFor();

  const status = queryStatus(matches, participations);

  return (
    <div>
      <FilterBar
        search={filters.search}
        onSearchChange={(search) => setFilters({ ...filters, search })}
        searchPlaceholder="Gegner, Liga oder Halle"
        onReset={() => setFilters(EMPTY_MATCH_FILTERS)}
        resetDisabled={!hasActiveMatchFilters(filters)}
      >
        <Select
          aria-label="Mannschaft"
          value={filters.teamId}
          onChange={(event) => setFilters({ ...filters, teamId: event.target.value })}
          options={[
            { value: 'all', label: 'Alle Mannschaften' },
            ...teamList.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />
        <Select
          aria-label="Spielort"
          value={filters.venueId}
          onChange={(event) => setFilters({ ...filters, venueId: event.target.value })}
          options={[
            { value: 'all', label: 'Alle Spielorte' },
            ...venueList.map((venue) => ({ value: venue.id, label: venue.name })),
          ]}
        />
      </FilterBar>

      {status.loading ? (
        <LoadingState />
      ) : status.error ? (
        <ErrorState onRetry={status.retry} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Keine kommenden Spiele"
          description="Sobald der Spielplan importiert ist, stehen die Termine hier."
        />
      ) : (
        <>
          <div className="space-y-3">
            {shown.map((match) => (
              <GameCard
                key={match.id}
                match={match}
                team={teamList.find((team) => team.id === match.team_id)}
                venue={venueList.find((venue) => venue.id === match.venue_id)}
                participations={(participations.data ?? []).filter(
                  (entry) => entry.match_id === match.id,
                )}
                volunteers={(volunteers.data ?? []).filter((entry) => entry.match_id === match.id)}
                nameOf={nameOf}
                venueBlock={venueBlockFor(match)}
                profileId={profile?.id ?? null}
                canManage={canManage(match.team_id)}
                onManagePlayers={() => setDialog({ kind: 'manage', match })}
                onShareLineup={() => setDialog({ kind: 'share', match })}
                onReschedule={() => setDialog({ kind: 'reschedule', match })}
              />
            ))}
          </div>

          <ShowMore rest={rest} onMore={more} />
        </>
      )}

      <MatchDialogs
        open={dialog}
        onClose={() => setDialog(null)}
        teams={teamList}
        venues={venueList}
        participations={participations.data ?? []}
        volunteers={volunteers.data ?? []}
        members={members.data ?? []}
        nameOf={nameOf}
      />
    </div>
  );
}
