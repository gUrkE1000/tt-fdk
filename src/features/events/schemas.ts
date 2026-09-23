import { z } from 'zod';
import { todayInBerlin } from '../../lib/dates';

export const eventSchema = z
  .object({
    name: z.string().trim().min(1, 'Der Termin braucht einen Namen'),
    fullDay: z.boolean(),
    startDate: z.string().min(1, 'Bitte ein Datum angeben'),
    /** Leer bei einem ganztägigen Termin. */
    startTime: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    /** Anmeldefrist; leer heißt: bis zum Beginn. */
    participateUntil: z.string(),
    maxParticipants: z
      .number({ error: 'Bitte eine Zahl eingeben' })
      .int('Bitte eine ganze Zahl')
      .min(1, 'Mindestens ein Platz')
      .max(9999, 'So viele passen nirgendwo hin')
      .nullable(),
    address: z.string(),
    descriptionHtml: z.string(),
    hideInMyClub: z.boolean(),
    excludeCalendar: z.boolean(),
  })
  .refine((values) => values.fullDay || values.startTime !== '', {
    path: ['startTime'],
    message: 'Bitte eine Uhrzeit angeben oder „ganztägig“ ankreuzen',
  })
  .refine(
    (values) => values.endDate === '' || values.endDate >= values.startDate,
    { path: ['endDate'], message: 'Das Ende liegt vor dem Anfang' },
  )
  .refine(
    (values) =>
      values.participateUntil === '' || values.participateUntil <= values.startDate,
    {
      path: ['participateUntil'],
      message: 'Die Anmeldefrist liegt nach dem Termin',
    },
  );

export type EventValues = z.infer<typeof eventSchema>;

export const EMPTY_EVENT: EventValues = {
  name: '',
  fullDay: false,
  startDate: '',
  startTime: '19:00',
  endDate: '',
  endTime: '',
  participateUntil: '',
  maxParticipants: null,
  address: '',
  descriptionHtml: '',
  hideInMyClub: false,
  excludeCalendar: false,
};

export interface EventFilters {
  search: string;
  /** ISO-Datum oder leer. */
  from: string;
  to: string;
}

export const EMPTY_EVENT_FILTERS: EventFilters = { search: '', from: '', to: '' };

export function hasActiveEventFilters(filters: EventFilters): boolean {
  return filters.search !== '' || filters.from !== '' || filters.to !== '';
}

export interface FilterableEvent {
  name: string;
  address: string | null;
  starts_at: string;
}

/**
 * Suche und Zeitraum über die Terminliste.
 *
 * Als reine Funktion, wie die Filter für Mitglieder und Spiele: Die Regel „`von` heißt
 * einschließlich, `bis` auch" gehört an eine Stelle und nicht in drei Komponenten.
 */
export function filterEvents<T extends FilterableEvent>(
  events: readonly T[],
  filters: EventFilters,
): T[] {
  const needle = filters.search.trim().toLowerCase();

  return events.filter((event) => {
    if (needle) {
      const haystack = `${event.name} ${event.address ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    const day = event.starts_at.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;

    return true;
  });
}

/** Vorbei ist ein Termin, wenn sein Ende — ersatzweise sein Beginn — zurückliegt. */
export function isFinishedEvent(
  event: { starts_at: string; ends_at: string | null },
  now: Date = new Date(),
): boolean {
  return new Date(event.ends_at ?? event.starts_at).getTime() < now.getTime();
}

/** Ist die Anmeldung noch offen? */
export function isRegistrationOpen(
  event: { starts_at: string; participate_until: string | null },
  now: Date = new Date(),
): boolean {
  if (new Date(event.starts_at).getTime() <= now.getTime()) return false;
  if (!event.participate_until) return true;
  return todayInBerlin(now) <= event.participate_until;
}
