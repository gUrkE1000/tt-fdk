import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const RELOADED_KEY = 'route-error-reloaded';

/** Ein Teil der Anwendung ließ sich nicht laden — meist ein neuer Stand, halb im Cache. */
function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(
    message,
  );
}

/**
 * Statt der nackten Fehlerseite von React Router: eine Meldung im Stil der App mit
 * „Neu laden". Lädt ein Teil der Anwendung nicht (neuer Stand, alter Cache), lädt die
 * Seite einmal von selbst neu.
 */
export default function RouteError() {
  const error = useRouteError();

  useEffect(() => {
    if (!isChunkError(error)) return;
    try {
      if (sessionStorage.getItem(RELOADED_KEY)) return;
      sessionStorage.setItem(RELOADED_KEY, '1');
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : '';

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-status-late" aria-hidden="true" />
        <h1 className="text-lg font-bold text-gray-900">Da ist etwas schiefgelaufen</h1>
        <p className="text-sm text-gray-600">
          Diese Seite ließ sich gerade nicht anzeigen. Meist hilft es, neu zu laden.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(RELOADED_KEY);
              } catch {
                // egal
              }
              window.location.reload();
            }}
            className="inline-flex min-h-touch items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Neu laden
          </button>
          <a
            href="/"
            className="inline-flex min-h-touch items-center rounded-xl border border-gray-200 px-4 font-semibold text-gray-700"
          >
            Zur Übersicht
          </a>
        </div>
        {detail && <p className="break-words text-xs text-gray-400">{detail}</p>}
      </div>
    </div>
  );
}
