import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { RotateCw, WifiOff } from 'lucide-react';
import { formatTime } from '../../lib/dates';

/** Online-Status des Geräts, mit Wechsel in beide Richtungen. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

/**
 * Wie viele Abfragen, die gerade jemand auf dem Bildschirm hat, gescheitert sind.
 * Abfragen ohne Beobachter (eine Seite, die man verlassen hat) zählen nicht: Ihr
 * Fehler betrifft nichts, was man sieht.
 */
function failedActiveQueries(client: QueryClient): number {
  return client
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.status === 'error' && query.getObserversCount() > 0).length;
}

/** Wann die ältesten Daten auf dem Bildschirm zuletzt frisch vom Server kamen. */
function oldestActiveUpdate(client: QueryClient): number {
  const times = client
    .getQueryCache()
    .getAll()
    .filter((query) => query.getObserversCount() > 0 && query.state.dataUpdatedAt > 0)
    .map((query) => query.state.dataUpdatedAt);
  return times.length === 0 ? 0 : Math.min(...times);
}

/**
 * Der Hinweis oben auf jeder Seite, wenn etwas mit der Verbindung nicht stimmt.
 *
 * Zwei Fälle, die bisher unsichtbar waren: Das Gerät ist offline — dann zeigt die App,
 * was sie zuletzt geladen hat, und sagt, von wann. Oder der Server antwortet nicht —
 * dann steht hier ein Knopf, der es noch einmal versucht. In beiden Fällen sähen Listen
 * sonst aus, als wären sie leer oder aktuell.
 */
export default function ConnectionBanner() {
  const client = useQueryClient();
  const online = useOnline();

  const failed = useSyncExternalStore(
    (notify) => client.getQueryCache().subscribe(notify),
    () => failedActiveQueries(client),
  );
  const updatedAt = useSyncExternalStore(
    (notify) => client.getQueryCache().subscribe(notify),
    () => oldestActiveUpdate(client),
  );

  if (!online) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 bg-gray-800 px-4 py-2 text-sm text-white"
      >
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Offline — du siehst den zuletzt geladenen Stand
          {updatedAt > 0 ? ` von ${formatTime(new Date(updatedAt))} Uhr` : ''}. Antworten
          gehen erst wieder mit Verbindung.
        </span>
      </div>
    );
  }

  if (failed === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-status-no-soft px-4 py-2 text-sm text-status-no"
    >
      <span className="font-semibold">Einige Daten ließen sich nicht laden.</span>
      <button
        type="button"
        onClick={() =>
          void client.refetchQueries({ predicate: (query) => query.state.status === 'error' })
        }
        className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
      >
        <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
        Erneut versuchen
      </button>
    </div>
  );
}
