import { describe, it, expect } from 'vitest';
import { determineHomeAway, extractMatchday, parseIcs } from '../src/lib/icsParser';

describe('Real Table Tennis Calendar Parsing & Home-Away Tests', () => {
  it('should correctly parse real myTischtennis calendar content and classify home/away', () => {
    // Exact calendar strings exported by myTischtennis.de
    const realIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//sebbo.net//ical-generator//EN
URL:https://www.mytischtennis.de/community/exportICSCalendar?teamIds=3142285
NAME:Termine von Heiligenhauser SV III
X-WR-CALNAME:Termine von Heiligenhauser SV III
TIMEZONE-ID:Europe/Berlin
X-WR-TIMEZONE:Europe/Berlin
BEGIN:VEVENT
UID:9cec5d29-065a-49db-ab90-92adb69609c2
SEQUENCE:0
DTSTAMP:20260810T185230
DTSTART;TZID=Europe/Berlin:20260912T180000
DTEND;TZID=Europe/Berlin:20260912T210000
SUMMARY:Heiligenhauser SV III vs TV Klaswipper III
LOCATION:Realschule Cyriax Zweifachhalle\, Overath
DESCRIPTION:Spieltag: 1\\, Spielnummer: 100
END:VEVENT
BEGIN:VEVENT
UID:7e61eca3-8260-4760-94fe-f2000d0db40f
SEQUENCE:0
DTSTAMP:20260810T185230
DTSTART;TZID=Europe/Berlin:20260914T183000
DTEND;TZID=Europe/Berlin:20260914T213000
SUMMARY:VfL Engelskirchen vs Heiligenhauser SV III
LOCATION:Grundschule Engelskirchen\, Engelskirchen
DESCRIPTION:Vorrunde\\, 2. Spieltag\\, Spielnummer: 101
END:VEVENT
END:VCALENDAR`;

    const events = parseIcs(realIcsContent);
    expect(events).toHaveLength(2);

    const teamName = "Erwachsene III";
    const teamShortName = "Erwachsene 3";

    // Event 1: Heiligenhauser SV III vs TV Klaswipper III (Home Game)
    const event1 = events[0];
    expect(event1.summary).toBe("Heiligenhauser SV III vs TV Klaswipper III");

    const info1 = determineHomeAway(event1.summary, teamName, teamShortName);
    expect(info1.isHome).toBe(true);
    expect(info1.opponent).toBe("TV Klaswipper III");

    const matchday1 = extractMatchday(event1.description, event1.summary);
    expect(matchday1).toBe(1);

    // Event 2: VfL Engelskirchen vs Heiligenhauser SV III (Away Game)
    const event2 = events[1];
    expect(event2.summary).toBe("VfL Engelskirchen vs Heiligenhauser SV III");

    const info2 = determineHomeAway(event2.summary, teamName, teamShortName);
    expect(info2.isHome).toBe(false);
    expect(info2.opponent).toBe("VfL Engelskirchen");

    const matchday2 = extractMatchday(event2.description, event2.summary);
    expect(matchday2).toBe(2);
  });
});
