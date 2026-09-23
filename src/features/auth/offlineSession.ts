import type { Session } from '@supabase/supabase-js';
import { SUPABASE_URL } from '../../lib/supabaseClient';

/**
 * Anmeldung ohne Netz.
 *
 * Das Zugangs-Token gilt eine Stunde. Wer die App danach in der Halle ohne Empfang
 * öffnet, kann es nicht erneuern — Supabase meldet dann „keine Sitzung", und die App
 * schickte bisher auf die Anmeldeseite, obwohl der letzte Stand auf dem Gerät liegt.
 *
 * Scheitert die Erneuerung **nur am Netz**, gilt die zuletzt bekannte Sitzung weiter:
 * Die App zeigt den gespeicherten Stand, schreiben kann sie ohnehin erst wieder online.
 * Sobald das Netz zurück ist, wird die Sitzung ordentlich erneuert. Lehnt der Server
 * die Anmeldung ab (abgemeldet, gesperrt), löscht Supabase die gespeicherte Sitzung —
 * dann gibt es hier auch nichts mehr zu lesen.
 */

/** Unter diesem Schlüssel legt supabase-js die Sitzung ab (Voreinstellung der Bibliothek). */
export function sessionStorageKey(url = SUPABASE_URL): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/** Die zuletzt gespeicherte Sitzung, auch wenn ihr Token abgelaufen ist. */
export function storedSession(storage: Storage | null = safeStorage()): Session | null {
  const raw = storage?.getItem(sessionStorageKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed?.user?.id || !parsed.refresh_token) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

/** Lag es am Netz — und nicht daran, dass der Server die Anmeldung abgelehnt hat? */
export function isNetworkFailure(error: unknown, online = navigatorOnline()): boolean {
  if (!online) return true;
  if (!error || typeof error !== 'object') return false;
  const { name, message, status } = error as { name?: string; message?: string; status?: number };
  return (
    name === 'AuthRetryableFetchError' ||
    status === 0 ||
    /failed to fetch|network|nicht geantwortet|timeout/i.test(message ?? '')
  );
}

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
