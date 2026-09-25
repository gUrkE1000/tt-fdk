import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  AlertTriangle,
  CalendarOff,
  Check,
  Clock,
  MapPin,
  MessageSquare,
  Navigation,
  X,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Textarea,
  useToast,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import MessagesPanel from '../messages/MessagesPanel';
import { formatDateTime, formatTime } from '../../lib/dates';
import { mapsUrl } from '../../lib/maps';
import { formatVenueAddress } from '../venues/schemas';
import type { Venue } from '../venues/api';
import {
  useSessionAssignees,
  useSetAttendance,
  type AttendanceStatus,
  type SessionCounts,
  type SessionParticipant,
  type TrainingSession,
  type TrainingWithPeople,
} from './api';
import type { SessionKeys } from '../keys/api';
import KeyBearerRow from './KeyBearerRow';
import SessionAssigneesPanel from './SessionAssigneesPanel';

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
  const assignees = useSessionAssignees();

  // Systemtraining: Zu- und absagen kann, wer diesem Termin zugeteilt ist — und der Trainer.
  const system = training?.is_system === true;
  const assigneeIds = (assignees.data ?? [])
    .filter((entry) => entry.session_id === session.id)
    .map((entry) => entry.profile_id);
  const mayAnswer =
    !system ||
    (profileId !== null &&
      (assigneeIds.includes(profileId) || (training?.trainerIds ?? []).includes(profileId)));

  const mine = participants.find((entry) => entry.profile_id === profileId) ?? null;
  const [guests, setGuests] = useState(mine?.guests ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [commentOpen, setCommentOpen] = useState(false);

  useEffect(() => {
    setGuests(mine?.guests ?? 0);
  }, [mine?.guests]);

  useEffect(() => {
    setComment(mine?.comment ?? '');
  }, [mine?.comment]);

  const coming = participants.filter(
    (entry) => entry.status === 'yes' || entry.status === 'late',
  );
  const total = (counts?.yes_count ?? 0) + (counts?.late_count ?? 0);
  const max = training?.max_participants ?? null;
  const past = new Date(session.starts_at) <= new Date();

  async function choose(status: AttendanceStatus) {
    if (setAttendance.isPending) return;
    try {
      await setAttendance.mutateAsync({
        self: profileId,
        sessionId: session.id,
        status,
        guests,
        // Eine Bemerkung, die vor der ersten Antwort eingetippt wurde, geht mit.
        ...(!mine && comment.trim() !== '' ? { comment } : {}),
      });
      toast(status === 'no' ? 'Absage gespeichert' : 'Zusage gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  // Gespeichert wird beim Verlassen des Feldes, nicht bei jedem Tastendruck: Wer „12"
  // tippt, soll nicht erst mit einem und dann mit zwölf Gästen gespeichert werden.
  async function saveGuests(value: number) {
    // Ohne eigene Rückmeldung ergibt eine Gästezahl nichts: erst kommt man selbst.
    if (!mine || mine.status === 'no' || value === (mine.guests ?? 0)) return;
    try {
      await setAttendance.mutateAsync({
        self: profileId,
        sessionId: session.id,
        status: mine.status as AttendanceStatus,
        guests: value,
      });
    } catch (error) {
      setGuests(mine.guests ?? 0);
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function saveComment() {
    // Ohne Rückmeldung wartet die Bemerkung auf den nächsten Knopfdruck.
    if (!mine) {
      setCommentOpen(false);
      return;
    }
    try {
      await setAttendance.mutateAsync({
        self: profileId,
        sessionId: session.id,
        status: mine.status as AttendanceStatus,
        guests,
        comment,
      });
      setCommentOpen(false);
      toast('Bemerkung gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  const route = venue ? mapsUrl(formatVenueAddress(venue)) : null;
  const comments = coming.filter(
    (entry) => entry.profile_id !== profileId && (entry.comment ?? '').trim() !== '',
  );

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
            {system && <Badge tone="info">Systemtraining</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-gray-700">{training?.name ?? 'Training'}</p>
        </div>

        {(venue || training?.venue_id) && (
          <p className="flex items-start gap-1.5 text-sm text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {venue ? `${venue.name}, ${formatVenueAddress(venue)}` : 'Ort offen'}
            </span>
            {route && (
              <a
                href={route}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                Route
              </a>
            )}
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
                {comments.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                    {comments.map((entry) => (
                      <li key={entry.profile_id}>
                        <span className="font-semibold">
                          {entry.full_name ?? nameOf(entry.profile_id ?? '')}:
                        </span>{' '}
                        {entry.comment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Wer mitmacht, sieht bei diesem Training nur der Trainer.
              </p>
            )}

            <KeyBearerRow
              session={session}
              training={training}
              keys={keys}
              profileId={profileId}
            />

            {system && training && (
              <SessionAssigneesPanel
                session={session}
                training={training}
                assigneeIds={assigneeIds}
                nameOf={nameOf}
              />
            )}

            {profileId && !mayAnswer && (
              <p className="text-sm text-gray-500">
                Systemtraining: Teilnehmer teilt der Trainer je Termin zu.
              </p>
            )}

            {profileId && mayAnswer && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {CHOICES.map((choice) => {
                    const isActive = mine?.status === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        disabled={past}
                        aria-busy={setAttendance.isPending || undefined}
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
                      onChange={(event) => setGuests(Number(event.target.value) || 0)}
                      onBlur={() => void saveGuests(guests)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void saveGuests(guests);
                      }}
                    />
                  </label>

                  <Popover.Root open={commentOpen} onOpenChange={setCommentOpen}>
                    <Popover.Trigger
                      disabled={past}
                      aria-label="Bemerkung zur Rückmeldung"
                      className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="start"
                        sideOffset={6}
                        className="z-50 w-72 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg"
                      >
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Bemerkung
                        </label>
                        <Textarea
                          rows={3}
                          maxLength={500}
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          placeholder="Komme erst gegen 19:30"
                        />
                        {!mine && (
                          <p className="mt-1.5 text-xs text-gray-500">
                            Wähle danach, ob du dabei bist — die Bemerkung wird mitgespeichert.
                          </p>
                        )}
                        <div className="mt-2 flex justify-end gap-2">
                          <Button size="sm" onClick={() => setCommentOpen(false)}>
                            Abbrechen
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => void saveComment()}>
                            {mine ? 'Speichern' : 'Übernehmen'}
                          </Button>
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>

                {mine?.comment && (
                  <p className="text-xs text-gray-500">Deine Bemerkung: {mine.comment}</p>
                )}

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
