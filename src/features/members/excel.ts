import type { Enums } from '../../lib/database.types';
import { RANKING_TYPE_LABELS, ROLE_LABELS } from '../../lib/labels';

/**
 * Excel-Import und -Update der Mitglieder (Aufgabe 9.5) — die Regeln, ohne Tabellenkalkulation.
 *
 * Alles hier ist rein: Es kommen Zellwerte herein und fertige Datensätze oder Fehlermeldungen
 * heraus. Das ist bei diesem Modul wichtiger als anderswo, denn ein Import läuft genau einmal,
 * mit echten Daten, und ein Fehler betrifft dann alle Mitglieder auf einmal. Hier lässt sich
 * jede krumme Zelle durchspielen, bevor jemand eine Datei hochlädt.
 */

export type Role = Enums<'user_role'>;
export type Gender = Enums<'gender'>;
export type RankingType = Enums<'ranking_type'>;

// ---------------------------------------------------------------- Spalten

export interface ColumnSpec {
  /** Überschrift in der Datei — so, wie sie ein Mensch liest. */
  header: string;
  /** Nur im Update-Blatt: identifiziert bestehende Mitglieder. */
  updateOnly?: boolean;
}

/**
 * Die Spalten der Vorlage, in dieser Reihenfolge.
 *
 * Bewusst nah an der Vorlage des TT-Planers (Bestandsaufnahme G), damit dessen Export
 * ohne Umsortieren hier hineinpasst — das ist der Weg der Datenübernahme in Aufgabe 10.2.
 */
export const COLUMNS: ColumnSpec[] = [
  { header: 'Vorname' },
  { header: 'Nachname' },
  { header: 'E-Mail' },
  { header: 'Rolle' },
  { header: 'Geschlecht' },
  { header: 'Geburtstag' },
  { header: 'Telefonnummer' },
  { header: 'Handynummer' },
  { header: 'Mitgliedsnummer' },
  { header: 'QTTR' },
  { header: 'Rang' },
  { header: 'Kein Mannschaftsspieler' },
  { header: 'Gruppen' },
  { header: 'Trainings' },
];

export const HEADERS = COLUMNS.map((column) => column.header);

/** Eine Beispielzeile — ohne sie rät beim ersten Ausfüllen jeder anders. */
export const TEMPLATE_EXAMPLE: Record<string, string> = {
  Vorname: 'Erika',
  Nachname: 'Mustermann',
  'E-Mail': 'erika@example.org',
  Rolle: 'Mitglied',
  Geschlecht: 'weiblich',
  Geburtstag: '06.05.1988',
  Telefonnummer: '',
  Handynummer: '0170 1234567',
  Mitgliedsnummer: '42',
  QTTR: '1450',
  Rang: '1.2',
  'Kein Mannschaftsspieler': 'nein',
  Gruppen: 'Hobby',
  Trainings: 'Erwachsenentraining',
};

// ---------------------------------------------------------------- Zellen lesen

/** Was aus einer Zelle kommen kann, bevor jemand es angefasst hat. */
export type Cell = string | number | boolean | Date | null | undefined;

export function text(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return formatGermanDate(cell);
  return String(cell).trim();
}

/** Deutsche Ja/Nein-Spalten. Leer heißt nein. */
export function bool(cell: Cell): boolean {
  const value = text(cell).toLowerCase();
  return ['ja', 'x', 'wahr', 'true', '1'].includes(value);
}

