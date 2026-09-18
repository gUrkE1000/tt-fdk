import { describe, it, expect } from 'vitest';
import { extractMatchday, parseIcs } from '../../supabase/functions/_shared/ics';
import { determineHomeAway } from '../../supabase/functions/_shared/homeAway';

/**
 * Der Weg, den ein Spieltermin tatsächlich nimmt: Feed → `parseIcs` → `determineHomeAway`
 * → `extractMatchday`. Jede der drei Funktionen ist einzeln geprüft; dieser Test prüft,
 * dass sie zusammenpassen.
 *
 * Die Vorlage hat die Form, in der myTischtennis einen Mannschaftskalender ausliefert —
 * mit Kopfzeilen, die uns nicht interessieren, mit `TZID=Europe/Berlin` statt UTC und mit
 * maskierten Kommas in Ort und Beschreibung. Verein, Halle und Gegner sind erfunden.
 */
const FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//sebbo.net//ical-generator//EN
URL:https://www.mytischtennis.de/community/exportICSCalendar?teamIds=1234567
NAME:Termine von TTC Musterstadt III
X-WR-CALNAME:Termine von TTC Musterstadt III
TIMEZONE-ID:Europe/Berlin
X-WR-TIMEZONE:Europe/Berlin
BEGIN:VEVENT
UID:9cec5d29-065a-49db-ab90-92adb69609c2
SEQUENCE:0
DTSTAMP:20260810T185230
DTSTART;TZID=Europe/Berlin:20260912T180000
DTEND;TZID=Europe/Berlin:20260912T210000
SUMMARY:TTC Musterstadt III vs TV Beispieldorf III
LOCATION:Realschule am Anger Zweifachhalle\\, Musterstadt
DESCRIPTION:Spieltag: 1\\, Spielnummer: 100
END:VEVENT
BEGIN:VEVENT
UID:7e61eca3-8260-4760-94fe-f2000d0db40f
SEQUENCE:0
DTSTAMP:20260810T185230
DTSTART;TZID=Europe/Berlin:20260914T183000
DTEND;TZID=Europe/Berlin:20260914T213000
SUMMARY:VfL Beispielstadt vs TTC Musterstadt III
LOCATION:Grundschule Beispielstadt\\, Beispielstadt
DESCRIPTION:Vorrunde\\, 2. Spieltag\\, Spielnummer: 101
END:VEVENT
END:VCALENDAR`;

const CLUB_ALIASES = ['ttc musterstadt', 'musterstadt'];
const TEAM_NAME = 'Erwachsene III';

describe('Ein Mannschaftskalender, wie er ankommt', () => {
  const events = parseIcs(FEED);

  it('findet beide Termine und ignoriert die Kopfzeilen', () => {
    expect(events).toHaveLength(2);
  });

  it('rechnet die Ortszeit in der Sommerzeit richtig um', () => {
    expect(events[0].dtstart.toISOString()).toBe('2026-09-12T16:00:00.000Z');
    expect(events[1].dtstart.toISOString()).toBe('2026-09-14T16:30:00.000Z');
  });

  it('gibt den Ort ohne Maskierung zurück', () => {
    expect(events[0].location).toBe('Realschule am Anger Zweifachhalle, Musterstadt');
  });

  describe('der erste Termin — ein Heimspiel', () => {
    it('erkennt uns auf der linken Seite', () => {
      const info = determineHomeAway(events[0].summary, TEAM_NAME, CLUB_ALIASES);
      expect(info).toEqual({ isHome: true, opponent: 'TV Beispieldorf III' });
    });

    it('liest den Spieltag aus der Beschreibung', () => {
      expect(extractMatchday(events[0].description, events[0].summary)).toBe(1);
    });
  });

  describe('der zweite Termin — ein Auswärtsspiel', () => {
    it('erkennt uns auf der rechten Seite', () => {
      const info = determineHomeAway(events[1].summary, TEAM_NAME, CLUB_ALIASES);
      expect(info).toEqual({ isHome: false, opponent: 'VfL Beispielstadt' });
    });

    it('liest den Spieltag auch in der Schreibweise „2. Spieltag"', () => {
      expect(extractMatchday(events[1].description, events[1].summary)).toBe(2);
    });
  });

  it('kommt ohne gepflegte Aliase über den Mannschaftsnamen nicht weiter', () => {
    // Der Verband schreibt „TTC Musterstadt III", wir nennen die Mannschaft intern
    // „Erwachsene III". Ohne Alias passt keine Seite — die Anwendung nimmt dann ein
    // Heimspiel an. Genau deshalb steht „Weitere Schreibweisen" in den Vereinsdaten.
    const info = determineHomeAway(events[1].summary, TEAM_NAME, []);
    expect(info.isHome).toBe(true);
  });
});
