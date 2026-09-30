import { format } from 'date-fns';
import { formatTime, toBerlin } from '../../lib/dates';

/**
 * nuScore-Codes und -PINs aus den click-TT-Listen lesen und den Spielen zuordnen
 * (Aufgabe 9.7).
 *
 * click-TT gibt je Mannschaft zwei PDF-Listen heraus: die Spiel-Codes (nur für
 * Heimspiele — die Heimmannschaft legt das Spiel in nuScore an) und die Spiel-PINs.
 * Eine Zeile je Spiel mit Datum, meist Uhrzeit, den beiden Mannschaften und dem Wert.
 *
 * Das genaue Spaltenbild unterscheidet sich zwischen Verbänden und Jahren. Der Leser
 * verlässt sich deshalb nicht auf Spalten, sondern nur auf drei Dinge, die jede
 * Fassung hat: ein Datum am Anfang des Eintrags, den Wert in seiner Form und — zum
 * Unterscheiden zweier Spiele am selben Tag — Uhrzeit und Gegner im Text. Was er nicht
 * sicher zuordnen kann, zeigt die Vorschau an, statt zu raten.
 */

export type NuscoreKind = 'code' | 'pin';

export interface NuscoreEntry {
  kind: NuscoreKind;
  /** ISO-Datum, wie es in der Liste steht. */
  date: string;
  /** „18:30", wenn die Zeile eine Uhrzeit nennt. */
  time: string | null;
  value: string;
  /** Der ganze Eintrag, für die Gegnersuche und für die Anzeige. */
  text: string;
}

const DATE = /\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/;
const TIME = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?!\.\d)/;

/**
 * Der Spiel-Code: zwölf Zeichen aus Großbuchstaben und Ziffern. click-TT druckt ihn am
 * Stück ans Zeilenende („W67J9WUPW75L"), nuScore nimmt ihn genauso — so wird er auch
 * gespeichert. Mit Bindestrichen oder Leerzeichen geschrieben („W67J-9WUP-W75L") wird er
 * ebenfalls erkannt und ohne Trennzeichen übernommen.
 *
 * Steht der Block am Ende der Zeile, gilt er in jedem Fall als Code. Irgendwo in der
 * Zeile nur, wenn er Buchstaben und Ziffern mischt — sonst hielte der Leser drei kurze
 * Wörter eines Vereinsnamens für einen Code.
 */
const CODE_TRAILING = /\b([A-Z0-9]{12})\s*$/;
const CODE_HYPHEN = /\b([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})\b/;
const CODE_LOOSE = /\b([A-Z0-9]{4}) ?([A-Z0-9]{4}) ?([A-Z0-9]{4})\b/g;

function findCode(text: string): string | null {
  const trailing = text.match(CODE_TRAILING);
  if (trailing) return trailing[1];

  const upper = text.toUpperCase();
  const hyphen = upper.match(CODE_HYPHEN);
  if (hyphen) return hyphen[1] + hyphen[2] + hyphen[3];

  // Ohne Datum und Uhrzeit: Sonst würde „2026" zum ersten Block.
  const rest = upper
    .replace(new RegExp(DATE.source, 'g'), ' ')
    .replace(new RegExp(TIME.source, 'g'), ' ');
  for (const loose of rest.matchAll(CODE_LOOSE)) {
    const joined = loose[1] + loose[2] + loose[3];
    if (/\d/.test(joined) && /[A-Z]/.test(joined)) return joined;
  }
  return null;
}

/** Ein PIN mit Beschriftung: „PIN: 4711", „Spiel-PIN 4711". */
const LABELLED_PIN = /PIN\s*:?\s*([A-Z0-9]{4,12})\b/i;

