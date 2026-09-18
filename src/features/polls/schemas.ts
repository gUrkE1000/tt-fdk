import { z } from 'zod';
import type { Enums } from '../../lib/database.types';

export const POLL_TYPE_LABELS: Record<Enums<'poll_type'>, string> = {
  vote: 'Umfrage / Abstimmung',
  persons: 'Personen',
};

/** Wörtlich aus der Bestandsaufnahme (Abschnitt H). */
export const POLL_TYPE_HELP: Record<Enums<'poll_type'>, string> = {
  vote: 'Umfrage mit einer oder mehreren Antwortmöglichkeiten',
  persons:
    'Umfrage, bei der sich Personen hinterlegen können (z. B. Wer kann bei Aktion X helfen?)',
};

export const TARGET_HINT =
  'Ohne Auswahl geht die Umfrage an den gesamten Verein. Du kannst mehrere Mannschaften ' +
  'und Gruppen kombinieren.';

export const pollSchema = z
  .object({
    title: z.string().trim().min(1, 'Die Umfrage braucht einen Namen'),
    detailsHtml: z.string(),
    type: z.enum(['vote', 'persons']),
    maxAnswers: z
      .number({ error: 'Bitte eine Zahl eingeben' })
      .int('Bitte eine ganze Zahl')
      .min(1, 'Mindestens eine Antwortmöglichkeit')
      .max(50, 'So viele Antworten liest niemand'),
    /** Leer = läuft nie ab. */
    expiresAt: z.string(),
    hideResults: z.boolean(),
    teamIds: z.array(z.string()),
    groupIds: z.array(z.string()),
    options: z.array(z.string()),
  })
  .refine((values) => values.options.filter((option) => option.trim() !== '').length > 0, {
    path: ['options'],
    message: 'Bitte mindestens eine Antwort angeben',
  })
  .refine(
    (values) =>
      values.maxAnswers <= values.options.filter((option) => option.trim() !== '').length,
    {
      path: ['maxAnswers'],
      message: 'Mehr Kreuze als Antworten ergibt keinen Sinn',
    },
  );

export type PollValues = z.infer<typeof pollSchema>;

export const EMPTY_POLL: PollValues = {
  title: '',
  detailsHtml: '',
  type: 'vote',
  maxAnswers: 1,
  expiresAt: '',
  hideResults: false,
  teamIds: [],
  groupIds: [],
  options: [''],
};

/** Abgelaufen ist eine Umfrage, deren Ablaufdatum zurückliegt. */
export function isExpired(
  poll: { expires_at: string | null },
  now: Date = new Date(),
): boolean {
  return poll.expires_at !== null && new Date(poll.expires_at).getTime() < now.getTime();
}

export interface ResultRow {
  option_id: string | null;
  text: string | null;
  position: number | null;
  votes: number | null;
}

/**
 * Die Balkenlängen einer Umfrage.
 *
 * Der Anteil bezieht sich auf die **meistgewählte** Antwort, nicht auf die Summe: Bei
 * Mehrfachauswahl übersteigt die Summe die Zahl der Abstimmenden, und ein Balken mit
 * „130 %" wäre Unsinn.
 */
export function resultBars(rows: readonly ResultRow[]): {
  optionId: string;
  text: string;
  votes: number;
  percent: number;
}[] {
  const sorted = [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const highest = Math.max(1, ...sorted.map((row) => row.votes ?? 0));

  return sorted.map((row) => ({
    optionId: row.option_id ?? '',
    text: row.text ?? '',
    votes: row.votes ?? 0,
    percent: Math.round(((row.votes ?? 0) / highest) * 100),
  }));
}
