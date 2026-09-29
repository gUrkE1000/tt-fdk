import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import Button from './Button';

/**
 * So viele Einträge zeigt jede Liste auf einmal. Einheitlich überall — wer mehr will,
 * holt sich die nächsten mit „Weitere anzeigen".
 *
 * Die Daten selbst lädt die App weiter vollständig: Filter, Suche und Zähler („Offene
 * Termine (85)") brauchen die ganze Liste, und dieselben Abfragen teilen sich Kalender,
 * Übersicht und Listen. Teuer ist auf dem Telefon das Zeichnen hunderter Karten — das
 * begrenzt diese Seitengröße.
 */
export const PAGE_SIZE = 30;

export interface Paged<T> {
  /** Die ersten `count` Einträge. */
  shown: T[];
  /** Wie viele noch nicht angezeigt werden. */
  rest: number;
  /** Die nächsten {@link PAGE_SIZE} dazunehmen. */
  more: () => void;
}

/**
 * Eine Liste seitenweise zeigen.
 *
 * `resetKey`: ändert er sich (andere Suche, anderer Filter), beginnt die Liste wieder
 * bei der ersten Seite — sonst stünden nach einem Filterwechsel womöglich 90 Treffer
 * offen, nur weil vorher jemand zweimal „Weitere" gedrückt hat.
 */
export function usePaged<T>(items: readonly T[], resetKey?: unknown, pageSize = PAGE_SIZE): Paged<T> {
  const [state, setState] = useState({ count: pageSize, key: resetKey });

  // Zurücksetzen während des Renderns statt in einem Effekt: So erscheint nie ein Bild
  // mit der alten Seitenzahl. (Muster aus der React-Dokumentation, „Adjusting state
  // when a prop changes".)
  let count = state.count;
  if (!Object.is(state.key, resetKey)) {
    count = pageSize;
    setState({ count, key: resetKey });
  }

  return {
    shown: items.slice(0, count),
    rest: Math.max(0, items.length - count),
    more: () => setState((current) => ({ ...current, count: current.count + pageSize })),
  };
}

export interface ShowMoreProps {
  rest: number;
  onMore: () => void;
  pageSize?: number;
}

/** „Weitere 30 anzeigen" unter einer Liste; verschwindet, wenn alles zu sehen ist. */
export default function ShowMore({ rest, onMore, pageSize = PAGE_SIZE }: ShowMoreProps) {
  if (rest <= 0) return null;
  return (
    <div className="mt-3 flex justify-center">
      <Button onClick={onMore}>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
        Weitere {Math.min(pageSize, rest)} anzeigen{' '}
        <span className="font-normal text-gray-500">(noch {rest})</span>
      </Button>
    </div>
  );
}

export interface PagedListProps<T> {
  items: readonly T[];
  /** Ein Eintrag; muss ein Element mit `key` liefern. */
  children: (item: T) => ReactNode;
  resetKey?: unknown;
  className?: string;
}

/** Eine Liste von Karten, seitenweise — {@link usePaged} und {@link ShowMore} in einem. */
export function PagedList<T>({ items, children, resetKey, className = 'space-y-3' }: PagedListProps<T>) {
  const { shown, rest, more } = usePaged(items, resetKey);
  return (
    <>
      <div className={className}>{shown.map(children)}</div>
      <ShowMore rest={rest} onMore={more} />
    </>
  );
}
