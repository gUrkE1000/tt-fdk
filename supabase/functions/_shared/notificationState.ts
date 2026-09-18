/**
 * Was mit einer Nachricht nach einem Versandversuch passiert — als reine Funktion.
 *
 * Die Zustandsübergänge sind der Teil, der wirklich stimmen muss: Eine Nachricht darf
 * nicht doppelt verschickt werden, nicht endlos wiederholt werden und nicht stillschweigend
 * verschwinden. Ohne Netz und ohne Datenbank lässt sich das vollständig durchtesten.
 */

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface NotificationRow {
  id: string;
  channel: 'email' | 'push';
  attempts: number;
  /** Empfängeradresse; fehlt sie, kann die E-Mail nicht raus. */
  recipient: string | null;
  /** Gelöschte Mitglieder bekommen nichts mehr. */
  recipientDeleted: boolean;
  /** Wie viele Geräte dieses Mitglied für Push angemeldet hat (Aufgabe 8.3). */
  pushEndpoints: number;
}

export type SendOutcome =
  | { kind: 'ok' }
  /** Der Dienst hat abgelehnt; ein erneuter Versuch kann klappen. */
  | { kind: 'error'; message: string }
  /** Dauerhaft falsch, zum Beispiel eine ungültige Adresse. */
  | { kind: 'permanent'; message: string };

export interface StateChange {
  status: NotificationStatus;
  attempts: number;
  error: string | null;
  sentAt: string | null;
  /** Gesetzt, wenn es einen weiteren Versuch geben soll. */
  scheduledFor: string | null;
}

export const MAX_ATTEMPTS = 3;
export const RETRY_MINUTES = 15;

/** Vor dem Versand: Gibt es überhaupt etwas zu tun? */
export function preflight(row: NotificationRow): StateChange | null {
  if (row.recipientDeleted) {
    return skip('Das Mitglied wurde gelöscht.');
  }

  if (row.channel === 'push') {
    // Wer die Glocke nie gedrückt hat, hat kein Gerät angemeldet. Die Zeile bleibt
    // dann nicht ewig „pending" liegen, sondern gilt als übersprungen — sonst wächst
    // das Postfach mit Zeilen, die nie jemand abarbeitet.
    return row.pushEndpoints > 0 ? null : skip('Kein Gerät für Push angemeldet.');
  }

  if (!row.recipient) {
    return skip('Das Mitglied hat keine E-Mail-Adresse.');
  }

  return null;
}

export function applyOutcome(
  row: NotificationRow,
  outcome: SendOutcome,
  now: Date = new Date(),
): StateChange {
  const attempts = row.attempts + 1;

  if (outcome.kind === 'ok') {
    return {
      status: 'sent',
      attempts,
      error: null,
      sentAt: now.toISOString(),
      scheduledFor: null,
    };
  }

  if (outcome.kind === 'permanent' || attempts >= MAX_ATTEMPTS) {
    return {
      status: 'failed',
      attempts,
      error: outcome.message,
      sentAt: null,
      scheduledFor: null,
    };
  }

  return {
    status: 'pending',
    attempts,
    error: outcome.message,
    sentAt: null,
    scheduledFor: new Date(now.getTime() + RETRY_MINUTES * 60_000).toISOString(),
  };
}

function skip(reason: string): StateChange {
  return { status: 'skipped', attempts: 0, error: reason, sentAt: null, scheduledFor: null };
}