export function number(cell: Cell): number | null {
  const value = text(cell).replace(',', '.');
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatGermanDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Ein Geburtstag als ISO-Datum.
 *
 * Excel liefert je nach Zellformat einen Text („06.05.1988"), ein Datum oder eine Zahl.
 * Alle drei kommen in derselben Datei vor, wenn jemand eine Spalte nachträglich formatiert
 * hat — deshalb versteht diese Funktion alle drei.
 */
export function parseDate(cell: Cell): string | null {
  if (cell === null || cell === undefined || cell === '') return null;

  if (cell instanceof Date) {
    return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(
      cell.getDate(),
    ).padStart(2, '0')}`;
  }

  const value = String(cell).trim();

  // 06.05.1988 — die Schreibweise der Vorlage.
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (german) {
    const [, day, month, year] = german;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 1988-05-06 — was herauskommt, wenn jemand die Datei in einem anderen Programm speichert.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  return null;
}

// ---------------------------------------------------------------- Auswahlfelder

/** Deutsche Beschriftung → Enum. Groß- und Kleinschreibung ist egal. */
function lookup<T extends string>(labels: Record<T, string>): (value: string) => T | null {
  const byLabel = new Map<string, T>(
    (Object.entries(labels) as [T, string][]).map(([key, label]) => [label.toLowerCase(), key]),
  );
  // Der englische Schlüssel geht auch durch: Wer die Datei aus der Datenbank baut,
  // soll sie nicht erst übersetzen müssen.
  for (const key of Object.keys(labels) as T[]) byLabel.set(key.toLowerCase(), key);

  return (value: string) => byLabel.get(value.trim().toLowerCase()) ?? null;
}

export const parseRole = lookup<Role>(ROLE_LABELS);
export const parseRankingType = lookup<RankingType>(RANKING_TYPE_LABELS);

const GENDER_LABELS: Record<Gender, string> = {
  male: 'männlich',
  female: 'weiblich',
  unspecified: 'keine Angabe',
};

export const parseGender = lookup<Gender>(GENDER_LABELS);

export function genderLabel(gender: Gender | null | undefined): string {
  // „keine Angabe" gehört nicht in die Datei: Eine leere Zelle sagt dasselbe und lädt
  // niemanden dazu ein, sie abzutippen.
  return gender && gender !== 'unspecified' ? GENDER_LABELS[gender] : '';
}

/**
 * Ein Rang wie „1.2": erste Mannschaft, Position zwei.
 *
 * Der TT-Planer führt je Altersklasse eine eigene Spalte. Eine Spalte „Rang" reicht für
 * den Alltagsfall — welche Klasse gemeint ist, ergibt sich aus dem Geschlecht und dem
 * Alter. Wer mehrere Ränge pflegt, tut das in der Anwendung; ein Import mit fünfzehn
 * Rangspalten wäre eine Vorlage, die niemand ausfüllt.
 */
export function parseRanking(value: string): { team: number; position: number } | null {
  const match = /^(\d{1,2})\s*[.,]\s*(\d{1,2})$/.exec(value.trim());
  if (!match) return null;

  const team = Number(match[1]);
  const position = Number(match[2]);
  if (team < 1 || team > 99 || position < 1 || position > 99) return null;

  return { team, position };
}

/** „Hobby, Jugend" oder `"Training 1","Training 2"` — beides kommt vor. */
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim().replace(/^"(.*)"$/, '$1').trim())
    .filter((part) => part !== '');
}

// ---------------------------------------------------------------- Zeilen prüfen

export interface ParsedMember {
  first_name: string;
  last_name: string;
  email: string | null;
  role: Role;
  gender: Gender | null;
  birthday: string | null;
  phone: string | null;
  mobile_phone: string | null;
  member_number: string | null;
  qttr: number | null;
  no_games: boolean;
  ranking: { team: number; position: number } | null;
  groups: string[];
  trainings: string[];
}

export interface RowProblem {
  /** Zeilennummer in der Datei, wie sie Excel anzeigt (Kopfzeile ist 1). */
  row: number;
  column: string;
  message: string;
}

export interface ParseResult {
  members: { row: number; values: ParsedMember }[];
  problems: RowProblem[];
}

/** Eine Zeile als Zuordnung Überschrift → Zelle. */
export type SheetRow = Record<string, Cell>;

export function parseMemberRows(rows: SheetRow[], firstRowNumber = 2): ParseResult {
  const members: ParseResult['members'] = [];
  const problems: RowProblem[] = [];
  const seenEmails = new Map<string, number>();

  rows.forEach((row, index) => {
    const line = firstRowNumber + index;
    const problem = (column: string, message: string) => problems.push({ row: line, column, message });

    const firstName = text(row.Vorname);
    const lastName = text(row.Nachname);

    // Eine völlig leere Zeile ist kein Fehler — Tabellen haben unten oft Leerzeilen.
    const empty = HEADERS.every((header) => text(row[header]) === '');
    if (empty) return;

    if (firstName === '') problem('Vorname', 'fehlt');
    if (lastName === '') problem('Nachname', 'fehlt');

    const emailRaw = text(row['E-Mail']);
    let email: string | null = null;
    if (emailRaw !== '') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
        problem('E-Mail', `„${emailRaw}" ist keine gültige Adresse`);
      } else {
        email = emailRaw.toLowerCase();
        const earlier = seenEmails.get(email);
        // Zwei Zeilen mit derselben Adresse: Die Datenbank ließe nur eine durch, und
        // welche das wäre, entschiede der Zufall.
        if (earlier) problem('E-Mail', `steht schon in Zeile ${earlier}`);
        else seenEmails.set(email, line);
      }
    }

    const roleRaw = text(row.Rolle);
    const role = roleRaw === '' ? 'member' : parseRole(roleRaw);
    if (role === null) problem('Rolle', `„${roleRaw}" kenne ich nicht`);

    const genderRaw = text(row.Geschlecht);
    const gender = genderRaw === '' ? null : parseGender(genderRaw);
    if (genderRaw !== '' && gender === null) problem('Geschlecht', `„${genderRaw}" kenne ich nicht`);

    const birthdayRaw = text(row.Geburtstag);
    const birthday = parseDate(row.Geburtstag);
    if (birthdayRaw !== '' && birthday === null) {
      problem('Geburtstag', `„${birthdayRaw}" ist kein Datum (erwartet: 06.05.1988)`);
    }

    const rankingRaw = text(row.Rang);
    const ranking = rankingRaw === '' ? null : parseRanking(rankingRaw);
    if (rankingRaw !== '' && ranking === null) {
      problem('Rang', `„${rankingRaw}" ist kein Rang (erwartet: 1.2)`);
    }

    const qttrRaw = text(row.QTTR);
    const qttr = number(row.QTTR);
    if (qttrRaw !== '' && qttr === null) problem('QTTR', `„${qttrRaw}" ist keine Zahl`);

    if (role === null) return;

    members.push({
      row: line,
      values: {
        first_name: firstName,
        last_name: lastName,
        email,
        role,
        gender,
        birthday,
        phone: text(row.Telefonnummer) || null,
        mobile_phone: text(row.Handynummer) || null,
        member_number: text(row.Mitgliedsnummer) || null,
        qttr,
        no_games: bool(row['Kein Mannschaftsspieler']),
        ranking,
        groups: parseList(text(row.Gruppen)),
        trainings: parseList(text(row.Trainings)),
      },
    });
  });

  return { members, problems };
}

