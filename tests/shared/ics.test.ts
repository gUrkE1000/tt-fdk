import { describe, it, expect } from 'vitest';
import {
  extractMatchday,
  parseIcs,
  parseLocalDateToUtc,
  unfoldLines,
} from '../../supabase/functions/_shared/ics';

/** Ein Kalender um die übergebenen VEVENT-Blöcke herum. */
function calendar(...blocks: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//myTischtennis.de//NONSGML v1.0//EN',
    ...blocks,
    'END:VCALENDAR',
  ].join('\r\n');
}

describe('unfoldLines', () => {
  it('nimmt eine Fortsetzung mit Leerzeichen zurück', () => {
    expect(unfoldLines('SUMMARY:Erster Teil\r\n zweiter Teil')).toBe(
      'SUMMARY:Erster Teilzweiter Teil',
    );
  });

  it('nimmt eine Fortsetzung mit Tabulator zurück', () => {
    expect(unfoldLines('SUMMARY:Erster Teil\r\n\tzweiter Teil')).toBe(
      'SUMMARY:Erster Teilzweiter Teil',
    );
  });

  it('kommt auch ohne Wagenrücklauf zurecht', () => {
    expect(unfoldLines('SUMMARY:Eins\n zwei')).toBe('SUMMARY:Einszwei');
  });

  it('lässt normale Zeilenumbrüche stehen', () => {
    expect(unfoldLines('EINS:a\r\nZWEI:b')).toBe('EINS:a\r\nZWEI:b');
  });
});

describe('parseLocalDateToUtc', () => {
  it('zieht in der Sommerzeit zwei Stunden ab', () => {
    const date = parseLocalDateToUtc(2026, 8, 12, 18, 0, 0);
    expect(date.toISOString()).toBe('2026-09-12T16:00:00.000Z');
  });

  it('zieht in der Winterzeit eine Stunde ab', () => {
    const date = parseLocalDateToUtc(2026, 11, 12, 18, 0, 0);
    expect(date.toISOString()).toBe('2026-12-12T17:00:00.000Z');
  });

  it('trifft den Tag vor der Umstellung im Herbst', () => {
    // Am 24.10.2026 gilt noch Sommerzeit, umgestellt wird in der Nacht zum 25.
    expect(parseLocalDateToUtc(2026, 9, 24, 12, 0, 0).toISOString()).toBe(
      '2026-10-24T10:00:00.000Z',
    );
  });

  it('trifft den Tag nach der Umstellung im Herbst', () => {
    expect(parseLocalDateToUtc(2026, 9, 26, 12, 0, 0).toISOString()).toBe(
      '2026-10-26T11:00:00.000Z',
    );
  });

  it('rechnet Mitternacht richtig um', () => {
    expect(parseLocalDateToUtc(2026, 0, 15, 0, 0, 0).toISOString()).toBe(
      '2026-01-14T23:00:00.000Z',
    );
  });

  it('nimmt eine andere Zeitzone entgegen', () => {
    expect(parseLocalDateToUtc(2026, 5, 1, 12, 0, 0, 'UTC').toISOString()).toBe(
      '2026-06-01T12:00:00.000Z',
    );
  });
});

describe('extractMatchday', () => {
  it('liest „Spieltag: 5" aus der Beschreibung', () => {
    expect(extractMatchday('Spielnummer: 54321, Spieltag: 5', '')).toBe(5);
  });

  it('liest „Spieltag 12" ohne Doppelpunkt aus dem Titel', () => {
    expect(extractMatchday('ohne Nummer', 'Erwachsene III Spieltag 12')).toBe(12);
  });

  it('liest die Schreibweise „3. Spieltag"', () => {
    expect(extractMatchday('3. Spieltag der Rückrunde', '')).toBe(3);
  });

  it('bevorzugt die Beschreibung vor dem Titel', () => {
    expect(extractMatchday('Spieltag: 7', 'Spieltag 9')).toBe(7);
  });

  it('gibt null zurück, wenn keine Nummer dabeisteht', () => {
    expect(extractMatchday('keine Zahl', 'auch nicht')).toBeNull();
  });

  it('lässt sich von einer anderen Zahl nicht täuschen', () => {
    expect(extractMatchday('Spielnummer: 54321', '')).toBeNull();
  });
});

