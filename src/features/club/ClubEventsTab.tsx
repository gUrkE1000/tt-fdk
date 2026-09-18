import { CalendarDays } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { useSession } from '../auth/session';
import { useEventParticipants, useEvents } from '../events/api';
import { isFinishedEvent } from '../events/schemas';
import EventCard from '../events/EventCard';

/**
 * Vereinstermine aus Mitgliedersicht: die kommenden, ohne die, die der Veranstalter
 * hier ausgeblendet hat. Dieselben Karten wie unter „Vereinstermine“ — wer hier zusagt,
 * meldet sich genauso zurück.
 */
export default function ClubEventsTab() {
  const { profile } = useSession();
  const events = useEvents();
  const participants = useEventParticipants();

  const visible = (events.data ?? []).filter(
    (event) => !event.hide_in_my_club && !isFinishedEvent(event),
  );

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Keine Vereinstermine"
        description="Sobald etwas geplant ist, steht es hier."
      />
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          participants={(participants.data ?? []).filter((entry) => entry.event_id === event.id)}
          profileId={profile?.id ?? null}
        />
      ))}
    </div>
  );
}
