/**
 * „Zuletzt gesucht" — nur auf diesem Gerät, je Benutzer.
 *
 * Der Schlüssel beginnt bewusst mit `vp-cache:`: `clearPersistedCaches()` räumt beim
 * Abmelden alles mit diesem Präfix weg. Auf einem geteilten Gerät sieht der Nächste nicht,
 * wonach der Vorgänger gesucht hat. Auf dem Server wird nichts gespeichert
 * (docs/suche.md, 4.4).
 */

const PREFIX = 'vp-cache:search-recent:';
const MAX = 6;

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadRecent(userId: string | null): string[] {
  if (!userId) return [];
  try {
    const raw = store()?.getItem(PREFIX + userId);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberSearch(userId: string | null, query: string): string[] {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  if (!userId || trimmed.length < 2) return loadRecent(userId);
  const next = [
    trimmed,
    ...loadRecent(userId).filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX);
  try {
    store()?.setItem(PREFIX + userId, JSON.stringify(next));
  } catch {
    // Speicher voll oder gesperrt — dann eben ohne Verlauf.
  }
  return next;
}

export function clearRecent(userId: string | null): void {
  if (!userId) return;
  try {
    store()?.removeItem(PREFIX + userId);
  } catch {
    // nichts zu tun
  }
}
