/**
 * Anmeldung des Service Workers (Aufgabe 8.2).
 *
 * Bewusst von Hand statt über `virtual:pwa-register`: Das virtuelle Modul gibt es nur,
 * wenn `vite-plugin-pwa` läuft — und das tut es nur beim Bauen. Ein Import, den es in der
 * Entwicklung und in den Tests nicht gibt, wäre ein Modul, das nur in der Produktion
 * auffällt.
 */

export const SW_URL = `${import.meta.env.BASE_URL}sw.js`;

export type UpdateHandler = (waiting: ServiceWorker) => void;

export function serviceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Meldet den Service Worker an und ruft `onUpdate`, sobald ein neuer Stand bereitliegt.
 *
 * Der neue Stand wird **nicht** von allein übernommen. Wer gerade eine Aufstellung
 * zusammenstellt, soll nicht mitten im Formular eine neu geladene Seite bekommen; die
 * Oberfläche fragt stattdessen nach.
 */
export async function registerServiceWorker(onUpdate: UpdateHandler): Promise<void> {
  if (!serviceWorkerSupported()) return;

  try {
    // Ohne `type: 'module'`: Die gebaute Datei enthält keine Importe mehr, und die
    // klassische Anmeldung versteht jeder Browser, der überhaupt Service Worker kann.
    const registration = await navigator.serviceWorker.register(SW_URL);

    if (registration.waiting) onUpdate(registration.waiting);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        // „installed" mit vorhandenem Controller heißt: Es lief schon eine Fassung, und
        // diese hier wartet darauf, sie abzulösen. Ohne Controller ist es der erste Start.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          onUpdate(installing);
        }
      });
    });
  } catch {
    // Ohne Service Worker läuft die Anwendung genauso, nur ohne Offline-Start. Das ist
    // kein Grund, dem Benutzer etwas zu melden.
  }
}

/** Den wartenden Stand übernehmen und die Seite neu laden. */
export function applyUpdate(waiting: ServiceWorker): void {
  if (!serviceWorkerSupported()) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Läuft die Anwendung als installierte App?
 *
 * Android und Desktop melden `display-mode: standalone`, iOS setzt stattdessen
 * `navigator.standalone` — die Abfrage muss beides kennen.
 */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

export type Platform = 'ios' | 'android' | 'desktop';

/** Grobe Einordnung, nur um die passende Anleitung zuerst zu zeigen. */
export function detectPlatform(userAgent: string): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  // iPadOS gibt sich seit Version 13 als Macintosh aus; Touch verrät es.
  if (/Macintosh/i.test(userAgent) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
    return 'ios';
  }
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}
