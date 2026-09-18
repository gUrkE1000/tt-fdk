/**
 * Welche Trainingstermine es geben muss — als reine Funktion.
 *
 * Ein Training ist eine Regel („dienstags 19 Uhr, zweiwöchentlich ab dem 1. September"),
 * ein Termin ist eine Zeile. Der Weg von der einen zur anderen hat drei Eigenschaften,
 * die ihn heikel machen:
 *
 *   1. Er läuft täglich erneut über denselben Zeitraum. Jeder Lauf muss zum selben
 *      Ergebnis kommen, sonst wandern Termine.
 *   2. An einem Termin hängen Rückmeldungen. Ein gelöschter Termin nimmt sie mit —
 *      deshalb wird hier nie gelöscht, nur angelegt, abgesagt, wieder geöffnet oder
 *      verschoben.
 *   3. Er muss zwischen „abgesagt, weil ein Ausfall eingetragen ist" und „abgesagt, weil
 *      der Trainer es so wollte" unterscheiden. Nur das Erste darf der Job zurücknehmen.
 *
 * Deshalb steckt die ganze Entscheidung hier, ohne Uhr und ohne Datenbank, und die Edge
 * Function holt nur Daten und führt aus.
 */

import { parseLocalDateToUtc } from './ics.ts';

export type Rhythm = 'weekly' | 'biweekly' | 'monthly';

export interface PlannedTraining {
  id: string;
  /** 1 = Montag … 7 = Sonntag. */
  weekday: number;
  /** `HH:MM` oder `HH:MM:SS` in Ortszeit. */
  timeStart: string;
  timeEnd: string | null;
  venueId: string | null;
  rhythm: Rhythm;
  /** Ankerdatum des Rhythmus, `YYYY-MM-DD`. */
  startDate: string;
  skipPublicHolidays: boolean;
  skipSchoolHolidays: boolean;
  active: boolean;
}

export interface HolidayPeriod {
  kind: 'public' | 'school';
  startDate: string;
  endDate: string;
}

export interface CancellationPeriod {
  id: string;
  trainingId: string | null;
  venueId: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
}

export interface ExistingSession {
  id: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string | null;
  cancelled: boolean;
  /** Gesetzt, wenn ein Ausfall-Zeitraum diese Absage ausgelöst hat. */
  cancellationId: string | null;
}

export interface SessionPlanInput {
  training: PlannedTraining;
  holidays: readonly HolidayPeriod[];
  cancellations: readonly CancellationPeriod[];
  existing: readonly ExistingSession[];
  /** Erster Tag des betrachteten Zeitraums, `YYYY-MM-DD`, einschließlich. */
  from: string;
  /** Letzter Tag, einschließlich. */
  to: string;
}

export interface CreatedSession {
  trainingId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string | null;
  cancelled: boolean;
  cancelReason: string;
  cancellationId: string | null;
}

export interface CancelAction {
  id: string;
  reason: string;
  cancellationId: string | null;
}

export interface UncancelAction {
  id: string;
}

export interface RescheduleAction {
  id: string;
  startsAt: string;
  endsAt: string | null;
}

export interface SessionPlan {
  create: CreatedSession[];
  cancel: CancelAction[];
  uncancel: UncancelAction[];
  reschedule: RescheduleAction[];
}

/** Acht Wochen im Voraus — so weit plant ein Verein, weiter interessiert niemanden. */
export const HORIZON_DAYS = 56;

export const REASON_PUBLIC_HOLIDAY = 'Feiertag';
export const REASON_SCHOOL_HOLIDAY = 'Schulferien';
export const REASON_INACTIVE = 'Das Training ist stillgelegt.';
export const REASON_OUT_OF_PLAN = 'Dieser Termin gehört nicht mehr zum Training.';

