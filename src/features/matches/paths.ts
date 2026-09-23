/**
 * Adresse der Seite eines einzelnen Spiels — eine Stelle für alle Links darauf
 * (Kalender, „Offen für dich", Übersicht). Eigene Datei, damit ein Link nicht die ganze
 * Seite ins Paket zieht.
 */
export function matchPath(matchId: string): string {
  return `/match/${matchId}`;
}
