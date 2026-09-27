import { describe, it, expect } from 'vitest';
import { agendaForMonth } from '../../src/features/calendar/agenda';
import type { DisplayEvent } from '../../src/features/calendar/events';

function event(overrides: Partial<DisplayEvent> = {}): DisplayEvent {
  return {
    id: 'training:1',
    title: 'Training',
    start: '2026-09-28T17:00:00Z',
    end: '2026-09-28T19:00:00Z',
    allDay: false,
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
    extendedProps: { kind: 'training', cancelled: false, targetId: '1' },
    ...overrides,
  };
}

describe('agendaForMonth', () => {
  it('gruppiert nach Tagen in deutscher Zeit und sortiert Ganztägiges nach vorn', () => {
    const days = agendaForMonth(
      [
        event({ id: 'a', start: '2026-09-28T17:00:00Z' }),
        event({ id: 'b', start: '2026-09-18T16:30:00Z' }),
        event({
          id: 'c',
          allDay: true,
          start: '2026-09-28T00:00:00Z',
          end: '2026-09-29T00:00:00Z',
          extendedProps: { kind: 'key_duty', cancelled: false, targetId: 'c' },
        }),
        // 23:30 UTC am 30. ist in Berlin schon der 1. Oktober.
        event({ id: 'd', start: '2026-09-30T23:30:00Z' }),
      ],
      '2026-09',
    );

    expect(days.map((day) => day.day)).toEqual(['2026-09-18', '2026-09-28']);
    expect(days[1].events.map((entry) => entry.id)).toEqual(['c', 'a']);
  });

  it('zeigt eine mehrtägige Sperre an jedem Tag, aber nicht am Endtag', () => {
    const days = agendaForMonth(
      [
        event({
          id: 'sperre',
          allDay: true,
          start: '2026-10-30T00:00:00Z',
          end: '2026-11-03T00:00:00Z',
          extendedProps: { kind: 'venue_blocked', cancelled: false, targetId: 's' },
        }),
      ],
      '2026-11',
    );

    expect(days.map((day) => day.day)).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('lässt die Hintergrundfläche einer Sperre weg', () => {
    expect(agendaForMonth([event({ display: 'background' })], '2026-09')).toEqual([]);
  });
});