/**
 * Aus Textzeilen werden Einträge: Jeder beginnt mit einer Zeile, die ein Datum trägt;
 * folgende Zeilen ohne Datum gehören noch dazu. So übersteht der Leser Mannschaftsnamen,
 * die in der Liste auf zwei Zeilen umbrechen.
 *
 * Ein umbrochener Name steht in der PDF oft halb über, halb unter der Datumszeile —
 * die obere Hälfte landet dann beim vorigen Eintrag. Für den Gegner schadet das nicht;
 * den Wert sucht {@link parseNuscoreList} deshalb zuerst in der Datumszeile selbst.
 */
export function splitRecords(lines: readonly string[]): string[][] {
  const records: string[][] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line === '') continue;
    if (DATE.test(line)) records.push([line]);
    else if (records.length > 0) records[records.length - 1].push(line);
  }
  return records;
}

function isoDate(match: RegExpMatchArray): string | null {
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (match[3].length === 2) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Der PIN am Ende einer Zeile — in der click-TT-Liste steht der Wert wie beim Code am
 * Zeilenende. Nur dort: Mitten in der Zeile stehen Spielnummern und Vereinsnamen mit
 * Jahreszahl („TSV 1860"), die genauso aussehen. Fehlt der PIN, gibt es keinen.
 */
function pinAtEnd(line: string): string | null {
  const rest = line
    .toUpperCase()
    .replace(new RegExp(CODE_HYPHEN.source, 'g'), ' ')
    .replace(new RegExp(DATE.source, 'g'), ' ')
    .replace(new RegExp(TIME.source, 'g'), ' ');
  const tokens = rest.split(/[\s|;,]+/).filter(Boolean);
  // Ein Code (Zeile mit Code- und PIN-Spalte) steht dahinter, der PIN davor.
  while (tokens.length > 0 && /^[A-Z0-9]{12}$/.test(tokens[tokens.length - 1])) {
    const code = tokens.pop() as string;
    if (!(/\d/.test(code) && /[A-Z]/.test(code))) return null;
  }
  const last = tokens[tokens.length - 1] ?? '';
  // Mit mindestens einer Ziffer: „TTSV" oder „HERREN" in Großbuchstaben ist kein PIN.
  return /^[A-Z0-9]{4,11}$/.test(last) && /\d/.test(last) ? last : null;
}

/** Sieht aus wie eine Jahreszahl im Vereinsnamen („1920"). */
const YEAR_LIKE = /^(18|19|20)\d{2}$/;

/**
 * Der PIN eines Eintrags: beschriftet irgendwo, sonst am Ende der Datumszeile. Bricht
 * der Gegner um und endet die Datumszeile mit einer Jahreszahl („Zorneding 1920"),
 * während die Folgezeile einen Wert trägt („II 4711"), gilt der aus der Folgezeile.
 */
function findPin(record: readonly string[]): string | null {
  const labelled = record.join(' ').match(LABELLED_PIN);
  if (labelled) return labelled[1].toUpperCase();

  const [first, ...rest] = record.map(pinAtEnd);
  const later = rest.filter((pin): pin is string => pin !== null);
  if (first && !(YEAR_LIKE.test(first) && later.length > 0)) return first;
  return later[later.length - 1] ?? first ?? null;
}

export function parseNuscoreList(lines: readonly string[], kind: NuscoreKind): NuscoreEntry[] {
  const entries: NuscoreEntry[] = [];

  for (const record of splitRecords(lines)) {
    const text = record.join(' ');
    const dateMatch = text.match(DATE);
    const date = dateMatch ? isoDate(dateMatch) : null;
    if (!date) continue;

    const timeMatch = text.slice((dateMatch?.index ?? 0) + (dateMatch?.[0].length ?? 0)).match(TIME);
    const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null;

    const value = kind === 'code' ? (findCode(record[0]) ?? findCode(text)) : findPin(record);
    if (!value) continue;

    entries.push({ kind, date, time, value, text });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Zuordnung
// ---------------------------------------------------------------------------

export interface NuscoreMatch {
  id: string;
  dtstart: string;
  /** Der ursprüngliche Termin aus dem Spielplan — die Liste kennt nur diesen. */
  dtstart_external?: string | null;
  opponent: string | null;
  nuscore_code: string | null;
  nuscore_pin: string | null;
}

export interface NuscoreAssignment {
  matchId: string;
  code: string | null;
  pin: string | null;
}

export interface NuscoreUnassigned {
  entry: NuscoreEntry;
  reason: 'no_match' | 'ambiguous';
}

export interface NuscorePlan {
  assignments: NuscoreAssignment[];
  unassigned: NuscoreUnassigned[];
}

function berlinDate(value: string): string {
  return format(toBerlin(value), 'yyyy-MM-dd');
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Nennt der Eintrag den Gegner? Es genügt ein unterscheidendes Wort seines Namens. */
function mentionsOpponent(text: string, opponent: string | null): boolean {
  if (!opponent) return false;
  const haystack = ` ${normalize(text)} `;
  const words = normalize(opponent)
    .split(' ')
    // „TTC", „SV", „II" unterscheiden nichts.
    .filter((word) => word.length >= 4);
  return words.length > 0 && words.every((word) => haystack.includes(` ${word} `));
}

function candidatesFor(entry: NuscoreEntry, matches: readonly NuscoreMatch[]): NuscoreMatch[] {
  let found = matches.filter(
    (match) =>
      berlinDate(match.dtstart) === entry.date ||
      (match.dtstart_external != null && berlinDate(match.dtstart_external) === entry.date),
  );
  if (found.length <= 1) return found;

  if (entry.time) {
    const byTime = found.filter(
      (match) =>
        formatTime(match.dtstart) === entry.time ||
        (match.dtstart_external != null && formatTime(match.dtstart_external) === entry.time),
    );
    if (byTime.length > 0) found = byTime;
  }
  if (found.length <= 1) return found;

  const byOpponent = found.filter((match) => mentionsOpponent(entry.text, match.opponent));
  if (byOpponent.length === 1) return byOpponent;
  if (byOpponent.length === 0) return found;

  // „TSV Kirchheim II" und „TSV Kirchheim III" teilen jedes Wort: Dann entscheidet der
  // ganze Name, als eigene Wörter im Eintrag.
  const byName = byOpponent.filter((match) =>
    ` ${normalize(entry.text)} `.includes(` ${normalize(match.opponent ?? '')} `),
  );
  return byName.length > 0 ? byName : byOpponent;
}

/**
 * Welche Werte an welches Spiel gehen.
 *
 * `matches` sind die Spiele **einer** Mannschaft: Die Listen gelten je Mannschaft, und
 * zwei Mannschaften spielen am selben Tag oft beide. Ein Wert, der schon am Spiel steht,
 * zählt nicht als Änderung.
 */
export function planNuscoreImport(
  entries: readonly NuscoreEntry[],
  matches: readonly NuscoreMatch[],
): NuscorePlan {
  const byMatch = new Map<string, NuscoreAssignment>();
  const unassigned: NuscoreUnassigned[] = [];

  for (const entry of entries) {
    const found = candidatesFor(entry, matches);
    if (found.length !== 1) {
      unassigned.push({ entry, reason: found.length === 0 ? 'no_match' : 'ambiguous' });
      continue;
    }

    const match = found[0];
    const current = entry.kind === 'code' ? match.nuscore_code : match.nuscore_pin;
    if (current === entry.value) continue;

    const assignment = byMatch.get(match.id) ?? { matchId: match.id, code: null, pin: null };
    if (entry.kind === 'code') assignment.code = entry.value;
    else assignment.pin = entry.value;
    byMatch.set(match.id, assignment);
  }

  const order = new Map(matches.map((match, index) => [match.id, index]));
  const assignments = [...byMatch.values()].sort(
    (a, b) => (order.get(a.matchId) ?? 0) - (order.get(b.matchId) ?? 0),
  );
  return { assignments, unassigned };
}
