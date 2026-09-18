import { z } from 'zod';
import type { Enums } from '../../lib/database.types';

export const TRAINING_TYPE_LABELS: Record<Enums<'training_type'>, string> = {
  adults: 'Erwachsene',
  youth: 'Jugend',
};

export const RHYTHM_LABELS: Record<Enums<'training_rhythm'>, string> = {
  weekly: 'wöchentlich',
  biweekly: 'zweiwöchentlich',
  monthly: 'monatlich',
};

export const STATISTICS_VISIBILITY_LABELS: Record<Enums<'statistics_visibility'>, string> = {
  all: 'Für alle',
  admins: 'Nur für Administratoren',
  groups: 'Nur für ausgewählte Gruppen',
};

/** 1 = Montag … 7 = Sonntag, wie in der Datenbank und in date-fns. */
export const WEEKDAYS: readonly { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Montag', short: 'Mo' },
  { value: 2, label: 'Dienstag', short: 'Di' },
  { value: 3, label: 'Mittwoch', short: 'Mi' },
  { value: 4, label: 'Donnerstag', short: 'Do' },
  { value: 5, label: 'Freitag', short: 'Fr' },
  { value: 6, label: 'Samstag', short: 'Sa' },
  { value: 7, label: 'Sonntag', short: 'So' },
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? '—';
}

/** Postgres liefert `19:00:00`, ein `<input type="time">` will `19:00`. */
export function toTimeInput(value: string | null | undefined): string {
  return (value ?? '').slice(0, 5);
}

/** „Dienstag, 19:00–21:00 Uhr“ — die Zeitangabe in der Trainingsliste. */
export function formatSchedule(training: {
  weekday: number;
  time_start: string;
  time_end: string | null;
}): string {
  const start = toTimeInput(training.time_start);
  const end = toTimeInput(training.time_end);
  return `${weekdayLabel(training.weekday)}, ${end ? `${start}–${end}` : start} Uhr`;
}

// ---------------------------------------------------------------------------- Training

export const trainingSchema = z
  .object({
    name: z.string().trim().min(1, 'Das Training braucht einen Namen'),
    type: z.enum(['adults', 'youth']),
    weekday: z.number().int().min(1).max(7),
    timeStart: z.string().regex(/^\d{2}:\d{2}$/, 'Bitte eine Uhrzeit angeben'),
    /** Leer = offenes Ende. */
    timeEnd: z.string(),
    /** Leer = kein Ort hinterlegt. */
    venueId: z.string(),
    rhythm: z.enum(['weekly', 'biweekly', 'monthly']),
    startDate: z.string().min(1, 'Ohne Startdatum steht der Rhythmus nicht fest'),
    reminderHours: z
      .number({ error: 'Bitte eine Zahl eingeben' })
      .int('Bitte eine ganze Zahl')
      .min(0, 'Keine negative Vorlaufzeit')
      .max(336, 'Höchstens zwei Wochen Vorlauf'),
    details: z.string(),
    maxParticipants: z
      .number({ error: 'Bitte eine Zahl eingeben' })
      .int('Bitte eine ganze Zahl')
      .min(1, 'Mindestens ein Platz — sonst das Training stilllegen')
      .max(999, 'So viele passen in keine Halle')
      .nullable(),

    isOpen: z.boolean(),
    trainerInvitesOnly: z.boolean(),
    isIncognito: z.boolean(),
    requiresKeyOwner: z.boolean(),
    skipPublicHolidays: z.boolean(),
    skipSchoolHolidays: z.boolean(),
    hideInCalendar: z.boolean(),
    autoCancelNoTrainers: z.boolean(),

    statisticsVisibility: z.enum(['all', 'admins', 'groups']),
    statisticsGroupIds: z.array(z.string()),
    active: z.boolean(),

    trainerIds: z.array(z.string()),
    memberIds: z.array(z.string()),
  })
  .refine((values) => values.timeEnd === '' || values.timeEnd > values.timeStart, {
    path: ['timeEnd'],
    message: 'Das Ende liegt vor dem Beginn',
  })
  .refine(
    (values) => values.statisticsVisibility !== 'groups' || values.statisticsGroupIds.length > 0,
    {
      path: ['statisticsGroupIds'],
      message: 'Bitte mindestens eine Gruppe auswählen',
    },
  );

