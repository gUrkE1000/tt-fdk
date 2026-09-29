import { describe, it, expect } from 'vitest';
import { parseQuery } from '../../src/features/search/parseQuery';

// Dienstag, 29.09.2026, 20:00 Uhr in Berlin (Sommerzeit, UTC+2).
const NOW = new Date('2026-09-29T18:00:00Z');

function day(iso: string): string {
  // Beginn eines Berliner Tages als UTC-Zeitpunkt.
  return new Date(`${iso}T00:00:00+02:00`).toISOString();
}

describe('parseQuery', () => {
  it('lässt Text ohne Zeitangabe unverändert', () => {
    expect(parseQuery('Borussia', NOW)).toEqual({ text: 'Borussia', range: null });
  });

  it('erkennt ein Datum ohne Jahr und nimmt das nächstliegende', () => {
    const parsed = parseQuery('12.10. Borussia', NOW);
    expect(parsed.text).toBe('Borussia');
    expect(parsed.range?.from.toISOString()).toBe(day('2026-10-12'));
    expect(parsed.range?.to.toISOString()).toBe(day('2026-10-13'));
    expect(parsed.range?.label).toBe('Mo 12.10.');
  });

  it('nimmt im Januar ein Dezember-Datum aus dem Vorjahr, nicht aus dem nächsten', () => {
    const parsed = parseQuery('20.12.', new Date('2027-01-05T10:00:00Z'));
    expect(parsed.range?.from.toISOString()).toBe(new Date('2026-12-20T00:00:00+01:00').toISOString());
  });

  it('erkennt ein Datum mit Jahr, zwei- und vierstellig', () => {
    expect(parseQuery('03.01.27', NOW).range?.from.toISOString()).toBe(
      new Date('2027-01-03T00:00:00+01:00').toISOString(),
    );
    expect(parseQuery('03.01.2027', NOW).range?.label).toBe('So 03.01.');
  });

  it('verwirft unmögliche Daten und lässt sie als Text stehen', () => {
    expect(parseQuery('31.02.', NOW)).toEqual({ text: '31.02.', range: null });
  });

  it('hält „1. Herren" nicht für ein Datum', () => {
    expect(parseQuery('1. Herren', NOW).range).toBeNull();
  });

  it('versteht heute, morgen, übermorgen und gestern', () => {
    expect(parseQuery('heute', NOW).range?.from.toISOString()).toBe(day('2026-09-29'));
    expect(parseQuery('morgen', NOW).range?.from.toISOString()).toBe(day('2026-09-30'));
    expect(parseQuery('übermorgen', NOW).range?.from.toISOString()).toBe(day('2026-10-01'));
    expect(parseQuery('gestern', NOW).range?.from.toISOString()).toBe(day('2026-09-28'));
  });

  it('rechnet „morgen" in deutscher Zeit, auch kurz nach Mitternacht', () => {
    // 30.09. 00:30 in Berlin ist noch der 29.09. in UTC.
    const parsed = parseQuery('morgen', new Date('2026-09-29T22:30:00Z'));
    expect(parsed.range?.from.toISOString()).toBe(day('2026-10-01'));
  });

  it('nimmt beim Wochentag das nächste Vorkommen, heute eingeschlossen', () => {
    const parsed = parseQuery('Samstag Borussia', NOW);
    expect(parsed.text).toBe('Borussia');
    expect(parsed.range?.from.toISOString()).toBe(day('2026-10-03'));
    expect(parseQuery('dienstag', NOW).range?.from.toISOString()).toBe(day('2026-09-29'));
    expect(parseQuery('am nächsten Montag', NOW).range?.from.toISOString()).toBe(day('2026-10-05'));
  });

  it('versteht „letzten Samstag"', () => {
    expect(parseQuery('letzten samstag', NOW).range?.from.toISOString()).toBe(day('2026-09-26'));
  });

  it('versteht Wochen', () => {
    const next = parseQuery('nächste Woche', NOW).range!;
    expect(next.from.toISOString()).toBe(day('2026-10-05'));
    expect(next.to.toISOString()).toBe(day('2026-10-12'));
    expect(parseQuery('diese woche', NOW).range?.from.toISOString()).toBe(day('2026-09-28'));
    expect(parseQuery('letzte Woche', NOW).range?.from.toISOString()).toBe(day('2026-09-21'));
  });

  it('versteht das Wochenende', () => {
    const range = parseQuery('wochenende', NOW).range!;
    expect(range.from.toISOString()).toBe(day('2026-10-03'));
    expect(range.to.toISOString()).toBe(day('2026-10-05'));
    // Am Sonntag ist „nächstes Wochenende" das folgende.
    const sunday = new Date('2026-10-04T10:00:00Z');
    expect(parseQuery('wochenende', sunday).range?.from.toISOString()).toBe(day('2026-10-04'));
    expect(parseQuery('nächstes wochenende', sunday).range?.from.toISOString()).toBe(
      day('2026-10-10'),
    );
  });

  it('versteht Monate, auch rückblickend', () => {
    const october = parseQuery('im Oktober', NOW).range!;
    expect(october.from.toISOString()).toBe(day('2026-10-01'));
    expect(october.to.toISOString()).toBe(new Date('2026-11-01T00:00:00+01:00').toISOString());
    expect(october.label).toBe('Oktober 2026');
    expect(parseQuery('august', NOW).range?.label).toBe('August 2026');
    expect(parseQuery('januar', NOW).range?.label).toBe('Januar 2027');
    expect(parseQuery('März 2026', NOW).range?.label).toBe('März 2026');
  });

  it('verwechselt „Mai" nicht mit „Maier"', () => {
    expect(parseQuery('Maier', NOW).range).toBeNull();
  });
});
