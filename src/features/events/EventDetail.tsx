import { SearchX } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/dates';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useEventParticipants, useEvents } from './api';
import EventCard from './EventCard';

/**
 * Ein einzelner Vereinstermin, im Blatt über der Seite (`src/app/detail/DetailSheet.tsx`).
 *
 * Ziel des Kalenders und von „Offen für dich": genau dieser Termin mit Beschreibung,
 * Anmeldefrist, Teilnehmern, Gästen und Nachrichten — statt der Liste unter
 * „Mein Verein", in der man ihn erst suchen müsste.
 */
export default function EventDetail({ eventId }: { eventId: string }) {
  const { profile } = useSession();
  const events = useEvents();
  const participants = useEventParticipants();

  const status = queryStatus(events, participants);

  if (status.loading) return <LoadingState rows={1} />;
  if (status.error) return <ErrorState onRetry={status.retry} />;

  const event = (events.data ?? []).find((entry) => entry.id === eventId);

  if (!event) {
    return (
      <EmptyState
        icon={SearchX}
        title="Diesen Vereinstermin gibt es nicht (mehr)"
        description="Vielleicht wurde er gelöscht, oder der Link ist unvollständig."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={event.name}
        description={event.full_day ? formatDate(event.starts_at) : formatDateTime(event.starts_at)}
      />
      <EventCard
        event={event}
        participants={(participants.data ?? []).filter((entry) => entry.event_id === event.id)}
        profileId={profile?.id ?? null}
      />
    </div>
  );
}
