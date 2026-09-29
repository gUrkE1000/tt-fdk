import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PagedList,
  Segmented,
} from '../../components/ui';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useVenueOf } from '../venues/defaultVenue';
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
import { useFocusedId } from '../../app/detail/useDetail';

export interface SessionsTabProps {
  /** Nur die Termine dieses Mitglieds statt aller sichtbaren. */
  onlyMine?: boolean;
  /**
   * Mit Umschalter „Meine Trainings / Alle Trainings", Standard die eigenen — wie im
   * Kalender. Sehen darf jedes Mitglied alle, zu- und absagen nur bei den eigenen.
   */
  switchable?: boolean;
}

/**
 * Die nächsten zwei Wochen Training.
 *
 * Welche Termine hier auftauchen, entscheidet die Datenbank: Ein Gast sieht nur offene
 * Trainings, ein Mitglied alle. Die Oberfläche filtert nichts nach, sonst gäbe es zwei
 * Stellen, an denen dieselbe Regel steht.
 */
export default function SessionsTab({ onlyMine = false, switchable = false }: SessionsTabProps) {
  const { profile } = useSession();
  const [mineChosen, setMineChosen] = useState(true);
  const mineOnly = onlyMine || (switchable && mineChosen);
  const sessions = useTrainingSessions();
  const trainings = useTrainings();
  // Ohne eigenen Ort steht der Standardort da — dort gilt auch eine Hallensperre.
  const venueOf = useVenueOf();
  const members = useMembers();
  const participants = useSessionParticipants();
  const counts = useSessionCounts();
  const sessionKeys = useSessionKeys();
  const assignees = useSessionAssignees();
  // Der Termin aus einer Benachrichtigung soll gezeichnet sein, damit die Seite hinscrollt.
  const focusedId = useFocusedId('training');

  // Ohne useMemo wäre `?? []` bei jedem Rendern ein neues Array — und jedes useMemo,
  // das davon abhängt, rechnete jedes Mal neu.
  const trainingList = useMemo(() => trainings.data ?? [], [trainings.data]);

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const visible = useMemo(() => {
    const rows = sessions.data ?? [];
    if (!mineOnly || !profile?.id) return rows;

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
  }, [sessions.data, mineOnly, profile?.id, trainingList, assignees.data]);

  const status = queryStatus(sessions, trainings);
  if (status.loading) return <LoadingState />;
  if (status.error) return <ErrorState onRetry={status.retry} />;

  const toggle = switchable && (
    <Segmented
      label="Welche Trainings"
      value={mineChosen}
      onChange={setMineChosen}
      options={[
        [true, 'Meine Trainings'],
        [false, 'Alle Trainings'],
      ]}
    />
  );

  if (visible.length === 0) {
    return (
      <div className="space-y-3">
        {toggle}
        <EmptyState
          icon={CalendarCheck}
          title="Keine Trainingstermine"
          description={
            mineOnly
              ? `In den nächsten ${SESSION_WINDOW_DAYS} Tagen steht kein Training an, zu dem du gefragt bist.`
              : `In den nächsten ${SESSION_WINDOW_DAYS} Tagen steht kein Training an.`
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toggle}
      <PagedList
        items={visible}
        resetKey={mineOnly}
        reveal={(session) => session.id === focusedId}
      >
        {(session) => {
          const training = trainingList.find((entry) => entry.id === session.training_id);
          return (
            <SessionCard
              key={session.id}
              session={session}
              training={training}
              venue={venueOf(training?.venue_id)}
              participants={(participants.data ?? []).filter(
                (entry) => entry.session_id === session.id,
              )}
              counts={(counts.data ?? []).find((entry) => entry.session_id === session.id)}
              profileId={profile?.id ?? null}
              nameOf={nameOf}
              keys={(sessionKeys.data ?? []).find((entry) => entry.session_id === session.id)}
            />
          );
        }}
      </PagedList>
    </div>
  );
}
