import { z } from 'zod';
import { parseQuicklinks, type Quicklink } from '../dashboard/summary';

/**
 * Die Betriebseinstellungen (Aufgabe 8.4).
 *
 * Getrennt von `clubDataSchema`, weil es zwei verschiedene Fragen sind: Dort steht, wer
 * der Verein ist; hier steht, wie die Anwendung sich verhält. Beides in einem Formular
 * hieße, dass ein Tippfehler in der Erinnerungszeit das Speichern des Vereinsnamens
 * verhindert.
 */

const wholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      const parsed = Number(value);
      return /^\d+$/.test(value) && parsed >= min && parsed <= max;
    }, { message });

export const operationsSchema = z.object({
  /** Vorlauf des täglichen Sammelhinweises auf offene Rückmeldungen. */
  open_reminder_days: wholeNumber(1, 90, 'Bitte eine Zahl zwischen 1 und 90 Tagen'),
  open_reminder_time: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Bitte eine Uhrzeit im Format 18:00'),
  event_reminder_hours: wholeNumber(1, 336, 'Bitte eine Zahl zwischen 1 und 336 Stunden'),

  notification_sender_name: z.string().trim(),
  notification_sender_email: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), {
      message: 'Bitte eine gültige E-Mail-Adresse',
    }),

  /**
   * Wohin Antworten gehen.
   *
   * Getrennt von der Absenderadresse, weil die zwei verschiedene Aufgaben haben: Die
   * Absenderadresse muss auf der beim Versanddienst verifizierten Domain liegen und
   * braucht kein Postfach. Die Antwortadresse braucht genau umgekehrt ein echtes
   * Postfach und darf irgendwo liegen.
   *
   * Ohne sie fällt jede Antwort auf eine Benachrichtigung lautlos aus der Welt.
   */
  notification_reply_to: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), {
      message: 'Bitte eine gültige E-Mail-Adresse',
    }),

  /**
   * Basis für alle Links in Benachrichtigungen. Ohne sie zeigt jeder Antwortlink ins
   * Leere — deshalb ist die Adresse hier sichtbar und nicht in einer Umgebungsvariablen.
   */
  app_url: z
    .string()
    .trim()
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), {
      message: 'Bitte eine vollständige Adresse mit https://',
    }),

  /**
   * Datenschutzhinweis und Impressum (Aufgabe 10.1).
   *
   * Ohne die erste Adresse erfährt niemand, was mit seinen Daten passiert — und die
   * Registrierungsseite verschweigt es, weil sie nichts zu verlinken hat.
   */
  privacy_url: z
    .string()
    .trim()
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), {
      message: 'Bitte eine vollständige Adresse mit https://',
    }),
  imprint_url: z
    .string()
    .trim()
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), {
      message: 'Bitte eine vollständige Adresse mit https://',
    }),

  quicklinks_json: z.string().refine(
    (value) => {
      if (value.trim() === '') return true;
      try {
        return Array.isArray(JSON.parse(value));
      } catch {
        return false;
      }
    },
    { message: 'Das ist kein gültiges JSON-Array' },
  ),
});

export type OperationsValues = z.infer<typeof operationsSchema>;

export const OPERATIONS_KEYS = Object.keys(operationsSchema.shape) as (keyof OperationsValues)[];

const DEFAULTS: Partial<Record<keyof OperationsValues, string>> = {
  open_reminder_days: '14',
  open_reminder_time: '18:00',
  event_reminder_hours: '24',
  quicklinks_json: '[]',
};

export function toOperationsValues(settings: Record<string, string>): OperationsValues {
  const values = {} as Record<string, string>;
  for (const key of OPERATIONS_KEYS) values[key] = settings[key] || DEFAULTS[key] || '';
  return values as unknown as OperationsValues;
}

/**
 * Was von den eingegebenen Quicklinks übrig bleibt.
 *
 * Für die Vorschau unter dem Feld: Sie zeigt genau das, was auf der Übersicht landen
 * wird — inklusive der Einträge, die stillschweigend wegfallen, weil ihre Adresse kein
 * `http`/`https` ist. Ohne diese Rückmeldung bliebe unerklärlich, warum ein eingetragener
 * Link nicht erscheint.
 */
export function previewQuicklinks(raw: string): { accepted: Quicklink[]; dropped: number } {
  const accepted = parseQuicklinks(raw);

  let total = 0;
  try {
    const parsed: unknown = JSON.parse(raw.trim() === '' ? '[]' : raw);
    if (Array.isArray(parsed)) total = parsed.length;
  } catch {
    total = 0;
  }

  return { accepted, dropped: Math.max(0, total - accepted.length) };
}
