import { format, addMinutes, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Datums- und Zeitdarstellung.
 *
 * Alles wird als `timestamptz` gespeichert und in Europe/Berlin angezeigt. Die Zeitzone
 * steht hier fest statt in den Vereinseinstellungen: ein deutscher Tischtennisverein
 * spielt in deutscher Zeit, und eine konfigurierbare Zeitzone würde nur Fehlerquellen
 * eröffnen, die niemand bemerkt.
 */
export const TIME_ZONE = 'Europe/Berlin';

export function toBerlin(value: string | Date): Date {
  return toZonedTime(typeof value === 'string' ? new Date(value) : value, TIME_ZONE);
}

/** Ortszeit (wie im Formular eingegeben) in einen UTC-Zeitpunkt umrechnen. */
export function fromBerlin(value: string | Date): Date {
  return fromZonedTime(value, TIME_ZONE);
}

/** „12.10.2026" */
export function formatDate(value: string | Date): string {
  return format(toBerlin(value), 'dd.MM.yyyy', { locale: de });
}

/** „18:00" */
export function formatTime(value: string | Date): string {
  return format(toBerlin(value), 'HH:mm', { locale: de });
}

/** „Sa., 12.10.2026 um 18:00 Uhr" */
export function formatDateTime(value: string | Date): string {
  return format(toBerlin(value), "EEEEEE, dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de });
}

/** „Sa 12.10." — kompakt für Karten und Listen. */
export function formatShortDayDate(value: string | Date): string {
  return format(toBerlin(value), 'EEEEEE dd.MM.', { locale: de }).replace('.,', '');
}

/** Wochentag als Name, für Trainings („Montag"). */
export function weekdayLabel(weekday: number): string {
  // 1 = Montag … 7 = Sonntag, wie in der Datenbank.
  const names = [
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
    'Sonntag',
  ];
  return names[weekday - 1] ?? '';
}

/** Ankunftszeit: n Minuten vor Spielbeginn, als „17:00". */
export function arrivalTime(start: string | Date, minutesBefore: number): string {
  return formatTime(addMinutes(typeof start === 'string' ? new Date(start) : start, -minutesBefore));
}

/** Rückmeldefrist: eine Woche vor dem Termin, als „Sa 05.10.". */
export function deadlineBefore(start: string | Date, days = 7): string {
  return formatShortDayDate(subDays(typeof start === 'string' ? new Date(start) : start, days));
}

/** Tage bis zu einem Termin, aufgerundet auf ganze Tage. */
export function daysUntil(target: string | Date, now: Date = new Date()): number {
  const ms = (typeof target === 'string' ? new Date(target) : target).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
