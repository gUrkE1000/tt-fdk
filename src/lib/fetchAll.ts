/**
 * Alle Zeilen einer Abfrage holen, auch wenn es mehr als 1000 sind.
 *
 * PostgREST liefert in Supabase höchstens *Max rows* Zeilen je Anfrage (Voreinstellung
 * 1000) — ohne Fehlermeldung. Eine Statistik über ein Jahr, alle Rückmeldungen einer
 * Saison oder der Kalender stoßen daran, und dann fehlt still ein Teil: bei einer
 * Sortierung nach Datum ausgerechnet der neueste.
 *
 * `page(from, to)` baut die Abfrage mit `.range(from, to)` und `{ count: 'exact' }`. Die
 * Gesamtzahl sagt, wann Schluss ist — auch wenn das Projekt weniger Zeilen je Seite
 * liefert als angefragt. Die Abfrage braucht eine eindeutige Sortierung, sonst kann das
 * Blättern Zeilen doppelt liefern oder auslassen.
 */

interface Page<T> {
  data: T[] | null;
  error: unknown;
  count?: number | null;
}

export const PAGE_SIZE = 1000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];

  for (;;) {
    const from = rows.length;
    const { data, error, count } = await page(from, from + pageSize - 1);
    if (error) throw error;

    const chunk = data ?? [];
    rows.push(...chunk);

    if (chunk.length === 0) return rows;
    if (typeof count === 'number') {
      if (rows.length >= count) return rows;
    } else if (chunk.length < pageSize) {
      // Ohne Gesamtzahl ist eine unvollständige Seite das Ende.
      return rows;
    }
  }
}
