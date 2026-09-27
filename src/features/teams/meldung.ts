import type { Enums } from '../../lib/database.types';

/**
 * Die Mannschaftsmeldung aus click-TT lesen (nu.Dokument 011b).
 *
 * Einmal je Halbserie meldet der Verein seine Mannschaften: je Mannschaft ein Kopf
 * („Erwachsene II (4er)"), die Liga, der Mannschaftsführer und die Spieler in
 * Meldereihenfolge („2.3 1554 Nachname, Vorname (1972/m) GER"). Daraus entstehen hier
 * Mannschaften, Ränge und Kader.
 *
 * Das Dokument ist zweispaltig gesetzt: links Mannschaft, Liga und Kontakte, rechts die
 * Spieler — in derselben Textzeile, und die Spieler einer Mannschaft stehen nicht
 * zwingend neben ihrem Kopf. Der Leser ordnet Spieler deshalb nicht nach ihrer Lage zu,
 * sondern über die Mannschaftsnummer ihres Rangs („2.3" gehört zur zweiten Mannschaft).
 *
 * Übernommen wird nur, was für Mannschaft und Aufstellung nötig ist. Telefonnummern,
 * Adressen und E-Mails aus dem Dokument werden nicht gelesen.
 */

export type RankingType = Enums<'ranking_type'>;

export interface MeldungTeam {
  /** Mannschaftsnummer: „Erwachsene II" ist die 2. */
  number: number;
  /** Wie im Dokument: „Erwachsene II". */
  name: string;
  rankingType: RankingType;
  /** Spieler je Spiel: „(4er)" → 4. */
  size: number;
  league: string | null;
  /** Mannschaftsführer als „Nachname, Vorname", wenn das Dokument einen nennt. */
  leader: { lastName: string; firstName: string } | null;
}

export interface MeldungPlayer {
  team: number;
  position: number;
  qttr: number | null;
  lastName: string;
  firstName: string;
  birthYear: number;
  /** RES, SBE … — nur zur Anzeige. */
  status: string | null;
}

export interface Meldung {
  /** „2026/27", wenn das Dokument die Saison nennt. */
  season: string | null;
  teams: MeldungTeam[];
  players: MeldungPlayer[];
}

const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
};

/** „Erwachsene II (4er)", „Jugend 15 (4er)", „Damen III (4er)". */
const TEAM_HEAD =
  /\b(Erwachsene|Herren|Damen|Frauen|Jugend|Jungen|Mädchen|Senioren|Seniorinnen)(?:\s+(\d{2}))?(?:\s+([IVX]{1,4}))?\s+\((\d{1,2})er\)/g;

/** „2.3 1554 Nachname, Vorname (1972/m) GER RES" — das Geschlecht bricht gelegentlich um. */
const PLAYER =
  /\b(\d{1,2})\.(\d{1,2})\s+(\d{3,4})\s+([^,()\d;]+?),\s*([^,()\d;]+?)\s*\((\d{4})\/\s*[mw]?\)?\s*(?:[A-Z]{3}\b)?(?:\s+(?:gA|eA|A)\b)?(?:\s+(RES|SBEM?|JES|WES|NES|SES|SPV|DE|Antrag)\b)?/g;

/** Nach dem Kopf: „Nachname, Vorname;" oder „Nachname, Vorname m 0171…" oder „… T 089…". */
const LEADER = /^\s*([^,;()\d]+?),\s*([^,;()\d]+?)\s*(?:;|\s+[TmM]\s+\d|$)/;

const LEAGUE =
  /\b((?:\d\.\s*)?(?:Bundesliga|Regionalliga|Oberliga|Verbandsliga|Landesliga|Bezirksoberliga|Bezirksliga|Bezirksklasse|Kreisoberliga|Kreisliga|Kreisklasse|Stadtliga|Stadtklasse)\b.*?)(?=\s+[A-ZÄÖÜ][\wäöüß-]*,|\s+Rg\.|\s+\d{1,2}\.\d{1,2}\s+\d{3,4}\s|$)/;

const SEASON = /\b(20\d{2}\/\d{2})\b/;