// ---------------------------------------------------------------- Abgleich

export interface ExistingMember {
  id: string;
  email: string | null;
  member_number: string | null;
  full_name: string | null;
}

export interface ImportPlan {
  create: ParsedMember[];
  update: { id: string; values: ParsedMember }[];
  /** Zeilen, die zu mehreren vorhandenen Mitgliedern passen — die rührt niemand an. */
  ambiguous: { row: number; values: ParsedMember }[];
}

/**
 * Was der Import tun würde.
 *
 * Zugeordnet wird in dieser Reihenfolge: E-Mail, dann Mitgliedsnummer, dann der
 * vollständige Name. Die E-Mail zuerst, weil sie in der Datenbank eindeutig ist; der Name
 * zuletzt, weil zwei Mitglieder gleich heißen können — passt er auf mehrere, bleibt die
 * Zeile liegen, statt das falsche Mitglied zu überschreiben.
 */
export function planImport(
  parsed: { row: number; values: ParsedMember }[],
  existing: ExistingMember[],
): ImportPlan {
  const byEmail = new Map<string, ExistingMember[]>();
  const byNumber = new Map<string, ExistingMember[]>();
  const byName = new Map<string, ExistingMember[]>();

  const push = (map: Map<string, ExistingMember[]>, key: string, member: ExistingMember) => {
    const list = map.get(key) ?? [];
    list.push(member);
    map.set(key, list);
  };

  for (const member of existing) {
    if (member.email) push(byEmail, member.email.toLowerCase(), member);
    if (member.member_number) push(byNumber, member.member_number.trim(), member);
    if (member.full_name) push(byName, member.full_name.trim().toLowerCase(), member);
  }

  const plan: ImportPlan = { create: [], update: [], ambiguous: [] };

  for (const entry of parsed) {
    const { values } = entry;
    const fullName = `${values.first_name} ${values.last_name}`.trim().toLowerCase();

    const matches =
      (values.email ? byEmail.get(values.email) : undefined) ??
      (values.member_number ? byNumber.get(values.member_number.trim()) : undefined) ??
      byName.get(fullName) ??
      [];

    if (matches.length === 0) plan.create.push(values);
    else if (matches.length === 1) plan.update.push({ id: matches[0].id, values });
    else plan.ambiguous.push(entry);
  }

  return plan;
}

// ---------------------------------------------------------------- Export

export interface ExportMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: Role | null;
  gender: Gender | null;
  birthday: string | null;
  phone: string | null;
  mobile_phone: string | null;
  member_number: string | null;
  qttr: number | null;
  no_games: boolean | null;
}

export interface ExportContext {
  /** Rang je Mitglied, schon als „1.2" formatiert. */
  rankings: Map<string, string>;
  groups: Map<string, string[]>;
  trainings: Map<string, string[]>;
}

/**
 * Eine Mitgliederzeile für den Download.
 *
 * Bewusst dieselben Spalten wie beim Import: Wer die Datei herunterlädt, bearbeitet und
 * wieder hochlädt, soll nicht erst Spalten umbenennen müssen. Genau das ist der
 * Update-Weg des TT-Planers.
 */
export function memberToRow(member: ExportMember, context: ExportContext): Record<string, string> {
  const isoBirthday = member.birthday;
  const birthday = isoBirthday
    ? `${isoBirthday.slice(8, 10)}.${isoBirthday.slice(5, 7)}.${isoBirthday.slice(0, 4)}`
    : '';

  return {
    Vorname: member.first_name ?? '',
    Nachname: member.last_name ?? '',
    'E-Mail': member.email ?? '',
    Rolle: member.role ? ROLE_LABELS[member.role] : '',
    Geschlecht: genderLabel(member.gender),
    Geburtstag: birthday,
    Telefonnummer: member.phone ?? '',
    Handynummer: member.mobile_phone ?? '',
    Mitgliedsnummer: member.member_number ?? '',
    QTTR: member.qttr === null || member.qttr === undefined ? '' : String(member.qttr),
    Rang: context.rankings.get(member.id) ?? '',
    'Kein Mannschaftsspieler': member.no_games ? 'ja' : 'nein',
    Gruppen: (context.groups.get(member.id) ?? []).join(', '),
    Trainings: (context.trainings.get(member.id) ?? []).join(', '),
  };
}
