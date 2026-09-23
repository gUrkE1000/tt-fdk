import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from '@tanstack/react-query';

/**
 * Die zuletzt geladenen Daten auf dem Gerät behalten.
 *
 * In der Halle ohne Empfang zeigte die App bisher leere Listen — genau dort, wo man die
 * Aufstellung, die Adresse oder die eigene Zusage nachsehen will. Jetzt liegt der
 * letzte Stand im Browser-Speicher und ist beim nächsten Öffnen sofort da, auch
 * offline. Online wird er wie gewohnt im Hintergrund aufgefrischt; der Hinweisbalken
 * sagt, von wann er ist.
 *
 * Getrennt je Benutzer und beim Abmelden gelöscht: Auf einem geteilten Gerät soll der
 * Nächste nichts vom Vorgänger sehen.
 */

const PREFIX = 'vp-cache:';
const VERSION = 1;
/** Älter als eine Woche hilft der Stand niemandem mehr — dann lieber leer als falsch. */
const MAX_AGE_MS = 7 * 86_400_000;
/** Browser erlauben meist 5 MB je Seite; darüber wird nicht gespeichert. */
const MAX_BYTES = 3_000_000;
const SAVE_DELAY_MS = 2_000;

/**
 * Was nicht aufs Gerät gehört: die Verwaltungssicht (Protokolle, die Mitgliederliste des
 * Admins mit allen Kontaktdaten) und Mitteilungen (enthalten Antwort-Links). Die normale
 * Namensliste bleibt drin — ohne sie stünden offline an den Karten keine Namen.
 */
export function persistable(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  const [head, sub] = query.queryKey;
  if (head === 'admin' || head === 'notifications') return false;
  if (head === 'members' && sub === 'admin-list') return false;
  return query.state.status === 'success';
}

function storageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

interface Stored {
  v: number;
  savedAt: number;
  state: DehydratedState;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Privater Modus in manchen Browsern: kein Speicher, kein Problem.
    return null;
  }
}

/** Den gespeicherten Stand in den Zwischenspeicher laden. Neueres bleibt, wie es ist. */
export function restoreCache(client: QueryClient, userId: string, now = Date.now()): boolean {
  const store = storage();
  const raw = store?.getItem(storageKey(userId));
  if (!raw) return false;

  try {
    const stored = JSON.parse(raw) as Stored;
    if (stored.v !== VERSION || now - stored.savedAt > MAX_AGE_MS) {
      store?.removeItem(storageKey(userId));
      return false;
    }
    hydrate(client, stored.state);
    return true;
  } catch {
    store?.removeItem(storageKey(userId));
    return false;
  }
}

/** Den aktuellen Stand speichern. Gibt zurück, ob es geklappt hat. */
export function saveCache(client: QueryClient, userId: string, now = Date.now()): boolean {
  const store = storage();
  if (!store) return false;

  const state = dehydrate(client, { shouldDehydrateQuery: persistable });
  const serialized = JSON.stringify({ v: VERSION, savedAt: now, state } satisfies Stored);
  if (serialized.length > MAX_BYTES) return false;

  try {
    store.setItem(storageKey(userId), serialized);
    return true;
  } catch {
    // Speicher voll — dann eben ohne.
    return false;
  }
}

/** Speichert nach jeder Änderung, gebündelt. Gibt die Abmeldefunktion zurück. */
export function startPersisting(client: QueryClient, userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      saveCache(client, userId);
    }, SAVE_DELAY_MS);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

/** Alle gespeicherten Stände entfernen — beim Abmelden. */
export function clearPersistedCaches(): void {
  const store = storage();
  if (!store) return;
  for (let index = store.length - 1; index >= 0; index -= 1) {
    const key = store.key(index);
    if (key?.startsWith(PREFIX)) store.removeItem(key);
  }
}