export function planSessions(input: SessionPlanInput): SessionPlan {
  const { training, from, to } = input;

  const plan: SessionPlan = { create: [], cancel: [], uncancel: [], reschedule: [] };
  const inWindow = input.existing.filter(
    (session) => session.sessionDate >= from && session.sessionDate <= to,
  );
  const byDate = new Map(inWindow.map((session) => [session.sessionDate, session]));

  const dates = training.active ? occurrences(training, from, to) : [];
  const planned = new Set(dates);

  for (const date of dates) {
    const skip = skipReason(training, input.holidays, date);
    const cancellation = matchingCancellation(training, input.cancellations, date);

    const reason = skip ?? cancellation?.reason ?? '';
    const cancellationId = skip === null ? (cancellation?.id ?? null) : null;
    const cancelled = reason !== '';

    const existing = byDate.get(date);

    if (!existing) {
      // Ein Feiertag lässt den Termin gar nicht erst entstehen. Ein Ausfall dagegen
      // schon: dort soll jeder sehen, dass an diesem Tag etwas geplant war und warum
      // es ausfällt.
      if (skip !== null) continue;

      const times = timesFor(training, date);
      plan.create.push({
        trainingId: training.id,
        sessionDate: date,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        cancelled,
        cancelReason: reason,
        cancellationId,
      });
      continue;
    }

    if (cancelled && !existing.cancelled) {
      plan.cancel.push({ id: existing.id, reason, cancellationId });
    } else if (!cancelled && existing.cancelled && existing.cancellationId !== null) {
      // Nur eine Absage, die dieser Job selbst aus einem Ausfall-Zeitraum gesetzt hat,
      // nimmt er auch wieder zurück. Was der Trainer von Hand abgesagt hat, bleibt.
      plan.uncancel.push({ id: existing.id });
    }

    const times = timesFor(training, date);
    if (existing.startsAt !== times.startsAt || (existing.endsAt ?? null) !== times.endsAt) {
      plan.reschedule.push({ id: existing.id, startsAt: times.startsAt, endsAt: times.endsAt });
    }
  }

  // Termine, die die Regel nicht mehr hergibt: nach einer Änderung von Wochentag oder
  // Rhythmus, oder weil das Training stillgelegt wurde. Sie werden abgesagt, nicht
  // gelöscht — die Rückmeldungen daran gehören den Mitgliedern.
  for (const session of inWindow) {
    if (planned.has(session.sessionDate) || session.cancelled) continue;
    plan.cancel.push({
      id: session.id,
      reason: training.active ? REASON_OUT_OF_PLAN : REASON_INACTIVE,
      cancellationId: null,
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------- Rhythmus

/** Alle Termine der Regel im Fenster, aufsteigend. */
export function occurrences(training: PlannedTraining, from: string, to: string): string[] {
  const anchor = firstOccurrence(training.startDate, training.weekday);
  if (anchor > to) return [];

  const dates: string[] = [];

  if (training.rhythm === 'monthly') {
    // „Monatlich" heißt: derselbe Wochentag an derselben Stelle des Monats, also etwa
    // jeder zweite Dienstag. Ein Monat ohne fünften Dienstag fällt aus.
    const ordinal = Math.ceil(dayOfMonth(anchor) / 7);
    let year = yearOf(from >= anchor ? from : anchor);
    let month = monthOf(from >= anchor ? from : anchor);

    while (true) {
      const date = nthWeekdayOfMonth(year, month, training.weekday, ordinal);
      if (date !== null && date > to) break;
      if (date !== null && date >= from && date >= anchor) dates.push(date);

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      if (`${year}-${pad(month)}-01` > to) break;
    }

    return dates;
  }

  const step = training.rhythm === 'biweekly' ? 14 : 7;

  // Nicht vom Anker an durchzählen, sondern in einem Schritt vorspringen: sonst
  // liefe der Job bei einem Training, das seit Jahren läuft, tausende Runden.
  let current = anchor;
  if (current < from) {
    const skipped = Math.floor(daysBetween(anchor, from) / step);
    current = addDays(anchor, skipped * step);
    while (current < from) current = addDays(current, step);
  }

  while (current <= to) {
    dates.push(current);
    current = addDays(current, step);
  }

  return dates;
}

function firstOccurrence(startDate: string, weekday: number): string {
  const offset = (weekday - isoWeekday(startDate) + 7) % 7;
  return addDays(startDate, offset);
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  ordinal: number,
): string | null {
  const first = `${year}-${pad(month)}-01`;
  const offset = (weekday - isoWeekday(first) + 7) % 7;
  const date = addDays(first, offset + (ordinal - 1) * 7);
  return monthOf(date) === month && yearOf(date) === year ? date : null;
}

// ---------------------------------------------------------------------------- Ausfälle

function skipReason(
  training: PlannedTraining,
  holidays: readonly HolidayPeriod[],
  date: string,
): string | null {
  for (const holiday of holidays) {
    if (date < holiday.startDate || date > holiday.endDate) continue;
    if (holiday.kind === 'public' && training.skipPublicHolidays) return REASON_PUBLIC_HOLIDAY;
    if (holiday.kind === 'school' && training.skipSchoolHolidays) return REASON_SCHOOL_HOLIDAY;
  }
  return null;
}

function matchingCancellation(
  training: PlannedTraining,
  cancellations: readonly CancellationPeriod[],
  date: string,
): CancellationPeriod | null {
  for (const entry of cancellations) {
    if (date < entry.fromDate || date > entry.toDate) continue;
    if (entry.trainingId !== null && entry.trainingId === training.id) return entry;
    if (entry.venueId !== null && training.venueId !== null && entry.venueId === training.venueId) {
      return entry;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------- Uhrzeit

function timesFor(
  training: PlannedTraining,
  date: string,
): { startsAt: string; endsAt: string | null } {
  return {
    startsAt: localToIso(date, training.timeStart),
    endsAt: training.timeEnd === null ? null : localToIso(date, training.timeEnd),
  };
}

/**
 * Ortszeit in einen Zeitpunkt. Eine Trainingszeit ist immer Ortszeit: „dienstags 19 Uhr"
 * bleibt 19 Uhr, auch wenn dazwischen die Uhr umgestellt wird.
 */
function localToIso(date: string, time: string): string {
  const [hour, minute, second] = time.split(':').map((part) => Number(part) || 0);
  return parseLocalDateToUtc(
    yearOf(date),
    monthOf(date) - 1,
    dayOfMonth(date),
    hour,
    minute,
    second ?? 0,
  ).toISOString();
}

// ---------------------------------------------------------------------------- Datum

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isoWeekday(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
