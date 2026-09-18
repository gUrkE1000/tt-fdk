import { describe, it, expect } from 'vitest';
import {
  buildIcs,
  escapeIcsText,
  formatIcsDate,
  parseIcs,
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

const build = (entries: IcsEntry[], calendarName = 'Verein') =>
  buildIcs(entries, { calendarName, now: NOW });

describe('formatIcsDate', () => {
  it('schreibt UTC ohne Trennzeichen und ohne Millisekunden', () => {
    expect(formatIcsDate(new Date('2026-10-05T17:00:00Z'))).toBe('20261005T170000Z');
  });

  it('rechnet einen Zeitpunkt mit Offset nach UTC um', () => {
    expect(formatIcsDate(new Date('2026-10-05T19:00:00+02:00'))).toBe('20261005T170000Z');
  });
});

describe('escapeIcsText', () => {
  it('maskiert den Backslash', () => {
    expect(escapeIcsText('a\\b')).toBe('a\\\\b');
  });

  it('maskiert das Komma', () => {
    expect(escapeIcsText('Halle, Eingang B')).toBe('Halle\\, Eingang B');
  });

  it('maskiert das Semikolon', () => {
    expect(escapeIcsText('Halle; hinten')).toBe('Halle\\; hinten');
  });

  it('macht aus einem Zeilenumbruch ein \\n', () => {
    expect(escapeIcsText('Zeile\nZweite')).toBe('Zeile\\nZweite');
  });

  it('maskiert die eingefügten Backslashes nicht ein zweites Mal', () => {
    expect(escapeIcsText('a,b')).toBe('a\\,b');
  });

  it('lässt Text ohne Sonderzeichen unangetastet', () => {
    expect(escapeIcsText('Sporthalle Musterstadt')).toBe('Sporthalle Musterstadt');
  });
});

describe('buildIcs — Kalenderrahmen', () => {
  it('schreibt Kopf und Fuß', () => {
    const ics = build([entry()], 'TTC Musterstadt');

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('X-WR-CALNAME:TTC Musterstadt');
  });

  it('beendet auch die letzte Zeile mit CRLF', () => {
    expect(build([entry()]).endsWith('\r\n')).toBe(true);
  });

  it('nutzt ausschließlich CRLF', () => {
    const ics = build([entry()]);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('kommt ohne Termine zurecht', () => {
    const ics = build([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});

describe('buildIcs — ein Termin', () => {
  it('schreibt UID, Zeiten und Ort', () => {
    const ics = build([entry()]);

    expect(ics).toContain('UID:match-m1@vereinsplaner');
    expect(ics).toContain('DTSTART:20261005T170000Z');
    expect(ics).toContain('DTEND:20261005T210000Z');
    expect(ics).toContain('LOCATION:Sporthalle Musterstadt');
  });

  it('setzt DTSTAMP auf den übergebenen Zeitpunkt', () => {
    expect(build([entry()])).toContain('DTSTAMP:20260918T080000Z');
  });

  it('lässt Ort und Beschreibung weg, wenn nichts da ist', () => {
    const ics = build([entry({ location: null, description: null })]);

    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
  });

  it('schreibt eine Beschreibung, wenn eine da ist', () => {
    expect(build([entry({ description: 'Treffpunkt 16:15 Uhr' })])).toContain(
      'DESCRIPTION:Treffpunkt 16:15 Uhr',
    );
  });

  it('maskiert Sonderzeichen im Titel', () => {
    expect(build([entry({ title: 'Feier, groß; mit allem' })])).toContain(
      'SUMMARY:Feier\\, groß\\; mit allem',
    );
  });
});

describe('buildIcs — krumme Zeitangaben', () => {
  it('gibt einem Termin ohne Ende zwei Stunden', () => {
    expect(build([entry({ endsAt: null })])).toContain('DTEND:20261005T190000Z');
  });

  it('ersetzt ein Ende vor dem Anfang', () => {
    expect(build([entry({ endsAt: '2026-10-05T16:00:00Z' })])).toContain(
      'DTEND:20261005T190000Z',
    );
  });

  it('ersetzt ein unlesbares Ende', () => {
    expect(build([entry({ endsAt: 'demnächst' })])).toContain('DTEND:20261005T190000Z');
  });

  it('übergeht einen Termin ohne brauchbaren Anfang', () => {
    expect(build([entry({ startsAt: 'kaputt' })])).not.toContain('BEGIN:VEVENT');
  });

  it('übergeht nur den kaputten Termin, nicht die übrigen', () => {
    const ics = build([entry({ uid: 'kaputt', startsAt: 'kaputt' }), entry({ uid: 'heil' })]);

    expect(ics).not.toContain('UID:kaputt');
    expect(ics).toContain('UID:heil');
  });
});

describe('buildIcs — lange Zeilen', () => {
  it('bricht sie auf höchstens 75 Oktett um', () => {
    const ics = build([entry({ title: 'x'.repeat(200) })]);

    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('beginnt jede Fortsetzung mit einem Leerzeichen', () => {
    expect(build([entry({ title: 'x'.repeat(200) })])).toMatch(/\r\n x/);
  });

  it('zählt Umlaute als zwei Oktett', () => {
    // Mit Zeichen statt Oktett gezählt liefe diese Zeile über die Grenze.
    const ics = build([entry({ title: 'ä'.repeat(120) })]);

    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('zerschneidet kein Zeichen', () => {
    const ics = build([entry({ title: 'ä'.repeat(120) })]);

    // Ein zerschnittenes Zeichen käme als Ersatzzeichen zurück.
    expect(ics).not.toContain('�');
    expect(ics.replace(/\r\n /g, '')).toContain('ä'.repeat(120));
  });
});

describe('buildIcs und parseIcs zusammen', () => {
  it('liest wieder heraus, was hineingeschrieben wurde', () => {
    const original = entry({
      title: 'Jahreshauptversammlung, 19 Uhr',
      location: 'Vereinsheim; Nebenraum',
      description: 'Mit Vorstandswahl',
    });

    const [parsed] = parseIcs(build([original]));

    expect(parsed.uid).toBe(original.uid);
    expect(parsed.summary).toBe(original.title);
    expect(parsed.location).toBe(original.location);
    expect(parsed.description).toBe(original.description);
    expect(parsed.dtstart.toISOString()).toBe(original.startsAt.replace('Z', '.000Z'));
  });

  it('übersteht auch einen Titel, der umgebrochen werden muss', () => {
    const title = `Auswärtsspiel bei ${'sehr '.repeat(20)}weit weg`;
    const [parsed] = parseIcs(build([entry({ title })]));

    expect(parsed.summary).toBe(title);
  });
});