function rankingTypeOf(word: string, age: string | undefined): RankingType {
  const years = age ? Number(age) : null;
  switch (word) {
    case 'Damen':
    case 'Frauen':
      return 'women';
    case 'Jugend':
    case 'Jungen':
      return years === 11 ? 'youth_11' : years === 13 ? 'youth_13' : years === 15 ? 'youth_15' : 'youth_19';
    case 'Mädchen':
      return years === 11 ? 'girls_11' : years === 13 ? 'girls_13' : years === 15 ? 'girls_15' : 'girls_19';
    case 'Senioren':
    case 'Seniorinnen':
      return years === 50 ? 'seniors_50' : years === 60 ? 'seniors_60' : years === 70 ? 'seniors_70' : years === 75 ? 'seniors_75' : 'seniors_40';
    default:
      return 'men';
  }
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function parseMeldung(lines: readonly string[]): Meldung {
  const teams: MeldungTeam[] = [];
  const players: MeldungPlayer[] = [];
  let season: string | null = null;
  /** Die Mannschaft, deren Liga als Nächstes kommt. */
  let awaitingLeague: MeldungTeam | null = null;

  for (const raw of lines) {
    const line = clean(raw);
    if (line === '') continue;

    season ??= line.match(SEASON)?.[1] ?? null;

    // Spieler zuerst herausnehmen: Ihre Namen sollen nicht als Mannschaftsführer oder
    // Liga gelesen werden, und was übrig bleibt, ist die linke Spalte.
    let left = line;
    for (const match of line.matchAll(PLAYER)) {
      players.push({
        team: Number(match[1]),
        position: Number(match[2]),
        qttr: Number(match[3]) || null,
        lastName: clean(match[4]),
        firstName: clean(match[5]),
        birthYear: Number(match[6]),
        status: match[7] ?? null,
      });
      left = left.replace(match[0], ' ');
    }

    let heads = 0;
    for (const match of left.matchAll(TEAM_HEAD)) {
      heads += 1;
      const number = match[3] ? (ROMAN[match[3]] ?? 1) : 1;
      const rest = left.slice((match.index ?? 0) + match[0].length);
      const leader = rest.match(LEADER);
      const team: MeldungTeam = {
        number,
        name: clean(match[0].replace(/\s*\(\d{1,2}er\)$/, '')),
        rankingType: rankingTypeOf(match[1], match[2]),
        size: Number(match[4]),
        league: null,
        leader: leader ? { lastName: clean(leader[1]), firstName: clean(leader[2]) } : null,
      };
      teams.push(team);
      awaitingLeague = team;
    }
    if (heads > 0) continue;

    const league = left.match(LEAGUE);
    if (league && awaitingLeague && awaitingLeague.league === null) {
      awaitingLeague.league = clean(league[1]);
      awaitingLeague = null;
    }
  }

  // „Erwachsene" neben „Erwachsene II" heißt die erste Mannschaft; ausgeschrieben ist
  // sie in jeder Liste eindeutig.
  for (const team of teams) {
    const siblings = teams.filter((other) => other.rankingType === team.rankingType);
    if (team.number === 1 && siblings.length > 1 && !/\s[IVX]+$/.test(team.name)) {
      team.name = `${team.name} I`;
    }
  }

  players.sort((a, b) => a.team - b.team || a.position - b.position);
  return { season, teams, players };
}

// ---------------------------------------------------------------------------
// Abgleich mit Mitgliedern und vorhandenen Mannschaften
// ---------------------------------------------------------------------------

export interface KnownMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  qttr: number | null;
}

export interface KnownTeam {
  id: string;
  name: string;
  ranking_type: RankingType;
  ranking: number | null;
  size: number;
  leagues: string[] | null;
  leaderIds: string[];
}

export interface KnownRanking {
  profile_id: string;
  ranking_type: RankingType;
  team_number: number;
  position_number: number;
}

export interface PlannedPlayer extends MeldungPlayer {
  profileId: string | null;
  /** Warum kein Mitglied zugeordnet ist. */
  problem: 'not_found' | 'ambiguous' | null;
  kind: 'regular' | 'substitute';
  /** Neuer QTTR-Wert, wenn er sich ändert. */
  qttrChange: { from: number | null; to: number } | null;
}

