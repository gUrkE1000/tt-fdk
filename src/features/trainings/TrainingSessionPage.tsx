import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useSessionKeys } from '../keys/api';
import { useMembers } from '../members/api';
import { useVenueOf } from '../venues/defaultVenue';
import {
  useSessionCounts,
  useSessionParticipants,
  useTrainingSession,
  useTrainings,
} from './api';
import SessionCard from './SessionCard';

/**
 * Die Seite eines einzelnen Trainingstermins (`/training/:sessionId`).
 *
 * Ziel des Kalenders und von „Offen für dich": Wer dort auf ein Training tippt, landet
 * bei genau diesem Termin — mit Zu-/Absage, Gästen, Bemerkung, Teilnehmern, Schlüssel
 * und Nachrichten — statt in der Trainingsliste unter „Mein Verein".
 */
export default function TrainingSessionPage() {
  const { sessionId = null } = useParams<{ sessionId: string }>();
  const { profile } = useSession();

  const session = useTrainingSession(sessionId);
  const trainings = useTrainings();
  const participants = useSessionParticipants();
  const counts = useSessionCounts();
  // Ohne eigenen Ort steht der Standardort da — dort gilt auch eine Hallensperre.
  const venueOf = useVenueOf();
  const members = useMembers();
  const sessionKeys = useSessionKeys();

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const status = queryStatus(session, trainings);

  const back = (
    <Link
      to="/my-club?tab=trainings"
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Trainings
    </Link>
  );

  if (status.loading) return <LoadingState rows={1} />;
  if (status.error) return <ErrorState onRetry={status.retry} />;

  const row = session.data ?? null;
  const training = (trainings.data ?? []).find((entry) => entry.id === row?.training_id);

  if (!row) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={SearchX}
          title="Diesen Trainingstermin gibt es nicht (mehr)"
          description="Vielleicht wurde er gelöscht, oder der Link ist unvollständig."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">{back}</div>
      <PageHeader title={training?.name ?? 'Training'} description={formatDateTime(row.starts_at)} />

      <SessionCard
        session={row}
        training={training}
        venue={venueOf(training?.venue_id)}
        participants={(participants.data ?? []).filter((entry) => entry.session_id === row.id)}
        counts={(counts.data ?? []).find((entry) => entry.session_id === row.id)}
        profileId={profile?.id ?? null}
        nameOf={nameOf}
        keys={(sessionKeys.data ?? []).find((entry) => entry.session_id === row.id)}
      />
    </div>
  );
}
