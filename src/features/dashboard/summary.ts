import type { MatchRow, Participation } from '../matches/api';

/**
 * Die Zahlen der Übersicht als reine Funktionen.
 *
 * Ein Countdown, der sich um einen Tag verrechnet, fällt in der Oberfläche niemandem auf
 * — er steht einfach da und ist falsch. Hier lässt sich jede Grenze (heute, morgen, genau
 * 30 Tage) mit einem festen „jetzt" durchprüfen.
 */

export interface MatchCountdown {
  /** Das nächste Spiel, an dem dieses Mitglied beteiligt ist. */
  next: MatchRow | null;
  /** Ganze Tage bis dahin: 0 = heute, 1 = morgen. Ohne Spiel: null. */
  days: number | null;
  /** Wie viele Spiele in den nächsten 30 Tagen anstehen. */
  within30: number;
  /** Wie viele kommende Spiele es insgesamt sind — die Zahl am Reiter „Spiele". */
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mitternacht in Ortszeit — der Countdown zählt Kalendertage, nicht 24-Stunden-Blöcke. */
function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Tage bis zum Termin, in Kalendertagen. Ein Spiel heute Abend ist „heute" (0), auch wenn
 * es noch 23 Stunden hin sind; ein Spiel morgen früh ist „morgen" (1), auch wenn es nur
 * zehn Stunden sind. So würde es auch jeder im Verein sagen.
 */
export function calendarDaysUntil(target: string | Date, now: Date): number {
  const then = typeof target === 'string' ? new Date(target) : target;
  return Math.round((startOfDay(then) - startOfDay(now)) / DAY_MS);
}

/**
 * Countdown-Kachel „Mannschaftsspiele".
 *
 * Gezählt werden nur Spiele, zu denen dieses Mitglied gehört — ein Spieler der dritten
 * Herren interessiert der Termin der ersten nicht. Abgesagte Spiele und Streichungen aus
 * dem Kader fallen raus.
 */
export function matchCountdown(
  matches: MatchRow[],
  participations: Participation[],
  profileId: string | null,
  now: Date = new Date(),
): MatchCountdown {
  if (!profileId) return { next: null, days: null, within30: 0, total: 0 };

  const mine = new Set(
    participations
      .filter((entry) => entry.profile_id === profileId && !entry.removed)
      .map((entry) => entry.match_id),
  );

  const upcoming = matches
    .filter((match) => match.active && mine.has(match.id) && match.dtstart !== null)
    .filter((match) => new Date(match.dtstart!).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.dtstart!).getTime() - new Date(b.dtstart!).getTime());

  const next = upcoming[0] ?? null;

  return {
    next,
    days: next ? calendarDaysUntil(next.dtstart!, now) : null,
    within30: upcoming.filter((match) => calendarDaysUntil(match.dtstart!, now) <= 30).length,
    total: upcoming.length,
  };
}

export interface OpenResponses {
  /** Wie viele Rückmeldungen fehlen (eine Person kann bei mehreren Spielen fehlen). */
  players: number;
  /** Bei wie vielen Spielen. */
  matches: number;
}

/**
 * „Offene Rückmeldungen: n Spieler bei m Spielen" — die Kachel für Mannschaftsführer und
 * Administratoren.
 *
 * „Offen" heißt dasselbe wie in `v_open_participations`: keine Antwort, oder eine Antwort
 * auf eine ältere Fassung des Termins. Wer abgesagt hat, hat geantwortet.
 *
 * `teamIds` grenzt auf die eigenen Mannschaften ein; `null` zählt alle (Administrator).
 */
export function countOpenResponses(
  matches: MatchRow[],
  participations: Participation[],
  teamIds: Set<string> | null,
  now: Date = new Date(),
): OpenResponses {
  const relevant = new Map(
    matches
      .filter((match) => match.active && match.dtstart !== null)
      .filter((match) => new Date(match.dtstart!).getTime() > now.getTime())
      .filter((match) => teamIds === null || teamIds.has(match.team_id))
      .map((match) => [match.id, match]),
  );

  const matchIds = new Set<string>();
  let players = 0;

  for (const entry of participations) {
    const match = relevant.get(entry.match_id);
    if (!match || entry.removed) continue;

    const answered =
      entry.response !== 'none' && (entry.version_responded ?? 0) >= match.version;
    if (answered) continue;

    players += 1;
    matchIds.add(entry.match_id);
  }

  return { players, matches: matchIds.size };
}

export interface Quicklink {
  label: string;
  url: string;
}

/**
 * Die Quicklinks aus `club_settings.quicklinks_json`.
 *
 * Der Wert kommt aus einem Textfeld, das ein Mensch pflegt — kaputtes JSON ist damit kein
 * Ausnahmefall, sondern ein Dienstagnachmittag. Statt die Übersicht abstürzen zu lassen,
 * liefert die Funktion dann eine leere Liste.
 *
 * Nur `http`- und `https`-Adressen kommen durch: ein `javascript:`-Link in einer
 * Einstellung wäre sonst ein Skript, das jedes Mitglied beim Öffnen der Startseite anklickt.
 */
export function parseQuicklinks(raw: string | null | undefined): Quicklink[] {
  if (!raw || raw.trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry): Quicklink[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { label, url } = entry as Record<string, unknown>;
    if (typeof label !== 'string' || typeof url !== 'string') return [];
    if (label.trim() === '' || !/^https?:\/\//i.test(url.trim())) return [];
    return [{ label: label.trim(), url: url.trim() }];
  });
}

/** Die drei Links, die der TT-Planer anbietet — als Vorschlag im Einstellungsfeld. */
export const SUGGESTED_QUICKLINKS: readonly string[] = [
  'Tabelle & Spielplan',
  'TTR-Rechner',
  'Vereinsrangliste',
];

export function serializeQuicklinks(links: Quicklink[]): string {
  return JSON.stringify(links, null, 2);
}