describe('parseIcs — ein vollständiger Kalender', () => {
  const ics = calendar(
    [
      'BEGIN:VEVENT',
      'UID:11111111-1111-1111-1111-111111111111',
      'DTSTART;TZID=Europe/Berlin:20260912T180000',
      'DTEND;TZID=Europe/Berlin:20260912T210000',
      'SUMMARY:TTC Musterstadt III vs TV Beispiel III',
      'LOCATION:Musterstadt\\, Turnhalle',
      'DESCRIPTION:Spieltag: 1\\, Spielnummer: 100',
      'END:VEVENT',
    ].join('\r\n'),
    [
      'BEGIN:VEVENT',
      'UID:22222222-2222-2222-2222-222222222222',
      'DTSTART:20260919T180000Z',
      'SUMMARY:TV Beispiel vs TTC Musterstadt III',
      'LOCATION:Beispielstadt\\, Halle',
      'DESCRIPTION:Spieltag 2',
      'END:VEVENT',
    ].join('\r\n'),
  );

  const events = parseIcs(ics);

  it('findet beide Termine', () => {
    expect(events).toHaveLength(2);
  });

  it('rechnet eine Ortszeit in UTC um', () => {
    expect(events[0].dtstart.toISOString()).toBe('2026-09-12T16:00:00.000Z');
    expect(events[0].dtend.toISOString()).toBe('2026-09-12T19:00:00.000Z');
  });

  it('übernimmt eine Zeit mit Z unverändert', () => {
    expect(events[1].dtstart.toISOString()).toBe('2026-09-19T18:00:00.000Z');
  });

  it('nimmt die Maskierung im Ort zurück', () => {
    expect(events[0].location).toBe('Musterstadt, Turnhalle');
  });

  it('nimmt die Maskierung in der Beschreibung zurück', () => {
    expect(events[0].description).toBe('Spieltag: 1, Spielnummer: 100');
  });

  it('gibt einem Termin ohne DTEND zwei Stunden', () => {
    expect(events[1].dtend.toISOString()).toBe('2026-09-19T20:00:00.000Z');
  });
});

describe('parseIcs — Einzelheiten des Formats', () => {
  const event = (...properties: string[]) =>
    ['BEGIN:VEVENT', ...properties, 'END:VEVENT'].join('\r\n');

  it('liest eine umgebrochene Zeile als eine', () => {
    const events = parseIcs(
      calendar(
        event(
          'UID:a',
          'DTSTART:20261005T170000Z',
          'SUMMARY:Ein sehr langer Titel\r\n  der umgebrochen wurde',
        ),
      ),
    );

    expect(events[0].summary).toBe('Ein sehr langer Titel der umgebrochen wurde');
  });

  it('ignoriert Parameter hinter dem Eigenschaftsnamen', () => {
    const events = parseIcs(
      calendar(event('UID:a', 'DTSTART;VALUE=DATE-TIME;TZID=Europe/Berlin:20261005T170000')),
    );

    expect(events[0].dtstart.toISOString()).toBe('2026-10-05T15:00:00.000Z');
  });

  it('versteht einen ganztägigen Termin', () => {
    const events = parseIcs(calendar(event('UID:a', 'DTSTART;VALUE=DATE:20261005')));

    expect(events[0].dtstart.toISOString()).toBe('2026-10-04T22:00:00.000Z');
  });

  it('nimmt bei doppelter Eigenschaft die erste', () => {
    const events = parseIcs(
      calendar(event('UID:a', 'DTSTART:20261005T170000Z', 'SUMMARY:erster', 'SUMMARY:zweiter')),
    );

    expect(events[0].summary).toBe('erster');
  });

  it('füllt fehlende Textfelder mit einer leeren Zeichenkette', () => {
    const events = parseIcs(calendar(event('UID:a', 'DTSTART:20261005T170000Z')));

    expect(events[0]).toMatchObject({ summary: '', description: '', location: '' });
  });

  it('liest einen Kalender ohne Termine als leere Liste', () => {
    expect(parseIcs(calendar())).toEqual([]);
  });

  it('gibt bei leerer Eingabe eine leere Liste zurück', () => {
    expect(parseIcs('')).toEqual([]);
  });
});

describe('parseIcs — was übergangen wird', () => {
  const event = (...properties: string[]) =>
    ['BEGIN:VEVENT', ...properties, 'END:VEVENT'].join('\r\n');

  it('übergeht einen Termin ohne UID', () => {
    expect(parseIcs(calendar(event('DTSTART:20261005T170000Z', 'SUMMARY:ohne UID')))).toEqual([]);
  });

  it('übergeht einen Termin ohne DTSTART', () => {
    expect(parseIcs(calendar(event('UID:a', 'SUMMARY:ohne Beginn')))).toEqual([]);
  });

  it('übergeht einen Termin mit unlesbarem DTSTART, statt heute zu raten', () => {
    expect(parseIcs(calendar(event('UID:a', 'DTSTART:demnächst')))).toEqual([]);
  });

  it('lässt einen Termin mit unlesbarem DTEND gelten und rechnet zwei Stunden', () => {
    const events = parseIcs(
      calendar(event('UID:a', 'DTSTART:20261005T170000Z', 'DTEND:irgendwann')),
    );

    expect(events).toHaveLength(1);
    expect(events[0].dtend.toISOString()).toBe('2026-10-05T19:00:00.000Z');
  });

  it('übergeht einen brüchigen Termin, ohne die übrigen zu verlieren', () => {
    const events = parseIcs(
      calendar(
        event('UID:kaputt'),
        event('UID:heil', 'DTSTART:20261005T170000Z', 'SUMMARY:geht'),
      ),
    );

    expect(events.map((entry) => entry.uid)).toEqual(['heil']);
  });
});
