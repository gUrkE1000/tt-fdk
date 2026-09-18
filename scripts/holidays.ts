// Feiertage und Schulferien: die reine Logik hinter `import-holidays.ts`.
//
// Zwei Quellen, zwei Charaktere:
//
//   * Gesetzliche Feiertage stehen fest. Sie ergeben sich aus dem Kalender und aus
//     Landesrecht, nicht aus einer Datenbank — deshalb lassen sie sich rechnen.
//     `publicHolidays()` tut genau das; `parsePublicHolidaysApi()` liest dieselben
//     Daten aus feiertage-api.de, wenn ein Netzzugang da ist.
//   * Schulferien legt jedes Land jedes Jahr neu fest. Die lassen sich nicht rechnen,
//     nur laden.
//
// Alles hier ist rein: gleiche Eingabe, gleiche Ausgabe, kein Netz, keine Uhr.

export type HolidayKind = 'public' | 'school';

export interface HolidayRow {
  bundesland: string;
  kind: HolidayKind;
  name: string;
  /** ISO-Datum `YYYY-MM-DD`. */
  startDate: string;
  /** ISO-Datum `YYYY-MM-DD`, bei einzelnen Tagen gleich `startDate`. */
  endDate: string;
}

export const BUNDESLAENDER = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
] as const;

// ---------------------------------------------------------------------------- Kalender

/**
 * Ostersonntag im gregorianischen Kalender (Meeus/Jones/Butcher).
 *
 * Neun Zehntel der beweglichen Feiertage hängen an diesem einen Datum, deshalb
 * steht die Rechnung hier und nicht in einer Abhängigkeit.
 */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return isoDate(year, month, day);
}

/** Buß- und Bettag: der Mittwoch vor dem 23. November. */
export function repentanceDay(year: number): string {
  const date = new Date(Date.UTC(year, 10, 22));
  while (date.getUTCDay() !== 3) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------- Feiertage

interface HolidayRule {
  name: string;
  date: (year: number, easter: string) => string;
  /** Leer = in allen sechzehn Ländern. */
  states?: readonly string[];
}

/**
 * Die gesetzlichen Feiertage nach Bundesland.
 *
 * Bewusst nicht enthalten sind die gemeindeweise geltenden Ausnahmen (Fronleichnam in
 * Teilen Sachsens und Thüringens, Mariä Himmelfahrt in katholischen Gemeinden Bayerns)
 * und einmalige Feiertage einzelner Jahre. Für die Trainingsplanung wäre ein zu viel
 * übersprungener Termin schlimmer als ein zu wenig: wer an einem solchen Tag nicht kann,
 * sagt ab — ein Termin, den es gar nicht gibt, lässt sich dagegen nicht retten.
 */
const RULES: readonly HolidayRule[] = [
  { name: 'Neujahr',                    date: (y) => isoDate(y, 1, 1) },
  { name: 'Heilige Drei Könige',        date: (y) => isoDate(y, 1, 6),  states: ['BW', 'BY', 'ST'] },
  { name: 'Internationaler Frauentag',  date: (y) => isoDate(y, 3, 8),  states: ['BE', 'MV'] },
  { name: 'Karfreitag',                 date: (_y, e) => addDays(e, -2) },
  { name: 'Ostersonntag',               date: (_y, e) => e,             states: ['BB'] },
  { name: 'Ostermontag',                date: (_y, e) => addDays(e, 1) },
  { name: 'Tag der Arbeit',             date: (y) => isoDate(y, 5, 1) },
  { name: 'Christi Himmelfahrt',        date: (_y, e) => addDays(e, 39) },
  { name: 'Pfingstsonntag',             date: (_y, e) => addDays(e, 49), states: ['BB'] },
  { name: 'Pfingstmontag',              date: (_y, e) => addDays(e, 50) },
  {
    name: 'Fronleichnam',
    date: (_y, e) => addDays(e, 60),
    states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
  },
  { name: 'Mariä Himmelfahrt',          date: (y) => isoDate(y, 8, 15), states: ['SL'] },
  { name: 'Weltkindertag',              date: (y) => isoDate(y, 9, 20), states: ['TH'] },
  { name: 'Tag der Deutschen Einheit',  date: (y) => isoDate(y, 10, 3) },
  {
    name: 'Reformationstag',
    date: (y) => isoDate(y, 10, 31),
    states: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'],
  },
  {
    name: 'Allerheiligen',
    date: (y) => isoDate(y, 11, 1),
    states: ['BW', 'BY', 'NW', 'RP', 'SL'],
  },
  { name: 'Buß- und Bettag',            date: (y) => repentanceDay(y), states: ['SN'] },
  { name: '1. Weihnachtstag',           date: (y) => isoDate(y, 12, 25) },
  { name: '2. Weihnachtstag',           date: (y) => isoDate(y, 12, 26) },
];

/** Alle gesetzlichen Feiertage eines Jahres, für alle sechzehn Länder. */
export function publicHolidays(year: number): HolidayRow[] {
  const easter = easterSunday(year);
  const rows: HolidayRow[] = [];

  for (const rule of RULES) {
    const date = rule.date(year, easter);
    for (const state of rule.states ?? BUNDESLAENDER) {
      rows.push({ bundesland: state, kind: 'public', name: rule.name, startDate: date, endDate: date });
    }
  }

  return sortRows(rows);
}

/**
 * Dieselben Daten aus feiertage-api.de.
 *
 * Die Antwort hat je Bundesland ein Objekt, dazu `NATIONAL` für die bundesweiten.
 * Was unter `NATIONAL` steht, gilt überall und wird deshalb auf alle Länder verteilt.
 */
export function parsePublicHolidaysApi(payload: unknown): HolidayRow[] {
  if (payload == null || typeof payload !== 'object') return [];
  const rows: HolidayRow[] = [];

  for (const [key, group] of Object.entries(payload as Record<string, unknown>)) {
    if (group == null || typeof group !== 'object') continue;

    const states =
      key === 'NATIONAL'
        ? BUNDESLAENDER
        : (BUNDESLAENDER as readonly string[]).includes(key)
          ? [key]
          : [];
    if (states.length === 0) continue;

    for (const [name, entry] of Object.entries(group as Record<string, unknown>)) {
      const date =
        entry != null && typeof entry === 'object'
          ? (entry as { datum?: unknown }).datum
          : entry;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(date)) continue;

      const day = date.slice(0, 10);
      for (const state of states) {
        rows.push({ bundesland: state, kind: 'public', name, startDate: day, endDate: day });
      }
    }
  }

  return sortRows(rows);
}

