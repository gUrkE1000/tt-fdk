import { z } from 'zod';
import { parseRanking } from '../../lib/labels';

export const memberSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte Vornamen eingeben'),
  lastName: z.string().trim().min(1, 'Bitte Nachnamen eingeben'),
  // Ohne E-Mail geht es: nicht jedes Mitglied hat eine, und ein Kind schon gar nicht.
  email: z
    .string()
    .trim()
    .email('Das sieht nicht nach einer E-Mail-Adresse aus')
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  mobilePhone: z.string().trim().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'unspecified']),
  birthday: z.string().optional().or(z.literal('')),
  memberNumber: z.string().trim().optional().or(z.literal('')),
  role: z.enum(['admin', 'team_leader', 'trainer', 'organizer', 'member', 'guest']),
  status: z.enum(['active', 'pending_approval', 'unconfirmed']),
  noGames: z.boolean(),
  qttr: z
    .number({ error: 'Bitte eine Zahl eingeben' })
    .int('Bitte eine ganze Zahl')
    .min(0, 'Nicht negativ')
    .max(3000, 'So hoch wird kein QTTR-Wert')
    .nullable(),
  contactVisible: z.boolean(),
  hideBirthday: z.boolean(),
  groupIds: z.array(z.string()),
  /** Ränge als Textfelder „1.2" je Altersklasse; die Prüfung macht `rankingsSchema`. */
  rankings: z.record(z.string(), z.string()),
});
export type MemberValues = z.infer<typeof memberSchema>;

/**
 * „1.2" je Altersklasse prüfen. Leere Felder bedeuten „kein Rang" und sind erlaubt;
 * alles andere muss dem Muster Mannschaft.Position entsprechen.
 */
export function validateRankings(rankings: Record<string, string>): string | null {
  for (const [type, value] of Object.entries(rankings)) {
    if (!value.trim()) continue;
    if (!parseRanking(value)) {
      return `„${value}" ist kein Rang. Erwartet wird Mannschaft.Position, zum Beispiel 1.2.`;
    }
    void type;
  }
  return null;
}

export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Bitte einen Namen eingeben'),
});
export type GroupValues = z.infer<typeof groupSchema>;

export interface QttrLine {
  name: string;
  qttr: number;
}

/**
 * Die QTTR-Liste kommt als eingefügter Text: je Zeile ein Name und ein Wert, getrennt
 * durch Tabulator, Semikolon, Komma oder schlicht Leerzeichen. Der Wert steht immer
 * hinten — das ist die einzige Annahme, die alle Quellen erfüllen.
 */
export function parseQttrLines(input: string): { lines: QttrLine[]; invalid: string[] } {
  const lines: QttrLine[] = [];
  const invalid: string[] = [];

  for (const raw of input.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const match = /^(.*?)[\s;,\t]+(\d{2,4})$/.exec(line);
    if (!match || !match[1].trim()) {
      invalid.push(line);
      continue;
    }

    lines.push({ name: match[1].trim().replace(/[;,]$/, ''), qttr: Number(match[2]) });
  }

  return { lines, invalid };
}

/** Ordnet die eingefügten Zeilen Mitgliedern zu. Groß-/Kleinschreibung egal. */
export function matchQttrLines(
  lines: QttrLine[],
  members: { id: string; full_name: string | null }[],
): { matched: { id: string; qttr: number; name: string }[]; unmatched: QttrLine[] } {
  const byName = new Map<string, string>();
  for (const member of members) {
    if (member.full_name) byName.set(normalizeName(member.full_name), member.id);
  }

  const matched: { id: string; qttr: number; name: string }[] = [];
  const unmatched: QttrLine[] = [];

  for (const line of lines) {
    const id = byName.get(normalizeName(line.name));
    if (id) matched.push({ id, qttr: line.qttr, name: line.name });
    else unmatched.push(line);
  }

  return { matched, unmatched };
}

/** „Mustermann, Max" und „Max Mustermann" sollen dieselbe Person treffen. */
function normalizeName(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim().toLowerCase();
  const comma = cleaned.indexOf(',');
  const ordered =
    comma >= 0 ? `${cleaned.slice(comma + 1).trim()} ${cleaned.slice(0, comma).trim()}` : cleaned;
  return ordered.replace(/\s+/g, ' ').trim();
}