export type TrainingValues = z.infer<typeof trainingSchema>;

export const EMPTY_TRAINING: TrainingValues = {
  name: '',
  type: 'adults',
  weekday: 2,
  timeStart: '19:00',
  timeEnd: '',
  venueId: '',
  rhythm: 'weekly',
  startDate: '',
  // Fünf Stunden wie im TT-Planer: früh genug, um noch abzusagen, spät genug,
  // um zu wissen, ob man kann.
  reminderHours: 5,
  details: '',
  maxParticipants: null,
  isOpen: false,
  trainerInvitesOnly: false,
  isIncognito: false,
  requiresKeyOwner: false,
  skipPublicHolidays: true,
  skipSchoolHolidays: false,
  hideInCalendar: false,
  autoCancelNoTrainers: false,
  statisticsVisibility: 'admins',
  statisticsGroupIds: [],
  active: true,
  trainerIds: [],
  memberIds: [],
};

// ---------------------------------------------------------------------------- Ausfall

export const cancellationSchema = z
  .object({
    /** Ein Ausfall gilt entweder einem Training oder einer ganzen Halle, nie beidem. */
    target: z.enum(['training', 'venue']),
    trainingId: z.string(),
    venueId: z.string(),
    fromDate: z.string().min(1, 'Bitte ein Datum angeben'),
    /** Leer = nur der eine Tag. */
    toDate: z.string(),
    reason: z.string(),
    notifyEmail: z.boolean(),
  })
  .refine((values) => values.target !== 'training' || values.trainingId !== '', {
    path: ['trainingId'],
    message: 'Bitte ein Training auswählen',
  })
  .refine((values) => values.target !== 'venue' || values.venueId !== '', {
    path: ['venueId'],
    message: 'Bitte einen Ort auswählen',
  })
  .refine((values) => values.toDate === '' || values.toDate >= values.fromDate, {
    path: ['toDate'],
    message: 'Das Ende liegt vor dem Anfang',
  });

export type CancellationValues = z.infer<typeof cancellationSchema>;

export const EMPTY_CANCELLATION: CancellationValues = {
  target: 'training',
  trainingId: '',
  venueId: '',
  fromDate: '',
  toDate: '',
  reason: '',
  notifyEmail: false,
};

// ---------------------------------------------------------------------------- Zuweisung

export interface AssignSource {
  /** Mitglieder je Mannschaft, Kader und Ersatz zusammen. */
  teams: Record<string, readonly string[]>;
  groups: Record<string, readonly string[]>;
}

/**
 * Wen „Mitglieder zuweisen“ am Ende einträgt.
 *
 * Mannschaften, Gruppen und einzeln gewählte Mitglieder ergeben zusammen eine Menge;
 * „Bisherige überschreiben“ entscheidet nur, ob die vorhandene Zuordnung dazukommt oder
 * ersetzt wird. Als reine Funktion, weil der Fehler „alle bisherigen verloren“ teuer ist
 * und sich sonst nur durch Ausprobieren zeigt.
 */
export function resolveAssignment(input: {
  source: AssignSource;
  teamIds: readonly string[];
  groupIds: readonly string[];
  memberIds: readonly string[];
  current: readonly string[];
  replace: boolean;
}): string[] {
  const result = new Set<string>(input.replace ? [] : input.current);

  for (const teamId of input.teamIds) {
    for (const id of input.source.teams[teamId] ?? []) result.add(id);
  }
  for (const groupId of input.groupIds) {
    for (const id of input.source.groups[groupId] ?? []) result.add(id);
  }
  for (const id of input.memberIds) result.add(id);

  return [...result];
}
