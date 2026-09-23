import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useMatch, useParticipations, useVolunteers, type MatchRow } from './api';
import { useCanManageMatch } from './canManage';
import GameCard from './GameCard';
import MatchDialogs, { type OpenMatchDialog } from './MatchDialogs';

/**
 * Die Seite eines einzelnen Spiels (`/match/:matchId`).
 *
 * Ziel von Kalender, „Offen für dich" und Übersicht: Wer dort auf ein Spiel tippt,
 * landet bei genau diesem Spiel — mit Rückmeldung, Aufstellung, Nachrichten und für den
 * Mannschaftsführer den Knöpfen zum Verwalten — statt in einer Liste, in der er es erst
 * suchen muss.
 */
export default function MatchPage() {
  const { matchId = null } = useParams<{ matchId: string }>();
  const { profile } = useSession();

  const match = useMatch(matchId);
  const participations = useParticipations(matchId);
  const volunteers = useVolunteers(matchId);
  const teams = useTeams();
  const venues = useVenues();
  const members = useMembers();
  const canManage = useCanManageMatch();
  const [dialog, setDialog] = useState<OpenMatchDialog | null>(null);

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  // Die Karte erwartet die Zahl der Zusagen, die die Listen mitbringen.
  const row = useMemo<MatchRow | null>(() => {
    if (!match.data) return null;
    const confirmedCount = (participations.data ?? []).filter(
      (entry) => entry.response === 'yes' && !entry.removed,
    ).length;
    return { ...match.data, confirmedCount };
  }, [match.data, participations.data]);

  const team = (teams.data ?? []).find((entry) => entry.id === row?.team_id);
  const status = queryStatus(match, participations);

  const back = (
    <Link
      to="/my-games"
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Meine Spiele
    </Link>
  );

  if (status.loading) return <LoadingState rows={1} />;
  if (status.error) return <ErrorState onRetry={status.retry} />;

  if (!row) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={SearchX}
          title="Dieses Spiel gibt es nicht (mehr)"
          description="Vielleicht wurde es gelöscht, oder der Link ist unvollständig."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">{back}</div>
      <PageHeader
        title={`${team?.name ?? 'Mannschaft'} gegen ${row.opponent || 'unbekannt'}`}
        description={row.dtstart ? formatDateTime(row.dtstart) : undefined}
      />

      <GameCard
        match={row}
        team={team}
        venue={(venues.data ?? []).find((venue) => venue.id === row.venue_id)}
        participations={participations.data ?? []}
        volunteers={volunteers.data ?? []}
        nameOf={nameOf}
        profileId={profile?.id ?? null}
        canManage={canManage(row.team_id)}
        onManagePlayers={() => setDialog({ kind: 'manage', match: row })}
        onShareLineup={() => setDialog({ kind: 'share', match: row })}
        onReschedule={() => setDialog({ kind: 'reschedule', match: row })}
      />

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
    </div>
  );
}
