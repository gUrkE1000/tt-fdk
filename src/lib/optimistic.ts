import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export interface OptimisticUpdate<T> {
  queryKey: QueryKey;
  /** Nur genau dieser Schlüssel, nicht alles, was mit ihm beginnt. */
  exact?: boolean;
  update: (current: T) => T;
}

/**
 * Zeigt eine Antwort sofort, noch bevor der Server sie bestätigt hat.
 *
 * Vorher wartete ein Knopf auf die Datenbank und danach auf das Neuladen aller Spiele
 * und Rückmeldungen, bevor er grün wurde — im Mobilnetz eine spürbare Pause, in der man
 * nicht weiß, ob der Tipp angekommen ist. Jetzt ändert sich die Anzeige sofort; geht der
 * Aufruf schief, stellt die zurückgegebene Funktion den alten Stand wieder her.
 *
 * Laufende Abfragen werden vorher angehalten, sonst überschriebe eine Antwort, die noch
 * unterwegs war, den neuen Stand wieder mit dem alten.
 */
export async function applyOptimistic(
  client: QueryClient,
  updates: ErasedUpdate[],
): Promise<() => void> {
  const snapshots: [QueryKey, unknown][] = [];

  for (const { queryKey, exact } of updates) {
    await client.cancelQueries({ queryKey, exact });
    snapshots.push(...client.getQueriesData({ queryKey, exact }));
  }

  for (const { queryKey, exact, update } of updates) {
    client.setQueriesData({ queryKey, exact }, (current: unknown) =>
      current === undefined ? current : update(current),
    );
  }

  return () => {
    for (const [key, data] of snapshots) client.setQueryData(key, data);
  };
}

/** Eine Änderung, deren Zeilentyp nur der Aufrufer kennt. */
export type ErasedUpdate = OptimisticUpdate<unknown>;

/** Hilfsform, damit die Aufrufer ihre Zeilentypen behalten. */
export function optimisticUpdate<T>(update: OptimisticUpdate<T>): ErasedUpdate {
  return update as unknown as ErasedUpdate;
}

/**
 * Nimmt einen Eintrag aus „Offen für dich", sobald jemand geantwortet hat — die Zeile
 * verschwindet sofort, nicht erst nach dem Neuladen.
 */
export function dropOpenItem(kind: string, id: string): ErasedUpdate {
  return optimisticUpdate<{ kind: string; id: string }[]>({
    queryKey: queryKeys.open.all,
    update: (items) => items.filter((item) => !(item.kind === kind && item.id === id)),
  });
}
