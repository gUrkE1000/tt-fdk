import { useEffect, useState } from 'react';
import { CalendarClock, Check, MapPin, Users, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  Input,
  RichText,
  useToast,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import MessagesPanel from '../messages/MessagesPanel';
import { formatDate, formatDateTime } from '../../lib/dates';
import { hasRichText } from '../../lib/richText';
import {
  useSetEventParticipation,
  type ClubEvent,
  type EventParticipant,
  type EventStatus,
} from './api';
import { isRegistrationOpen } from './schemas';

export interface EventCardProps {
  event: ClubEvent;
  participants: EventParticipant[];
  profileId: string | null;
  /** Kopfzeile des Veranstalters (Bearbeiten/Löschen). */
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const CHOICES: { value: EventStatus; label: string; icon: typeof Check; active: string }[] = [
  { value: 'yes', label: 'Zusage', icon: Check, active: 'bg-status-yes text-white border-status-yes' },
  { value: 'no', label: 'Absage', icon: X, active: 'bg-status-no text-white border-status-no' },
];

const REFUSALS: Record<string, string> = {
  closed: 'Die Anmeldefrist ist vorbei.',
  full: 'Der Termin ist voll.',
  gone: 'Diesen Termin gibt es nicht mehr.',
  invalid_answer: 'Diese Antwort kennt der Termin nicht.',
};

export default function EventCard({
  event,
  participants,
  profileId,
  canManage,
  onEdit,
  onDelete,
}: EventCardProps) {
  const { toast } = useToast();
  const setParticipation = useSetEventParticipation();

  const mine = participants.find((entry) => entry.profile_id === profileId) ?? null;
  const [guests, setGuests] = useState(mine?.guests ?? 0);

  useEffect(() => {
    setGuests(mine?.guests ?? 0);
  }, [mine?.guests]);

  const coming = participants.filter((entry) => entry.status === 'yes');
  const taken = coming.reduce((sum, entry) => sum + 1 + (entry.guests ?? 0), 0);
  const open = isRegistrationOpen(event);

  async function choose(status: EventStatus, nextGuests = guests) {
    try {
      const result = await setParticipation.mutateAsync({
        eventId: event.id,
        status,
        guests: nextGuests,
      });

      if (result.status === 'ok') {
        toast(status === 'yes' ? 'Zusage gespeichert' : 'Absage gespeichert', 'success');
      } else {
        toast(REFUSALS[result.status] ?? 'Das hat nicht geklappt', 'error');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-gray-900">
                {event.full_day ? formatDate(event.starts_at) : formatDateTime(event.starts_at)}
              </span>
              {event.full_day && <Badge tone="neutral">ganztägig</Badge>}
              {!open && <Badge tone="removed">Anmeldung geschlossen</Badge>}
            </div>
            <p className="mt-0.5 font-semibold text-gray-900">{event.name}</p>
          </div>

          {canManage && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="text-sm font-semibold text-primary underline"
              >
                Bearbeiten
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-sm font-semibold text-status-no underline"
              >
                Löschen
              </button>
            </div>
          )}
        </div>

        {event.address && (
          <p className="flex items-start gap-1.5 text-sm text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span>{event.address}</span>
          </p>
        )}

        {event.participate_until && (
          <p className="flex items-start gap-1.5 text-sm text-gray-600">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span>Teilnahme hinterlegen bis {formatDate(event.participate_until)}</span>
          </p>
        )}

        {hasRichText(event.description_html) && <RichText html={event.description_html} />}

        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-gray-900">
            <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
            {event.max_participants === null
              ? `${taken} Teilnehmer`
              : `${taken} / ${event.max_participants} Teilnehmer`}
          </p>
          {coming.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {coming.map((entry) => (
                <Avatar key={entry.profile_id} size="sm" name={entry.full_name ?? ''} />
              ))}
            </div>
          )}
        </div>

        {profileId && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {CHOICES.map((choice) => {
                const isActive = mine?.status === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    disabled={!open || setParticipation.isPending}
                    aria-pressed={isActive}
                    onClick={() => void choose(choice.value)}
                    className={cn(
                      'inline-flex min-h-touch items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      isActive
                        ? choice.active
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <choice.icon className="h-4 w-4" aria-hidden="true" />
                    {choice.label}
                  </button>
                );
              })}

              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                Gäste
                <Input
                  type="number"
                  min={0}
                  max={20}
                  className="w-20"
                  aria-label="Gäste"
                  value={guests}
                  disabled={!open}
                  onChange={(event_) => {
                    const value = Number(event_.target.value) || 0;
                    setGuests(value);
                    if (mine?.status === 'yes') void choose('yes', value);
                  }}
                />
              </label>
            </div>

            {!open && (
              <p className="text-xs text-gray-500">
                {event.participate_until
                  ? `Die Anmeldefrist endete am ${formatDate(event.participate_until)}.`
                  : 'Dieser Termin liegt in der Vergangenheit.'}
              </p>
            )}
          </div>
        )}
        <MessagesPanel type="event" objectId={event.id} />

      </CardBody>
    </Card>
  );
}
