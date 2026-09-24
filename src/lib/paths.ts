/**
 * Adressen der Seiten einzelner Termine — eine Stelle für alle Links darauf (Kalender,
 * „Offen für dich", Übersicht). Eigene Datei ohne Abhängigkeiten, damit ein Link nicht
 * die ganze Seite ins Paket zieht.
 */
export function matchPath(matchId: string): string {
  return `/match/${matchId}`;
}

export function trainingPath(sessionId: string): string {
  return `/training/${sessionId}`;
}

export function eventPath(eventId: string): string {
  return `/event/${eventId}`;
}
