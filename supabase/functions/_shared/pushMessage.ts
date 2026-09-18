/**
 * Was auf dem Sperrbildschirm steht — als reine Funktion (Aufgabe 8.3).
 *
 * Eine Push-Nachricht hat wenig Platz und keine zweite Chance: Sie erscheint kurz, und
 * was nicht hineinpasst, sieht niemand. Die Regeln dafür (Betreff als Titel, die ersten
 * 120 Zeichen als Text, ein Ziel zum Antippen) stehen deshalb hier und nicht verstreut im
 * Versandlauf.
 */

/** Mehr zeigt kein Betriebssystem in der Vorschau an. */
export const PUSH_BODY_LIMIT = 120;

export interface PushSource {
  id: string;
  type: string;
  subject: string;
  body_text: string;
  payload: Record<string, unknown>;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Kennzeichen zum Zusammenfassen: Eine neue Erinnerung ersetzt die alte. */
  tag: string;
  data: {
    url: string;
    type: string;
    notificationId: string;
  };
}

/** Kürzt auf die Vorschaulänge und macht sichtbar, dass etwas fehlt. */
export function truncateForPush(text: string, limit = PUSH_BODY_LIMIT): string {
  // Zeilenumbrüche werden in der Vorschau ohnehin zu Leerzeichen; sie vorher zu ersetzen
  // verhindert, dass die 120 Zeichen von Leerraum aufgebraucht werden.
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit - 1).trimEnd()}…`;
}

export function buildPushMessage(row: PushSource, fallbackUrl = '/'): PushMessage {
  const link = typeof row.payload.link === 'string' ? row.payload.link : '';

  return {
    title: row.subject,
    body: truncateForPush(row.body_text),
    // Je Art ein Kennzeichen: Zwei Erinnerungen an dasselbe Spiel sollen sich ablösen,
    // eine Ersatzanfrage darf eine Trainingsfrage aber nicht verdrängen.
    tag: row.type,
    data: {
      url: link || fallbackUrl,
      type: row.type,
      notificationId: row.id,
    },
  };
}

/**
 * Ein Endpunkt, den der Push-Dienst nicht mehr kennt.
 *
 * 404 und 410 heißen: Das Gerät hat die Erlaubnis entzogen, die App wurde gelöscht oder
 * der Browser hat die Anmeldung erneuert. Weiterzuversuchen bringt nichts — die Zeile
 * gehört gelöscht, sonst sammeln sich tote Endpunkte an und jeder Lauf wartet auf sie.
 */
export function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410;
}

export interface EndpointOutcome {
  /** Endpunkt löschen? */
  gone: boolean;
  /** Hat dieses Gerät die Nachricht bekommen? */
  delivered: boolean;
  /** Lohnt ein neuer Versuch? */
  retry: boolean;
}

/** Wie der Versandlauf auf die Antwort eines Push-Dienstes reagiert. */
export function classifyPushStatus(status: number): EndpointOutcome {
  if (status >= 200 && status < 300) return { gone: false, delivered: true, retry: false };
  if (isGoneStatus(status)) return { gone: true, delivered: false, retry: false };
  // 429 (zu viele Anfragen) und 5xx sind vorübergehend, alles andere ist unser Fehler.
  if (status === 429 || status >= 500) return { gone: false, delivered: false, retry: true };
  return { gone: false, delivered: false, retry: false };
}

/**
 * Das Gesamtergebnis über alle Geräte eines Mitglieds.
 *
 * Erreicht **ein** Gerät die Nachricht, gilt sie als zugestellt — wer Handy und Tablet
 * angemeldet hat, soll keine Fehlermeldung bekommen, weil das Tablet seit Wochen aus ist.
 */
export function summarizePush(outcomes: EndpointOutcome[]): {
  delivered: boolean;
  retry: boolean;
} {
  if (outcomes.some((outcome) => outcome.delivered)) return { delivered: true, retry: false };
  return { delivered: false, retry: outcomes.some((outcome) => outcome.retry) };
}
