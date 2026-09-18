import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarOff, Check, Clock, KeyRound, MapPin, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  Input,
  useToast,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import MessagesPanel from '../messages/MessagesPanel';
import { formatDateTime, formatTime } from '../../lib/dates';
import { formatVenueAddress } from '../venues/schemas';
import type { Venue } from '../venues/api';
import {
  useSetAttendance,
  type AttendanceStatus,
  type SessionCounts,
  type SessionParticipant,
  type TrainingSession,
  type TrainingWithPeople,
} from './api';
import type { SessionKeys } from '../keys/api';

const CHOICES: {
  value: AttendanceStatus;
  label: string;
  icon: typeof Check;
  active: string;
}[] = [
  {
    value: 'yes',
    label: 'Bin dabei',
    icon: Check,
    active: 'bg-status-yes text-white border-status-yes',
  },
  {
    value: 'late',
    label: 'Komme später',
    icon: Clock,
    active: 'bg-status-late text-white border-status-late',
  },
  {
    value: 'no',
    label: 'Bin nicht dabei',
    icon: X,
    active: 'bg-status-no text-white border-status-no',
  },
];

export interface SessionCardProps {
  session: TrainingSession;
  training: TrainingWithPeople | undefined;
  venue: Venue | undefined;
  /** Alle sichtbaren Rückmeldungen zu diesem Termin; bei Inkognito nur die eigene. */
  participants: SessionParticipant[];
  /** Die Zähler, falls sie sichtbar sind. */
  counts: SessionCounts | undefined;
  profileId: string | null;
  nameOf: (profileId: string) => string;
  /** Schlüssellage zu diesem Termin (Aufgabe 9.1); fehlt, solange sie lädt. */
  keys?: SessionKeys;
}

/**
 * Eine Trainingskarte (Zielbild 6.5).
 *
 * Der Unterschied zur Spielkarte ist die Teilnehmerliste: Sie fehlt bei einem inkognito
 * geführten Training — und zwar nicht, weil die Karte sie versteckt, sondern weil die
 * Datenbank sie gar nicht erst herausgibt. Die Karte zeigt schlicht, was sie bekommt.
 */
export default function SessionCard({
  session,
  training,
  venue,
  participants,
  counts,
  profileId,
  nameOf,
  keys,
}: SessionCardProps) {
  const { toast } = useToast();
  const setAttendance = useSetAttendance();

  const mine = participants.find((entry) => entry.profile_id === profileId) ?? null;
  const [guests, setGuests] = useState(mine?.guests ?? 0);

  useEffect(() => {
    setGuests(mine?.guests ?? 0);
  }, [mine?.guests]);

  const coming = participants.filter(
    (entry) => entry.status === 'yes' || entry.status === 'late',
  );
  const total = (counts?.yes_count ?? 0) + (counts?.late_count ?? 0);
  const max = training?.max_participants ?? null;
  const past = new Date(session.starts_at) <= new Date();

  async function choose(status: AttendanceStatus) {
    try {
      await setAttendance.mutateAsync({ sessionId: session.id, status, guests });
      toast(status === 'no' ? 'Absage gespeichert' : 'Zusage gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function saveGuests(value: number) {
    setGuests(value);
    // Ohne eigene Rückmeldung ergibt eine Gästezahl nichts: erst kommt man selbst.
    if (!mine || mine.status === 'no') return;
    try {
      await setAttendance.mutateAsync({
        sessionId: session.id,
        status: mine.status as AttendanceStatus,
        guests: value,
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <Card className={cn(session.cancelled && 'opacity-60')}>
      <CardBody className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-gray-900">
              {formatDateTime(session.starts_at)}
            </span>
            {session.ends_at && (
              <span className="text-sm text-gray-500">bis {formatTime(session.ends_at)}</span>
            )}
            {session.cancelled && <Badge tone="removed">fällt aus</Badge>}
            {training?.is_open && <Badge tone="primary">offenes Training</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-gray-700">{training?.name ?? 'Training'}</p>
        </div>

        {(venue || training?.venue_id) && (
          <p className="flex items-start gap-1.5 text-sm text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span>{venue ? `${venue.name}, ${formatVenueAddress(venue)}` : 'Ort offen'}</span>
          </p>
        )}

        {training && training.trainerIds.length > 0 && (
          <p className="text-sm text-gray-600">
            Trainer: {training.trainerIds.map(nameOf).join(', ')}
          </p>
        )}

        {session.cancelled ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-gray-100 p-2.5 text-sm text-gray-700">
            <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{session.cancel_reason || 'Dieser Termin fällt aus.'}</span>
          </p>
        ) : (
          <>
            {counts ? (
              <div>
                <span className="text-sm font-semibold tabular-nums text-gray-900">
                  {max === null
                    ? `${total} Teilnehmer`
                    : `${total} / ${max} Teilnehmer`}
                  {(counts.guest_count ?? 0) > 0 && ` · ${counts.guest_count} Gäste`}
                </span>
                {coming.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {coming.map((entry) => (
                      <Avatar
                        key={entry.profile_id}
                        size="sm"
                        name={entry.full_name ?? nameOf(entry.profile_id ?? '')}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Wer mitmacht, sieht bei diesem Training nur der Trainer.
              </p>
            )}

            {training?.requires_key_owner &&
              (keys?.has_key_holder ? (
                <p className="flex items-start gap-1.5 rounded-xl bg-status-yes-soft p-2.5 text-sm text-status-yes">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {/* Der Name kommt nur, wenn die Teilnehmerliste sichtbar ist —
                        bei Inkognito bleibt es bei „jemand". */}
                    Schlüssel: {keys.holder_name ?? 'jemand mit Schlüssel ist dabei'}
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-1.5 rounded-xl bg-status-late-soft p-2.5 text-sm text-status-late">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Bisher hat niemand mit Hallenschlüssel zugesagt — so bleibt die Halle zu.
                  </span>
                </p>
              ))}

            {profileId && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {CHOICES.map((choice) => {
                    const isActive = mine?.status === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        disabled={past || setAttendance.isPending}
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
                      disabled={past}
                      onChange={(event) => void saveGuests(Number(event.target.value) || 0)}
                    />
                  </label>
                </div>

                {past && (
                  <p className="text-xs text-gray-500">
                    Dieser Termin hat begonnen — melde dich beim Trainer.
                  </p>
                )}

                {max !== null && total >= max && mine?.status !== 'yes' && mine?.status !== 'late' && (
                  <p className="flex items-start gap-1.5 text-xs text-status-no">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Das Training ist voll.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {training?.details && <p className="text-sm text-gray-600">{training.details}</p>}
        <MessagesPanel type="session" objectId={session.id} />

      </CardBody>
    </Card>
  );
}
