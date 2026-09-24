import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/dates';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useEventParticipants, useEvents } from './api';
import EventCard from './EventCard';

/**
 * Die Seite eines einzelnen Vereinstermins (`/event/:eventId`).
 *
 * Ziel des Kalenders und von „Offen für dich": genau dieser Termin mit Beschreibung,
 * Anmeldefrist, Teilnehmern, Gästen und Nachrichten — statt der Liste unter
 * „Mein Verein", in der man ihn erst suchen müsste.
 */
export default function EventPage() {
  const { eventId = null } = useParams<{ eventId: string }>();
  const { profile } = useSession();
  const events = useEvents();
  const participants = useEventParticipants();

  const status = queryStatus(events, participants);

  const back = (
    <Link
      to="/my-club?tab=events"
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Vereinstermine
    </Link>
  );

  if (status.loading) return <LoadingState rows={1} />;
  if (status.error) return <ErrorState onRetry={status.retry} />;

  const event = (events.data ?? []).find((entry) => entry.id === eventId);

  if (!event) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={SearchX}
          title="Diesen Vereinstermin gibt es nicht (mehr)"
          description="Vielleicht wurde er gelöscht, oder der Link ist unvollständig."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">{back}</div>
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