// ---------------------------------------------------------------------------- Schulferien

/**
 * Schulferien aus ferien-api.de.
 *
 * Die Namen kommen kleingeschrieben („osterferien"); sie gehen in den eindeutigen
 * Schlüssel ein und werden deshalb einheitlich großgeschrieben, sonst legte ein
 * späterer Lauf mit anderer Schreibweise dieselben Ferien noch einmal an.
 */
export function parseSchoolHolidays(payload: unknown, fallbackState?: string): HolidayRow[] {
  if (!Array.isArray(payload)) return [];
  const rows: HolidayRow[] = [];

  for (const entry of payload) {
    if (entry == null || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;

    const state = typeof item.stateCode === 'string' ? item.stateCode.toUpperCase() : fallbackState;
    const start = typeof item.start === 'string' ? item.start.slice(0, 10) : null;
    const end = typeof item.end === 'string' ? item.end.slice(0, 10) : start;
    const name = typeof item.name === 'string' ? titleCase(item.name) : null;

    if (!state || !start || !end || !name) continue;
    if (!(BUNDESLAENDER as readonly string[]).includes(state)) continue;
    if (end < start) continue;

    rows.push({ bundesland: state, kind: 'school', name, startDate: start, endDate: end });
  }

  return sortRows(rows);
}

function titleCase(value: string): string {
  return value
    .split(/([\s-]+)/)
    .map((part) => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

// ---------------------------------------------------------------------------- SQL

/** Doppelte Zeilen fallen weg, die Reihenfolge ist stabil — sonst rauscht jeder Lauf durch git. */
export function sortRows(rows: readonly HolidayRow[]): HolidayRow[] {
  const seen = new Map<string, HolidayRow>();
  for (const row of rows) {
    seen.set(`${row.bundesland}|${row.kind}|${row.name}|${row.startDate}`, row);
  }

  return [...seen.values()].sort(
    (a, b) =>
      a.bundesland.localeCompare(b.bundesland) ||
      a.kind.localeCompare(b.kind) ||
      a.startDate.localeCompare(b.startDate) ||
      a.name.localeCompare(b.name),
  );
}

export interface SqlOptions {
  /** Kopfzeilen als Kommentar, z. B. welche Quelle benutzt wurde. */
  notes?: readonly string[];
}

/**
 * Die Zeilen als Migration. `ON CONFLICT DO NOTHING` macht jeden erneuten Lauf
 * folgenlos — genau das braucht ein Import, der jedes Jahr wiederholt wird.
 */
export function toSql(rows: readonly HolidayRow[], options: SqlOptions = {}): string {
  const clean = sortRows(rows);
  const head = [
    '-- Gesetzliche Feiertage und Schulferien (Aufgabe 6.2).',
    '--',
    '-- ERZEUGT von scripts/import-holidays.ts — nicht von Hand ändern.',
    '-- Einmal jährlich im Herbst neu erzeugen und die neue Datei einchecken;',
    '-- siehe docs/betrieb.md.',
    ...(options.notes ?? []).map((note) => `-- ${note}`),
    '',
  ];

  if (clean.length === 0) {
    return `${head.join('\n')}-- Keine Daten.\n`;
  }

  const values = clean
    .map(
      (row) =>
        `    ('${row.bundesland}', '${row.kind}', '${escape(row.name)}', '${row.startDate}', '${row.endDate}')`,
    )
    .join(',\n');

  return (
    `${head.join('\n')}` +
    'INSERT INTO public.holidays (bundesland, kind, name, start_date, end_date) VALUES\n' +
    `${values}\n` +
    'ON CONFLICT (bundesland, kind, name, start_date) DO NOTHING;\n'
  );
}

function escape(value: string): string {
  return value.replace(/'/g, "''");
}

// ---------------------------------------------------------------------------- Migration

/**
 * Der nächste freie Zeitstempel für eine Migration.
 *
 * Nicht einfach „jetzt": die Migrationen dieses Projekts tragen bewusst Zeitstempel,
 * die in der Zukunft liegen können. Eine neue Datei muss hinter allen bestehenden
 * einsortieren, sonst liefe sie vor der Tabelle, die sie füllt.
 */
export function nextMigrationTimestamp(existing: readonly string[], now: Date): string {
  const stamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0');

  let highest = 0;
  for (const name of existing) {
    const match = /^(\d{14})/.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  return String(Math.max(Number(stamp), highest + 1));
}
