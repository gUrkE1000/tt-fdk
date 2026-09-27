import { z } from 'zod';

/**
 * Die beiden Modi der Aufstellung. Wer überhaupt gefragt wird, entscheidet der
 * Mannschaftsführer je Spiel; eine automatische Ersatzkette gibt es nicht (Migration
 * match_requests).
 */
export const LINEUP_MODE_HELP = {
  fixed:
    'Feste Stammspieler: Wer zusagt, wird automatisch aufgestellt — erst die Stammspieler ' +
    'nach ihrem Rang, dann die Ersatzspieler in ihrer Reihenfolge. Der Mannschaftsführer ' +
    'kann die Reihenfolge jederzeit von Hand ändern.',
  open:
    'Offene Spieler: Die Angefragten sagen zu oder ab, die Aufstellung legt der ' +
    'Mannschaftsführer selbst fest — auch bei einer Überbesetzung.',
} as const;

export const LINEUP_MODE_LABELS = {
  fixed: 'Feste Stammspieler',
  open: 'Offene Spieler',
} as const;

export const teamSchema = z
  .object({
    name: z.string().trim().min(1, 'Die Mannschaft braucht einen Namen'),
    color: z.string().trim(),
    size: z
      .number({ error: 'Bitte die Anzahl der Spieler eingeben' })
      .int('Bitte eine ganze Zahl')
      .min(1, 'Mindestens ein Spieler')
      .max(12, 'Mehr als zwölf Spieler hat keine Mannschaft'),
    rankingType: z.enum([
      'men',
      'women',
      'seniors_40',
      'seniors_50',
      'seniors_60',
      'seniors_70',
      'seniors_75',
      'youth_19',
      'youth_15',
      'youth_13',
      'youth_11',
      'girls_19',
      'girls_15',
      'girls_13',
      'girls_11',
    ]),
    ranking: z.number().int().min(1).max(99).nullable(),
    // Freitext statt Katalog: der TT-Planer pflegt 1.657 Ligen, deren Namen je Verband
    // anders aussehen. Ein eigener Katalog wäre am ersten Tag veraltet.
    leagues: z.array(z.string().trim().min(1)),
    lineupMode: z.enum(['fixed', 'open']),
    substituteMode: z.enum(['sequential', 'parallel', 'manual']),
    substituteTimeoutHours: z
      .number({ error: 'Bitte eine Zahl eingeben' })
      .int('Bitte eine ganze Zahl')
      .min(1, 'Mindestens eine Stunde')
      .max(336, 'Höchstens 336 Stunden (zwei Wochen)'),
    hideUsersNoRanking: z.boolean(),
    blockParticipantsAfter: z.string().optional().or(z.literal('')),
    commentHomeGames: z.string(),
    commentAwayGames: z.string(),
    arrivalMinutesHome: z.number().int().min(0).max(600),
    arrivalMinutesAway: z.number().int().min(0).max(600),
    manualRequestAutoAdd: z.boolean(),
    hideDriversCatering: z.boolean(),
    isBraunschweiger: z.boolean(),
    webcalUrl: z.string().trim(),
    syncEnabled: z.boolean(),
    active: z.boolean(),
    leaderIds: z.array(z.string()),
    regularIds: z.array(z.string()),
    substituteIds: z.array(z.string()),
  })
  .refine((values) => values.regularIds.length <= values.size, {
    message: 'Es sind mehr Stammspieler ausgewählt, als die Mannschaft Plätze hat',
    path: ['regularIds'],
  })
  .refine(
    (values) => values.substituteIds.every((id) => !values.regularIds.includes(id)),
    {
      message: 'Jemand steht gleichzeitig als Stamm- und als Ersatzspieler in der Liste',
      path: ['substituteIds'],
    },
  );
export type TeamValues = z.infer<typeof teamSchema>;

export const EMPTY_TEAM: TeamValues = {
  name: '',
  color: '#1D4ED8',
  size: 4,
  rankingType: 'men',
  ranking: null,
  leagues: [],
  lineupMode: 'fixed',
  substituteMode: 'manual',
  substituteTimeoutHours: 24,
  hideUsersNoRanking: false,
  blockParticipantsAfter: '',
  commentHomeGames: '',
  commentAwayGames: '',
  arrivalMinutesHome: 60,
  arrivalMinutesAway: 30,
  manualRequestAutoAdd: true,
  hideDriversCatering: false,
  isBraunschweiger: false,
  webcalUrl: '',
  syncEnabled: true,
  active: true,
  leaderIds: [],
  regularIds: [],
  substituteIds: [],
};

/** „4er Mannschaft · Rang: 2 | Erwachsene" — der Untertitel aus der Mannschaftsliste. */
export function teamSubtitle(team: {
  size: number;
  ranking: number | null;
  rankingTypeLabel: string;
}): string {
  const parts = [`${team.size}er Mannschaft`];
  const ranking = team.ranking != null ? `Rang: ${team.ranking} | ` : '';
  parts.push(`${ranking}${team.rankingTypeLabel}`);
  return parts.join(' · ');
}

/** Kommagetrennte Eingabe in eine Liga-Liste; leere Einträge fallen weg. */
export function parseLeagues(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export interface LeaderMismatches {
  /** Rolle „Mannschaftsführer", aber an keiner Mannschaft eingetragen: sieht unter „Spieltermine" nichts. */
  withoutTeam: string[];
  /** An einer Mannschaft eingetragen, aber ohne passende Rolle: kommt nicht auf „Spieltermine". */
  withoutRole: string[];
}

/**
 * Wer Mannschaftsführer ist, steht an zwei Stellen: die Benutzerrolle öffnet die Seiten
 * „Mannschaften" und „Spieltermine", die Zuordnung an der Mannschaft (`team_leaders`)
 * entscheidet, welche Spiele er dort verwaltet. Passt beides nicht zusammen, fehlt ihm
 * entweder die Seite oder ihr Inhalt — und niemand merkt es, bis er fragt.
 */
export function leaderMismatches(
  teams: readonly { leaderIds: readonly string[] }[],
  members: readonly { id: string; full_name: string | null; role: string | null }[],
): LeaderMismatches {
  const leading = new Set(teams.flatMap((team) => team.leaderIds));
  const name = (member: { full_name: string | null }) => member.full_name ?? 'Unbekannt';

  return {
    withoutTeam: members
      .filter((member) => member.role === 'team_leader' && !leading.has(member.id))
      .map(name),
    withoutRole: members
      .filter(
        (member) =>
          leading.has(member.id) && member.role !== 'team_leader' && member.role !== 'admin',
      )
      .map(name),
  };
}

/**
 * Ist das Löschen bestätigt? Der eingetippte Name muss passen; Groß- und Kleinschreibung
 * und Leerzeichen an den Rändern zählen nicht — es geht um Absicht, nicht um Tippgenauigkeit.
 */
export function isDeleteConfirmed(input: string, teamName: string): boolean {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('de');
  return normalize(input) !== '' && normalize(input) === normalize(teamName);
}
