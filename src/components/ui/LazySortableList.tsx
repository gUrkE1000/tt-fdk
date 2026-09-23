import { lazy, Suspense } from 'react';
import type { SortableListProps } from './SortableList';

const List = lazy(() => import('./SortableList'));

/**
 * Drag-and-drop braucht nur, wer eine Reihenfolge festlegt (Mannschaftsführer, Admin).
 * Die Bibliothek lädt deshalb erst mit der ersten sortierbaren Liste, nicht beim Start
 * der App für jedes Mitglied.
 */
export default function LazySortableList(props: SortableListProps) {
  return (
    <Suspense
      fallback={
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" aria-busy="true" aria-label="Liste wird geladen" />
      }
    >
      <List {...props} />
    </Suspense>
  );
}
