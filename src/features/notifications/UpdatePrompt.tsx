import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui';
import { applyUpdate, registerServiceWorker } from '../../lib/pwa';

/**
 * Meldet einen neuen Stand der Anwendung (Aufgabe 8.2).
 *
 * Eine installierte App hält sich hartnäckig an das, was im Zwischenspeicher liegt. Ohne
 * diesen Hinweis liefe ein Mitglied unter Umständen wochenlang mit der Fassung vom Tag der
 * Installation — und meldete Fehler, die längst behoben sind.
 */
export default function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Nur im ausgelieferten Bauwerk gibt es einen Service Worker; in der Entwicklung
    // säße er vor jedem Neuladen.
    if (!import.meta.env.PROD) return;
    void registerServiceWorker(setWaiting);
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto mb-[76px] flex w-[min(100%-2rem,32rem)] items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg xl:mb-4"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-gray-700">
        Eine neue Fassung des Vereinsplaners ist bereit.
      </p>
      <Button size="sm" variant="primary" onClick={() => applyUpdate(waiting)}>
        Neu laden
      </Button>
    </div>
  );
}
