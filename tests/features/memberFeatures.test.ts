import { describe, it, expect } from 'vitest';
import { buildOpenItems } from '../../src/features/dashboard/openItems';
import { groupResponses } from '../../src/features/matches/responseGroups';
import { mergeHistory, type HistoryRow } from '../../src/features/notifications/history';
import { detailPath } from '../../src/features/calendar/events';
import { mapsUrl } from '../../src/lib/maps';
import type { Participation } from '../../src/features/matches/api';

describe('buildOpenItems', () => {
  it('sortiert Termine nach Datum und stellt Umfragen dahinter', () => {
    const items = buildOpenItems(
      [
        { kind: 'event', id: 'e-1', starts_at: '2026-10-20T10:00:00Z', title: 'Clubmeisterschaft' },
        { kind: 'match', id: 'm-1', starts_at: '2026-10-02T17:00:00Z', title: '1. Herren' },
        { kind: 'training', id: 's-1', starts_at: '2026-10-05T17:00:00Z', title: 'Training' },
      ],
      [
        { id: 'p-2', title: 'Ohne Ablauf', expires_at: null },
        { id: 'p-1', title: 'Mit Ablauf', expires_at: '2026-10-01T10:00:00Z' },
      ],
    );

    expect(items.map((item) => item.id)).toEqual(['m-1', 's-1', 'e-1', 'p-1', 'p-2']);
    expect(items[3]).toMatchObject({ kind: 'poll', date: '2026-10-01T10:00:00Z' });
  });

  it('übergeht Zeilen ohne Kennung oder mit unbekannter Art', () => {
    const items = buildOpenItems(
      [
        { kind: 'match', id: null, starts_at: null, title: 'kaputt' },
        { kind: 'irgendwas', id: 'x', starts_at: null, title: 'fremd' },
      ],
      [],
    );
    expect(items).toEqual([]);
  });
});

describe('groupResponses', () => {
  const base = { match_id: 'm-1', removed: false, version_responded: 2 } as const;
  const rows = [
    { ...base, profile_id: 'a', response: 'yes' },
    { ...base, profile_id: 'b', response: 'no' },
    { ...base, profile_id: 'c', response: 'unclear' },
    { ...base, profile_id: 'd', response: 'none', version_responded: null },
    // Zusage zur alten Fassung zählt als offen.
    { ...base, profile_id: 'e', response: 'yes', version_responded: 1 },
    // Vom Mannschaftsführer herausgenommen: zählt gar nicht.
    { ...base, profile_id: 'f', response: 'yes', removed: true },
  ] as unknown as Participation[];

  const names: Record<string, string> = { a: 'Anna', b: 'Bernd', c: 'Carla', d: 'Dora', e: 'Emil', f: 'Fritz' };

  it('teilt nach Antwort auf und behandelt veraltete Antworten als offen', () => {
    const groups = groupResponses({ version: 2 }, rows, (id) => names[id]);
    expect(groups).toEqual({
      yes: ['Anna'],
      unclear: ['Carla'],
      no: ['Bernd'],
      open: ['Dora', 'Emil'],
    });
  });
});

describe('mergeHistory', () => {
  const row = (id: string, channel: string, at: string, subject = 'Erinnerung'): HistoryRow =>
    ({
      id,
      channel,
      type: 'match_reminder',
      subject,
      body_text: 'Text',
      payload: { link: 'http://localhost:5173/r/abc' },
      scheduled_for: at,
      status: 'sent',
    }) as HistoryRow;

  it('fasst App und E-Mail derselben Mitteilung zusammen, neueste zuerst', () => {
    const entries = mergeHistory([
      row('1', 'email', '2026-10-01T10:00:00Z'),
      row('2', 'push', '2026-10-01T10:00:00Z'),
      row('3', 'push', '2026-10-03T10:00:00Z', 'Neue Umfrage'),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0].subject).toBe('Neue Umfrage');
    expect(entries[1].channels.sort()).toEqual(['email', 'push']);
    expect(entries[1].link).toBe('http://localhost:5173/r/abc');
  });
});

describe('detailPath', () => {
  it('führt Spiele, Trainings und Vereinstermine zu ihrer Karte', () => {
    expect(detailPath('match')).toBe('/my-club?tab=games');
    expect(detailPath('training')).toBe('/my-club?tab=trainings');
    expect(detailPath('event')).toBe('/my-club?tab=events');
  });

  it('lässt Geburtstage und Hallensperren ohne Ziel', () => {
    expect(detailPath('birthday')).toBeNull();
    expect(detailPath('venue_blocked')).toBeNull();
  });
});

describe('mapsUrl', () => {
  it('baut einen Suchlink aus der Adresse', () => {
    expect(mapsUrl('Turnstraße 5,  12345 Musterstadt')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Turnstra%C3%9Fe%205%2C%2012345%20Musterstadt',
    );
  });

  it('gibt ohne Adresse keinen Link', () => {
    expect(mapsUrl('')).toBeNull();
    expect(mapsUrl(null)).toBeNull();
    expect(mapsUrl('   ')).toBeNull();
  });
});
