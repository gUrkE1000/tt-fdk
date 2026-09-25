import { useMemo } from 'react';
import { CalendarCheck } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useVenues } from '../venues/api';
import {
  SESSION_WINDOW_DAYS,
  useSessionAssignees,
  useSessionCounts,
  useSessionParticipants,
  useTrainingSessions,
  useTrainings,
} from './api';
import SessionCard from './SessionCard';
import { useSessionKeys } from '../keys/api';
import { isMySession } from './schemas';

export interface SessionsTabProps {
  /** Nur die Termine dieses Mitglieds statt aller sichtbaren. */
  onlyMine?: boolean;
}

/**
 * Die nächsten zwei Wochen Training.
 *
 * Welche Termine hier auftauchen, entscheidet die Datenbank: Ein Gast sieht nur offene
 * Trainings, ein Mitglied alle. Die Oberfläche filtert nichts nach, sonst gäbe es zwei
 * Stellen, an denen dieselbe Regel steht.
 */
export default function SessionsTab({ onlyMine = false }: SessionsTabProps) {
  const { profile } = useSession();
  const sessions = useTrainingSessions();
  const trainings = useTrainings();
  const venues = useVenues();
  const members = useMembers();
  const participants = useSessionParticipants();
  const counts = useSessionCounts();
  const sessionKeys = useSessionKeys();
  const assignees = useSessionAssignees();

  // Ohne useMemo wäre `?? []` bei jedem Rendern ein neues Array — und jedes useMemo,
  // das davon abhängt, rechnete jedes Mal neu.
  const trainingList = useMemo(() => trainings.data ?? [], [trainings.data]);
  const venueList = venues.data ?? [];

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const visible = useMemo(() => {
    const rows = sessions.data ?? [];
    if (!onlyMine || !profile?.id) return rows;

    const assigned = new Set(
      (assignees.data ?? [])
        .filter((entry) => entry.profile_id === profile.id)
        .map((entry) => entry.session_id),
    );
    return rows.filter((session) =>
      isMySession(
        session,
        trainingList.find((training) => training.id === session.training_id),
        profile.id,
        assigned,
      ),
    );
  }, [sessions.data, onlyMine, profile?.id, trainingList, assignees.data]);

  const status = queryStatus(sessions, trainings);
  if (status.loading) return <LoadingState />;
  if (status.error) return <ErrorState onRetry={status.retry} />;

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Keine Trainingstermine"
        description={`In den nächsten ${SESSION_WINDOW_DAYS} Tagen steht kein Training an, zu dem du gefragt bist.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((session) => {
        const training = trainingList.find((entry) => entry.id === session.training_id);
        return (
          <SessionCard
            key={session.id}
            session={session}
            training={training}
            venue={venueList.find((venue) => venue.id === training?.venue_id)}
            participants={(participants.data ?? []).filter(
              (entry) => entry.session_id === session.id,
            )}
            counts={(counts.data ?? []).find((entry) => entry.session_id === session.id)}
            profileId={profile?.id ?? null}
            nameOf={nameOf}
            keys={(sessionKeys.data ?? []).find((entry) => entry.session_id === session.id)}
          />
        );
      })}
    </div>
  );
}
