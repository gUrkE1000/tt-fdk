import type { ViewRow } from '../../lib/database.types';
import { eventPath, matchPath, trainingPath } from '../../lib/paths';

export type CalendarItem = ViewRow<'v_calendar_items'>;

export type CalendarKind = 'training' | 'match' | 'event' | 'birthday' | 'venue_blocked';

export interface CategoryDefinition {
  kind: CalendarKind;
  label: string;
  /** Farbe aus den Design-Tokens; die Mannschaftsfarbe sticht sie bei Spielen aus. */
  color: string;
}

/**
 * Die Kategorien des Kalenders in fester Reihenfolge — sie sind zugleich die Chips zum
 * Ein- und Ausblenden. Die Farben stehen hier als Werte und nicht als Tailwind-Klassen,
 * weil FullCalendar sie als Zeichenkette braucht.
 */
export const CATEGORIES: readonly CategoryDefinition[] = [
  { kind: 'training', label: 'Trainings', color: '#0F766E' },
  { kind: 'match', label: 'Spiele', color: '#1D4ED8' },
  { kind: 'event', label: 'Vereinstermine', color: '#7C3AED' },
  { kind: 'birthday', label: 'Geburtstage', color: '#DB2777' },
  { kind: 'venue_blocked', label: 'Halle nicht verfügbar', color: '#B45309' },
];

export const ALL_KINDS: CalendarKind[] = CATEGORIES.map((category) => category.kind);

/**
 * Wohin ein Klick auf einen Eintrag führt: auf die Seite genau dieses Spiels, dieses
 * Trainingstermins oder Vereinstermins. Ohne ID (sollte nicht vorkommen) zur Liste.
 * Geburtstage und Hallensperren haben keine Seite; dort passiert beim Klick nichts.
 */
export function detailPath(kind: CalendarKind, id?: string): string | null {
  switch (kind) {
    case 'match':
      return id ? matchPath(id) : '/my-club?tab=games';
    case 'training':
      return id ? trainingPath(id) : '/my-club?tab=trainings';
    case 'event':
      return id ? eventPath(id) : '/my-club?tab=events';
    default:
      return null;
  }
}

export interface CalendarFilters {
  kinds: CalendarKind[];
  /** „Nur Heimspiele anzeigen" — betrifft ausschließlich Spiele. */
  homeOnly: boolean;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  kinds: ALL_KINDS,
  homeOnly: false,
};

export interface DisplayEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  /** `targetId`: die ID des Spiels, Trainingstermins oder Vereinstermins — für den Link. */
  extendedProps: { kind: CalendarKind; cancelled: boolean; targetId: string };
}

/**
 * Aus Kalenderzeilen werden FullCalendar-Einträge.
 *
 * Als reine Funktion, weil hier drei Regeln zusammenkommen, die man sonst im
 * Kalender-Widget suchen müsste: welche Kategorie sichtbar ist, dass „Nur Heimspiele"
 * ausschließlich Spiele betrifft, und dass ein abgesagter Termin blass erscheint statt
 * zu verschwinden — wer zugesagt hatte, soll sehen, dass etwas ausfällt.
 */
export function toDisplayEvents(
  items: readonly CalendarItem[],
  filters: CalendarFilters,
): DisplayEvent[] {
  const byKind = new Map(CATEGORIES.map((category) => [category.kind, category.color]));
  const visible = new Set(filters.kinds);

  return items
    .filter((item) => {
      const kind = item.kind as CalendarKind | null;
      if (!kind || !visible.has(kind)) return false;
      if (filters.homeOnly && kind === 'match' && item.is_home !== true) return false;
      return item.starts_at !== null;
    })
    .map((item) => {
      const kind = item.kind as CalendarKind;
      const color = (kind === 'match' && item.color) || byKind.get(kind) || '#6B7280';

      return {
        id: `${kind}:${item.id}`,
        title: item.cancelled ? `${item.title ?? ''} (fällt aus)` : (item.title ?? ''),
        start: item.starts_at as string,
        end: (item.ends_at ?? item.starts_at) as string,
        allDay: item.all_day === true,
        backgroundColor: item.cancelled ? '#9CA3AF' : color,
        borderColor: item.cancelled ? '#9CA3AF' : color,
        extendedProps: { kind, cancelled: item.cancelled === true, targetId: item.id ?? '' },
      };
    });
}

/** Ein Chip an- oder abwählen; der letzte lässt sich nicht abwählen. */
export function toggleKind(filters: CalendarFilters, kind: CalendarKind): CalendarFilters {
  const active = filters.kinds.includes(kind);
  if (active && filters.kinds.length === 1) return filters;

  return {
    ...filters,
    kinds: active
      ? filters.kinds.filter((entry) => entry !== kind)
      : [...filters.kinds, kind],
  };
}