export interface PlannedTeam {
  meldung: MeldungTeam;
  /** Vorhandene Mannschaft, die aktualisiert wird; sonst wird sie angelegt. */
  existing: KnownTeam | null;
  players: PlannedPlayer[];
  leaderId: string | null;
}

export interface MeldungPlan {
  teams: PlannedTeam[];
  /** Spieler, deren Mannschaftsnummer im Dokument keinen Kopf hat. */
  orphans: MeldungPlayer[];
  /** Ränge desselben Rangtyps, die die Meldung nicht mehr enthält. */
  staleRankings: KnownRanking[];
}

export function normalizeName(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

function memberIndex(members: readonly KnownMember[]) {
  const index = new Map<string, KnownMember[]>();
  for (const member of members) {
    const key = `${normalizeName(member.last_name)}|${normalizeName(member.first_name)}`;
    index.set(key, [...(index.get(key) ?? []), member]);
  }
  return (lastName: string, firstName: string) =>
    index.get(`${normalizeName(lastName)}|${normalizeName(firstName)}`) ?? [];
}

/**
 * Was die Übernahme täte.
 *
 * Mannschaften werden über Rangtyp und Mannschaftsnummer wiedererkannt, ersatzweise über
 * den Namen: Heißt die zweite Mannschaft im Verein „Herren II", bleibt der Name, und nur
 * Größe, Liga und Kader kommen aus der Meldung.
 */
export function planMeldung(
  meldung: Meldung,
  members: readonly KnownMember[],
  teams: readonly KnownTeam[],
  rankings: readonly KnownRanking[],
): MeldungPlan {
  const find = memberIndex(members);
  const byNumber = new Map<number, MeldungTeam[]>();
  for (const team of meldung.teams) {
    byNumber.set(team.number, [...(byNumber.get(team.number) ?? []), team]);
  }

  const planned = meldung.teams.map((team): PlannedTeam => {
    const existing =
      teams.find((known) => known.ranking_type === team.rankingType && known.ranking === team.number) ??
      teams.find((known) => normalizeName(known.name) === normalizeName(team.name)) ??
      null;

    const leaderMatches = team.leader ? find(team.leader.lastName, team.leader.firstName) : [];

    return {
      meldung: team,
      existing,
      players: [],
      leaderId: leaderMatches.length === 1 ? leaderMatches[0].id : null,
    };
  });

  const orphans: MeldungPlayer[] = [];
  for (const player of meldung.players) {
    // Nur eindeutig: Enthält ein Dokument zwei Altersklassen, gibt es „1.1" zweimal.
    const heads = byNumber.get(player.team) ?? [];
    const target = heads.length === 1 ? planned.find((item) => item.meldung === heads[0]) : undefined;
    if (!target) {
      orphans.push(player);
      continue;
    }

    const matches = find(player.lastName, player.firstName);
    const member = matches.length === 1 ? matches[0] : null;
    const qttrChange =
      member && player.qttr !== null && member.qttr !== player.qttr
        ? { from: member.qttr, to: player.qttr }
        : null;

    target.players.push({
      ...player,
      profileId: member?.id ?? null,
      problem: member ? null : matches.length > 1 ? 'ambiguous' : 'not_found',
      kind: 'substitute',
      qttrChange,
    });
  }

  // Die ersten n zugeordneten Spieler stehen am Tisch, der Rest ist Ersatz in
  // Meldereihenfolge. Nicht zugeordnete zählen nicht mit: Sie kommen nicht in den Kader.
  for (const team of planned) {
    let regulars = 0;
    for (const player of team.players) {
      if (player.profileId && regulars < team.meldung.size) {
        player.kind = 'regular';
        regulars += 1;
      }
    }
  }

  const types = new Set(meldung.teams.map((team) => team.rankingType));
  const ranked = new Set(
    planned.flatMap((team) =>
      team.players.flatMap((player) =>
        player.profileId ? [`${player.profileId}|${team.meldung.rankingType}`] : [],
      ),
    ),
  );
  const staleRankings = rankings.filter(
    (ranking) =>
      types.has(ranking.ranking_type) && !ranked.has(`${ranking.profile_id}|${ranking.ranking_type}`),
  );

  return { teams: planned, orphans, staleRankings };
}
