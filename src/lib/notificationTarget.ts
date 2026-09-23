/**
 * Wohin das Antippen einer Push-Nachricht führt — nur innerhalb der eigenen App.
 *
 * Die Adresse steht im Payload der Nachricht. Kommt dort je eine fremde Adresse an (ein
 * Fehler im Versand, ein manipulierter Eintrag), soll die Vereins-App trotzdem keine
 * fremde Seite öffnen: Eine echte Benachrichtigung, die auf eine Phishing-Seite führt,
 * wäre das glaubwürdigste Phishing, das es gibt.
 */
export function notificationTarget(raw: unknown, origin: string, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;

  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
