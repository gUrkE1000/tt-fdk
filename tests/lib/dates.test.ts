import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatShortDayDate,
  weekdayLabel,
  arrivalTime,
  deadlineBefore,
  daysUntil,
  fromBerlin,
} from '../../src/lib/dates';

describe('Datumsdarstellung in Europe/Berlin', () => {
  // 12.10.2026 ist Sommerzeit (UTC+2), 12.12.2026 Winterzeit (UTC+1).
  const summer = '2026-10-12T16:00:00.000Z';
  const winter = '2026-12-12T17:00:00.000Z';

  it('zeigt Sommerzeit korrekt an', () => {
    expect(formatDate(summer)).toBe('12.10.2026');
    expect(formatTime(summer)).toBe('18:00');
  });

  it('zeigt Winterzeit korrekt an', () => {
    expect(formatDate(winter)).toBe('12.12.2026');
    expect(formatTime(winter)).toBe('18:00');
  });

  it('formatiert Datum und Uhrzeit zusammen', () => {
    expect(formatDateTime(summer)).toBe('Mo, 12.10.2026 um 18:00 Uhr');
  });

  it('formatiert die Kurzform für Karten', () => {
    expect(formatShortDayDate(summer)).toBe('Mo 12.10.');
  });

  it('rechnet eine Ortszeit in UTC um', () => {
    // 18:00 Ortszeit im Sommer sind 16:00 UTC.
    expect(fromBerlin('2026-10-12T18:00:00').toISOString()).toBe('2026-10-12T16:00:00.000Z');
  });
});

describe('weekdayLabel', () => {
  it('nennt Montag als 1 und Sonntag als 7, wie in der Datenbank', () => {
    expect(weekdayLabel(1)).toBe('Montag');
    expect(weekdayLabel(7)).toBe('Sonntag');
  });

  it('liefert für einen unmöglichen Wert einen leeren Text statt undefined', () => {
    expect(weekdayLabel(0)).toBe('');
    expect(weekdayLabel(8)).toBe('');
  });
});

describe('arrivalTime', () => {
  it('rechnet die Ankunftszeit zurück', () => {
    expect(arrivalTime('2026-10-12T16:00:00.000Z', 60)).toBe('17:00');
    expect(arrivalTime('2026-10-12T16:00:00.000Z', 30)).toBe('17:30');
  });

  it('kommt über die Stundengrenze hinweg zurecht', () => {
    expect(arrivalTime('2026-10-12T16:00:00.000Z', 90)).toBe('16:30');
  });
});

describe('deadlineBefore', () => {
  it('liegt standardmäßig eine Woche vorher', () => {
    expect(deadlineBefore('2026-10-12T16:00:00.000Z')).toBe('Mo 05.10.');
  });

  it('nimmt eine abweichende Frist an', () => {
    expect(deadlineBefore('2026-10-12T16:00:00.000Z', 3)).toBe('Fr 09.10.');
  });
});

describe('daysUntil', () => {
  it('zählt volle Tage bis zum Termin', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    expect(daysUntil('2026-10-12T16:00:00.000Z', now)).toBe(12);
  });

  it('wird für vergangene Termine negativ', () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    expect(daysUntil('2026-10-12T16:00:00.000Z', now)).toBeLessThan(0);
  });
});
