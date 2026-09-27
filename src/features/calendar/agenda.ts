import { addDays, format } from 'date-fns';
import { toBerlin } from '../../lib/dates';
import type { DisplayEvent } from './events';

export interface AgendaDay {
  /** Der Tag als `yyyy-MM-dd` in deutscher Zeit. */
  day: string;
  events: DisplayEvent[];
}

function dayKey(value: string | Date): string {
  return format(toBerlin(value), 'yyyy-MM-dd');
}

/**
 * Die Tage, an denen ein Eintrag steht.
 *
 * Ein Termin mit Uhrzeit steht an seinem ersten Tag — ein Spiel bis nach Mitternacht
 * ist kein Termin für zwei Tage. Ein ganztägiger Eintrag steht an jedem Tag seines
 * Zeitraums, das Ende zählt dabei nicht mit (wie in FullCalendar): Eine Hallensperre
 * vom 1. bis 3. endet am 4. um null Uhr.
 */
function daysOf(event: DisplayEvent): string[] {
  const first = dayKey(event.start);
  if (!event.allDay) return [first];

  const last = dayKey(event.end);
  const days = [first];
  // Tageweise über den Kalender, nicht über Millisekunden: Die Zeitumstellung macht
  // sonst aus einem Tag 23 oder 25 Stunden.
  let cursor = new Date(`${first}T12:00:00`);
  for (;;) {
    cursor = addDays(cursor, 1);
    const key = format(cursor, 'yyyy-MM-dd');
    if (key >= last) break;
    days.push(key);
  }
  return days;
}

/**
 * Die Einträge eines Monats, nach Tagen gruppiert — die Listenansicht des Kalenders.
 *
 * `month` ist `yyyy-MM`. Die Fläche hinter einem gesperrten Tag gehört nur ins
 * Monatsraster; in der Liste steht die Sperre als eigener Eintrag. Ganztägiges kommt
 * am Tag zuerst, danach die Termine nach Uhrzeit.
 */
export function agendaForMonth(events: readonly DisplayEvent[], month: string): AgendaDay[] {
  const byDay = new Map<string, DisplayEvent[]>();

  for (const event of events) {
    if (event.display === 'background') continue;
    for (const day of daysOf(event)) {
      if (!day.startsWith(`${month}-`)) continue;
      const list = byDay.get(day) ?? [];
      list.push(event);
      byDay.set(day, list);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      events: [...list].sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      }),
    }));
}
