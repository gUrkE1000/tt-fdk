import { describe, it, expect } from 'vitest';
import {
  buildIcs,
  escapeIcsText,
  formatIcsDate,
  type IcsEntry,
} from '../../supabase/functions/_shared/ics';

const NOW = new Date('2026-09-18T08:00:00Z');

function entry(overrides: Partial<IcsEntry> = {}): IcsEntry {
  return {
    uid: 'match-m1@vereinsplaner',
    title: '1. Herren gegen TTC Nachbarstadt',
    startsAt: '2026-10-05T17:00:00Z',
    endsAt: '2026-10-05T21:00:00Z',
    location: 'Sporthalle Musterstadt',
    ...overrides,
  };
}

describe('formatIcsDate', () => {
  it('schreibt UTC ohne Trennzeichen', () => {
    expect(formatIcsDate(new Date('2026-10-05T17:00:00Z'))).toBe('20261005T170000Z');
  });
});

describe('escapeIcsText', () => {
  it('maskiert, was in ICS eine Bedeutung hat', () => {
    expect(escapeIcsText('A, B; C\\D')).toBe('A\\, B\; C\\\\D');
    expect(escapeIcsText('Zeile\nZweite')).toBe('Zeile\\nZweite');
  });
});

describe('buildIcs', () => {
  it('schreibt Kopf und Fuß', () => {
    const ics = buildIcs([entry()], { calendarName: 'TTC Musterstadt', now: NOW });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('X-WR-CALNAME:TTC Musterstadt');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('nutzt CRLF, wie der Standard es verlangt', () => {
    const ics = buildIcs([entry()], { calendarName: 'Verein', now: NOW });
    expect(ics.split('\r\n').length).toBeGreaterThan(5);
    expect(ics.includes('\n\n')).toBe(false);
  });

  it('schreibt je Termin ein VEVENT mit stabiler UID', () => {
    const ics = buildIcs([entry()], { calendarName: 'Verein', now: NOW });

    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:match-m1@vereinsplaner');
    expect(ics).toContain('DTSTART:20261005T170000Z');
    expect(ics).toContain('DTEND:20261005T210000Z');
    expect(ics).toContain('LOCATION:Sporthalle Musterstadt');
  });

  it('gibt einem Termin ohne Ende zwei Stunden', () => {
    const ics = buildIcs([entry({ endsAt: null })], { calendarName: 'Verein', now: NOW });
    expect(ics).toContain('DTEND:20261005T190000Z');
  });

  it('repariert ein Ende vor dem Anfang', () => {
    const ics = buildIcs([entry({ endsAt: '2026-10-05T16:00:00Z' })], {
      calendarName: 'Verein',
      now: NOW,
    });
    expect(ics).toContain('DTEND:20261005T190000Z');
  });

  it('übergeht einen Termin ohne brauchbaren Zeitpunkt', () => {
    const ics = buildIcs([entry({ startsAt: 'kaputt' })], { calendarName: 'Verein', now: NOW });
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('maskiert Kommas im Titel', () => {
    const ics = buildIcs([entry({ title: 'Feier, groß' })], {
      calendarName: 'Verein',
      now: NOW,
    });
    expect(ics).toContain('SUMMARY:Feier\\, groß');
  });

  it('bricht lange Zeilen um', () => {
    const ics = buildIcs([entry({ title: 'x'.repeat(200) })], {
      calendarName: 'Verein',
      now: NOW,
    });

    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // Die Fortsetzung beginnt mit einem Leerzeichen.
    expect(ics).toMatch(/\r\n x/);
  });

  it('kommt ohne Termine zurecht', () => {
    const ics = buildIcs([], { calendarName: 'Verein', now: NOW });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
