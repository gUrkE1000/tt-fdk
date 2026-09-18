/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

/**
 * Der Service Worker des Vereinsplaners (Aufgabe 8.2).
 *
 * Er speichert die Anwendung selbst zwischen — HTML, Skripte, Stile, Symbole — damit sie
 * in der Halle auch bei schlechtem Empfang startet. **Vereinsdaten speichert er nicht.**
 *
 * Das ist eine bewusste Entscheidung: Wer in der Umkleide auf „Zusage" tippt, muss wissen,
 * ob es angekommen ist. Eine zwischengespeicherte Teilnehmerliste von gestern wäre
 * schlimmer als eine Fehlermeldung — sie sieht aus wie die Wahrheit. Alles, was an
 * Supabase geht, läuft deshalb ohne Zwischenspeicher direkt ins Netz; ohne Verbindung
 * meldet die Oberfläche einen Fehler, statt Altes zu zeigen.
 */

// Von vite-plugin-pwa zur Bauzeit eingesetzt: die Liste der App-Dateien mit ihren Hashes.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * Supabase: immer direkt ins Netz.
 *
 * Fremde Ursprünge holt der Service Worker ohnehin nur, wenn eine Route greift — die
 * Regel steht trotzdem hier, damit sie nicht aus Versehen verschwindet, sobald jemand
 * später eine großzügigere Route ergänzt.
 */
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/functions/'),
  new NetworkOnly(),
);

// Eine Single-Page-Anwendung hat genau ein HTML-Dokument. Jede Route (/trainings,
// /my-dates …) bekommt deshalb dieselbe index.html aus dem Zwischenspeicher.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/functions\//],
  }),
);

/**
 * Ein neuer Stand soll nicht bis zum übernächsten Start warten.
 *
 * `skipWaiting` auf ein Signal aus der Anwendung, nicht beim Installieren: sonst würde
 * mitten in einem ausgefüllten Formular die Seite unter dem Benutzer ausgetauscht.
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', () => {
  void self.clients.claim();
});

// ---------------------------------------------------------------------------- Push

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  data?: { url?: string };
}

/**
 * Eine Push-Nachricht anzeigen (Aufgabe 8.3).
 *
 * `waitUntil` ist Pflicht, nicht Geschmackssache: Ohne das Versprechen beendet der
 * Browser den Service Worker, bevor die Meldung steht — und manche zeigen dann
 * stattdessen „Diese Website wurde im Hintergrund aktualisiert".
 */
self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {};
  try {
    payload = (event.data?.json() as PushPayload) ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Vereinsplaner', {
      body: payload.body ?? '',
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data ?? {},
    }),
  );
});

/**
 * Antippen führt dorthin, worum es geht.
 *
 * Ist die App schon offen, wird das vorhandene Fenster benutzt und nur der Pfad
 * gewechselt — sonst hätte man nach drei Erinnerungen drei Fenster.
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const target = (event.notification.data as { url?: string } | null)?.url || '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of clients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
