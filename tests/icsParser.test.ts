import { describe, it, expect } from 'vitest';
import {
  parseIcs,
  unfoldLines,
  parseLocalDateToUtc,
  determineHomeAway,
  extractMatchday
} from '../src/lib/icsParser';

describe('ICS Parser tests', () => {
  it('should unfold wrapped lines in ICS content', () => {
    const raw = "SUMMARY:This is a very long text that was split\r\n over multiple lines in the raw\r\n\tICS representation.";
    const expected = "SUMMARY:This is a very long text that was splitover multiple lines in the rawICS representation.";
    expect(unfoldLines(raw)).toBe(expected);
  });

  it('should correctly parse Europe/Berlin local times to UTC', () => {
    const dateDst = parseLocalDateToUtc(2026, 8, 12, 18, 0, 0);
    expect(dateDst.getUTCHours()).toBe(16);
    expect(dateDst.getUTCDate()).toBe(12);

    const dateNoDst = parseLocalDateToUtc(2026, 11, 12, 18, 0, 0);
    expect(dateNoDst.getUTCHours()).toBe(17);
    expect(dateNoDst.getUTCDate()).toBe(12);
  });

  it('should parse home and away games correctly based on team name', () => {
    const teamName = "Heiligenhauser SV III";
    const teamShortName = "Heiligenhauser SV 3";

    const homeRes = determineHomeAway("Heiligenhauser SV III vs TV Klaswipper III", teamName, teamShortName);
    expect(homeRes.isHome).toBe(true);
    expect(homeRes.opponent).toBe("TV Klaswipper III");

    const awayRes = determineHomeAway("VfL Engelskirchen vs Heiligenhauser SV III", teamName, teamShortName);
    expect(awayRes.isHome).toBe(false);
    expect(awayRes.opponent).toBe("VfL Engelskirchen");
  });

  it('should extract matchday number correctly from description/summary', () => {
    const desc1 = "Spielnummer: 54321\\, Spieltag: 5";
    expect(extractMatchday(desc1, "")).toBe(5);

    const desc2 = "Some description text without matchday";
    const summary2 = "Erwachsene III Spieltag 12";
    expect(extractMatchday(desc2, summary2)).toBe(12);

    expect(extractMatchday("no numbers here", "nor here")).toBeNull();
  });

  it('should parse a complete multi-event ICS stream correctly', () => {
    const rawIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//myTischtennis.de//NONSGML v1.0//EN
BEGIN:VEVENT
UID:531e13f1-cb9a-4abd-bc07-3bc454c7e1b7
DTSTART;TZID=Europe/Berlin:20260912T180000
DTEND;TZID=Europe/Berlin:20260912T210000
SUMMARY:Heiligenhauser SV III vs TV Klaswipper III
LOCATION:Heiligenhaus\\, Turnhalle
DESCRIPTION:Spieltag: 1\\, Spielnummer: 100
END:VEVENT
BEGIN:VEVENT
UID:98765432-abcd-ef01-2345-6789abcdef01
DTSTART:20260919T180000Z
SUMMARY:VfL Engelskirchen vs Heiligenhauser SV III
LOCATION:Engelskirchen\\, Halle
DESCRIPTION:Spieltag 2\\, Spielnummer: 101
END:VEVENT
END:VCALENDAR`;

    const events = parseIcs(rawIcs);
    expect(events).toHaveLength(2);

    expect(events[0].uid).toBe("531e13f1-cb9a-4abd-bc07-3bc454c7e1b7");
    expect(events[0].summary).toBe("Heiligenhauser SV III vs TV Klaswipper III");
    expect(events[0].location).toBe("Heiligenhaus, Turnhalle");
    expect(events[0].dtstart.toISOString()).toBe("2026-09-12T16:00:00.000Z");

    expect(events[1].uid).toBe("98765432-abcd-ef01-2345-6789abcdef01");
    expect(events[1].summary).toBe("VfL Engelskirchen vs Heiligenhauser SV III");
    expect(events[1].dtstart.toISOString()).toBe("2026-09-19T18:00:00.000Z");
  });
});
