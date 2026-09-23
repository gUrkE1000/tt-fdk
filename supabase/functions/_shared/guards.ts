/**
 * Kleine Schutzregeln für die Edge Functions — als reine Funktionen, damit sie ohne
 * Deno, Netz und Datenbank testbar sind (tests/shared/guards.test.ts).
 */

/** „Heute" in deutscher Zeit als ISO-Datum. `toISOString()` wäre UTC — bis 2 Uhr noch gestern. */
export function berlinToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}

/** Vergleich in konstanter Zeit: Die Dauer verrät nicht, wie viele Zeichen stimmen. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

const EMAIL = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/;

/** Höchstens so viele Kopie-Empfänger je Nachricht (wie der CHECK auf profiles). */
export const MAX_CC = 3;

/**
 * Kopie-Adressen aus dem Payload: nur gültige, ohne Dubletten, höchstens `MAX_CC`.
 * Die Datenbank begrenzt `emails_copies` bereits; das hier ist die zweite Linie, falls
 * ein Payload einmal anders zustande kommt.
 */
export function sanitizeCc(value: unknown, recipient?: string | null): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>(recipient ? [recipient.toLowerCase()] : []);
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const address = entry.trim();
    if (!EMAIL.test(address) || seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());
    result.push(address);
    if (result.length >= MAX_CC) break;
  }
  return result.length > 0 ? result : undefined;
}

/**
 * Darf der Kalenderabgleich diese Adresse abrufen?
 *
 * Die Adresse pflegt nur der Admin — trotzdem soll die Function nicht zum Werkzeug
 * werden, mit dem man aus der Supabase-Infrastruktur heraus interne Dienste anspricht.
 * Erlaubt ist https (webcal wird vorher umgeschrieben) auf einen Hostnamen, keine
 * IP-Adresse und nichts Lokales.
 */
export function isSafeFeedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (!host.includes('.')) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.local') || host.endsWith('.internal')) return false;
  // IPv4-Literal oder IPv6 in Klammern
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) return false;
  return true;
}

/**
 * Wer steht als Kontakt in der VAPID-Anmeldung? Push-Dienste (vor allem Apple) lehnen
 * Platzhalter wie admin@example.org ab. Ohne echte Angabe gibt es kein Subjekt — der
 * Versand überspringt Push dann, statt abgewiesen zu werden.
 */
export function vapidSubject(senderEmail: string, appUrl: string): string | null {
  if (EMAIL.test(senderEmail)) return `mailto:${senderEmail}`;
  if (/^https:\/\//i.test(appUrl)) return appUrl;
  return null;
}

/**
 * Alle Seiten einer Abfrage holen.
 *
 * PostgREST liefert in Supabase höchstens 1000 Zeilen je Anfrage (*Max rows*) — ohne
 * Fehlermeldung. Wer mehr erwartet, muss blättern. `page(from, to)` ist die Abfrage
 * mit `.range(from, to)`; sie braucht eine feste Sortierung, sonst kann das Blättern
 * Zeilen doppelt liefern oder auslassen.
 *
 * Weitergeblättert wird um die tatsächlich gelieferte Zahl, bis eine Seite leer ist.
 * Das kostet eine Anfrage mehr, stimmt aber auch dann, wenn das Projekt ein kleineres
 * Max rows eingestellt hat als `pageSize` — an der Länge einer Seite allein ließe sich
 * das Ende nicht sicher erkennen.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    if (chunk.length === 0) return rows;
    rows.push(...chunk);
    from += chunk.length;
  }
}
