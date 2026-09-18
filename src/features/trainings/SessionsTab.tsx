import { useMemo } from 'react';
import { CalendarCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useVenues } from '../venues/api';
import {
  SESSION_WINDOW_DAYS,
  useSessionCounts,
  useSessionParticipants,
  useTrainingSessions,
  useTrainings,
} from './api';
import SessionCard from './SessionCard';
import { useSessionKeys } from '../keys/api';
import { myTrainingIds } from './schemas';

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

  const trainingList = trainings.data ?? [];
  const venueList = venues.data ?? [];

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const visible = useMemo(() => {
    const rows = sessions.data ?? [];
    if (!onlyMine || !profile?.id) return rows;

    const mine = myTrainingIds(trainingList, profile.id);
    return rows.filter((session) => mine.has(session.training_id));
  }, [sessions.data, onlyMine, profile?.id, trainingList]);

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
