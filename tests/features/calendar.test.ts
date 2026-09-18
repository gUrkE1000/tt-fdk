import { describe, it, expect } from 'vitest';
import {
  ALL_KINDS,
  CATEGORIES,
  DEFAULT_CALENDAR_FILTERS,
  toDisplayEvents,
  toggleKind,
  type CalendarItem,
} from '../../src/features/calendar/events';

function item(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    kind: 'training',
    id: 'x-1',
    title: 'Erwachsenentraining',
    starts_at: '2026-10-06T17:00:00Z',
    ends_at: '2026-10-06T19:00:00Z',
    all_day: false,
    color: null,
    venue_id: 'v-1',
    is_home: null,
    cancelled: false,
    ...overrides,
  } as CalendarItem;
}

describe('CATEGORIES', () => {
  it('nennt die fünf Kategorien des TT-Planers', () => {
    expect(CATEGORIES.map((category) => category.label)).toEqual([
      'Trainings',
      'Spiele',
      'Vereinstermine',
      'Geburtstage',
      'Halle nicht verfügbar',
    ]);
  });

  it('gibt jeder Kategorie eine eigene Farbe', () => {
    expect(new Set(CATEGORIES.map((category) => category.color)).size).toBe(CATEGORIES.length);
  });
});

describe('toDisplayEvents', () => {
  it('macht aus einer Zeile einen Kalendereintrag', () => {
    const [event] = toDisplayEvents([item()], DEFAULT_CALENDAR_FILTERS);

    expect(event.id).toBe('training:x-1');
    expect(event.title).toBe('Erwachsenentraining');
    expect(event.allDay).toBe(false);
    expect(event.extendedProps.kind).toBe('training');
  });

  it('blendet abgewählte Kategorien aus', () => {
    const items = [item(), item({ kind: 'match', id: 'm-1', is_home: true })];
    const events = toDisplayEvents(items, { kinds: ['match'], homeOnly: false });

    expect(events).toHaveLength(1);
    expect(events[0].extendedProps.kind).toBe('match');
  });

  it('nimmt für ein Spiel die Mannschaftsfarbe', () => {
    const [event] = toDisplayEvents(
      [item({ kind: 'match', id: 'm-1', color: '#1D4ED8', is_home: true })],
      DEFAULT_CALENDAR_FILTERS,
    );
    expect(event.backgroundColor).toBe('#1D4ED8');
  });

  it('fällt bei einem Spiel ohne Farbe auf die Kategoriefarbe zurück', () => {
    const [event] = toDisplayEvents(
      [item({ kind: 'match', id: 'm-1', color: null, is_home: true })],
      DEFAULT_CALENDAR_FILTERS,
    );
    expect(event.backgroundColor).toBe('#1D4ED8');
  });

  it('lässt „Nur Heimspiele" alles außer Auswärtsspielen stehen', () => {
    const items = [
      item(),
      item({ kind: 'match', id: 'm-1', is_home: true }),
      item({ kind: 'match', id: 'm-2', is_home: false }),
      item({ kind: 'birthday', id: 'b-1', all_day: true }),
    ];

    const events = toDisplayEvents(items, { ...DEFAULT_CALENDAR_FILTERS, homeOnly: true });

    expect(events.map((event) => event.id)).toEqual([
      'training:x-1',
      'match:m-1',
      'birthday:b-1',
    ]);
  });

  it('zeigt einen abgesagten Termin blass statt ihn zu verstecken', () => {
    const [event] = toDisplayEvents([item({ cancelled: true })], DEFAULT_CALENDAR_FILTERS);

    expect(event.title).toBe('Erwachsenentraining (fällt aus)');
    expect(event.backgroundColor).toBe('#9CA3AF');
  });

  it('übergeht Zeilen ohne Zeitpunkt', () => {
    expect(toDisplayEvents([item({ starts_at: null })], DEFAULT_CALENDAR_FILTERS)).toEqual([]);
  });

  it('nimmt den Beginn als Ende, wenn keins da ist', () => {
    const [event] = toDisplayEvents([item({ ends_at: null })], DEFAULT_CALENDAR_FILTERS);
    expect(event.end).toBe(event.start);
  });
});

describe('toggleKind', () => {
  it('blendet eine Kategorie aus und wieder ein', () => {
    const off = toggleKind(DEFAULT_CALENDAR_FILTERS, 'match');
    expect(off.kinds).not.toContain('match');

    const on = toggleKind(off, 'match');
    expect(on.kinds).toContain('match');
  });

  it('lässt die letzte Kategorie nicht abwählen', () => {
    // Ein leerer Kalender sähe aus wie ein Fehler, nicht wie eine Einstellung.
    const single = { kinds: ['match' as const], homeOnly: false };
    expect(toggleKind(single, 'match')).toBe(single);
  });

  it('beginnt mit allen Kategorien', () => {
    expect(DEFAULT_CALENDAR_FILTERS.kinds).toEqual(ALL_KINDS);
  });
});
