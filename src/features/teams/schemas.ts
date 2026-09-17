import { z } from 'zod';

/**
 * Die beiden Modi der Aufstellung und die drei der Ersatzanfragen, mit den Hilfetexten
 * aus dem TT-Planer. Sie stehen hier wörtlich, weil sie das Verhalten erklären, das wir
 * nachbauen — eine eigene Formulierung würde nur Unterschiede suggerieren, die es nicht
 * gibt.
 */
export const LINEUP_MODE_HELP = {
  fixed:
    'Feste Stammspieler: Mit dieser Option könnt ihr Mannschaften verwalten, die primär mit ' +
    'den gleichen Spielern antreten soll. Sofern ein Stammspieler nicht spielen kann, wird ' +
    'automatisch ein Ersatz gesucht.',
  open:
    'Offene Spieler: Mit dieser Option könnt ihr Mannschaften verwalten, bei denen die ' +
    'Aufstellung offen ist. Alle Spieler werden für das Spiel angefragt und können zu- oder ' +
    'absagen. Der Mannschaftsführer kann bei einer Überbesetzung die finale Aufstellung ' +
    'festlegen.',
} as const;

export const SUBSTITUTE_MODE_HELP = {
  sequential:
    'Einzeln nach Reihenfolge: Die Reihenfolge der Ersatzspieler ist für die automatischen ' +
    'Ersatzanfragen relevant. Spieler werden der Reihe nach angefragt. Sofern dieser nicht ' +
    'Ersatz spielen kann, wird der nächste aus der Liste angefragt.',
  parallel:
    'Alle Ersatzspieler gleichzeitig: Alle hinterlegten Ersatzspieler werden bei automatischen ' +
    'Ersatzanfragen gleichzeitig benachrichtigt. Sofern eine Ersatzanfrage für einen Spieler ' +
    'angenommen wird, werden alle anderen Anfragen gelöscht.',
  manual:
    'Manuell: Mit dieser Option werden keine automatischen Ersatzanfragen erstellt, sobald ein ' +
    'Stammspieler absagt. Der Mannschaftsführer oder Admin kann die Ersatzanfragen manuell ' +
    'erstellen und verwalten.',
} as const;

export const LINEUP_MODE_LABELS = {
  fixed: 'Feste Stammspieler',
  open: 'Offene Spieler',
} as const;

export const SUBSTITUTE_MODE_LABELS = {
  sequential: 'Einzeln nach Reihenfolge',
  parallel: 'Alle Ersatzspieler gleichzeitig',
  manual: 'Manuell',
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
  substituteMode: 'sequential',
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
