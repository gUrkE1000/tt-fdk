import { supabase } from '../../lib/supabaseClient';
import { serviceWorkerSupported } from '../../lib/pwa';

/**
 * Web Push im Browser (Aufgabe 8.3).
 *
 * Drei Dinge müssen zusammenkommen, damit eine Meldung auf dem Sperrbildschirm landet:
 * die Erlaubnis des Benutzers, eine Anmeldung beim Push-Dienst des Browsers und ein
 * Eintrag in `push_subscriptions`, damit der Versandlauf das Gerät kennt. Fehlt eins
 * davon, passiert nichts — und niemand erfährt, warum. Diese Datei hält die drei
 * Schritte deshalb an einer Stelle zusammen.
 */

export type PushState =
  /** Der Browser kann kein Push (oder die Seite läuft ohne HTTPS). */
  | 'unsupported'
  /** Noch nicht gefragt oder noch nicht angemeldet — der blaue Knopf. */
  | 'available'
  /** Läuft — der grüne Knopf. */
  | 'enabled'
  /** Der Benutzer hat abgelehnt — der rote Knopf. */
  | 'denied';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

export function pushSupported(): boolean {
  return (
    serviceWorkerSupported() &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Der Zustand, den die Glocke anzeigt.
 *
 * `granted` allein genügt nicht: Die Erlaubnis überlebt eine gelöschte Anmeldung. Wer sie
 * einmal erteilt hat und dann die Website-Daten löscht, hätte sonst einen grünen Knopf
 * und keine einzige Meldung.
 */
export async function readPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'unsupported';

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'available';

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'enabled' : 'available';
  } catch {
    return 'available';
  }
}

/**
 * Erlaubnis holen, beim Push-Dienst anmelden, Endpunkt hinterlegen.
 *
 * Gibt den erreichten Zustand zurück, damit die Glocke nicht raten muss.
 */
export async function enablePush(profileId: string): Promise<PushState> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'available';

  const registration = await navigator.serviceWorker.ready;

  // Eine vorhandene Anmeldung weiterverwenden: Ein zweites `subscribe` mit demselben
  // Schlüssel liefert ohnehin denselben Endpunkt, ein Fehlschlag wäre aber unnötig.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  await storeSubscription(profileId, subscription);
  return 'enabled';
}

/** Abmelden: beim Push-Dienst und in der Datenbank. */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return 'available';

    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  } catch {
    // Bleibt die Abmeldung stecken, räumt der Versandlauf den toten Endpunkt später auf.
  }

  return 'available';
}

/**
 * Den Endpunkt hinterlegen.
 *
 * `onConflict: endpoint`, weil derselbe Browser nach einem Wechsel des Kontos denselben
 * Endpunkt meldet: Die Zeile soll dann dem neuen Mitglied gehören, nicht doppelt
 * existieren.
 */
export async function storeSubscription(
  profileId: string,
  subscription: PushSubscription,
): Promise<void> {
  const json = subscription.toJSON();
  const keys = json.keys ?? {};

  if (!keys.p256dh || !keys.auth) {
    throw new Error('Die Anmeldung beim Push-Dienst ist unvollständig.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profileId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent.slice(0, 255),
      failures: 0,
    },
    { onConflict: 'endpoint' },
  );

  if (error) throw error;
}

/**
 * Der VAPID-Schlüssel steht als URL-sicheres Base64 in der Umgebung; `subscribe` will
 * die rohen Bytes. Eine Umrechnung, die jede Push-Anleitung im Netz enthält — und die
 * genau einmal falsch sein muss, damit nie eine Meldung ankommt.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);

  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
