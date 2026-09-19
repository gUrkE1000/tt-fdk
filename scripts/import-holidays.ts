#!/usr/bin/env node
// Lädt gesetzliche Feiertage und Schulferien für alle sechzehn Bundesländer und
// schreibt daraus eine Migration.
//
//   npm run import:holidays              aktuelles Jahr und die zwei folgenden
//   npm run import:holidays -- 2027 2029 ein anderer Bereich
//   npm run import:holidays -- --offline gesetzliche Feiertage rechnen, kein Netz
//
// Warum eine Migration und keine Seed-Datei: Seed-Daten laufen nur lokal. Feiertage
// müssen aber auch in der Produktionsdatenbank stehen, sonst plant der Verein dort
// Training an Karfreitag. Eine Migration erreicht beides, und `ON CONFLICT DO NOTHING`
// macht sie beliebig oft wiederholbar.
//
// Einmal im Jahr ausführen und die erzeugte Datei einchecken (docs/betrieb.md).

import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUNDESLAENDER,
  nextMigrationTimestamp,
  parsePublicHolidaysApi,
  parseSchoolHolidays,
  publicHolidays,
  toSql,
  type HolidayRow,
} from './holidays.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

const FEIERTAGE_API = 'https://feiertage-api.de/api/';
const FERIEN_API = 'https://ferien-api.de/api/v1/holidays';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const offline = args.includes('--offline');
  const years = yearsFrom(args.filter((arg) => !arg.startsWith('--')));

  const rows: HolidayRow[] = [];
  const notes: string[] = [`Jahre ${years[0]}–${years[years.length - 1]}.`];

  // --- Gesetzliche Feiertage ------------------------------------------------
  let computed = offline;
  for (const year of years) {
    if (!computed) {
      const payload = await fetchJson(`${FEIERTAGE_API}?jahr=${year}`);
      if (payload !== null) {
        const parsed = parsePublicHolidaysApi(payload);
        if (parsed.length > 0) {
          rows.push(...parsed);
          log(`Feiertage ${year}: ${parsed.length} Zeilen von feiertage-api.de`);
          continue;
        }
      }
      // Ein Ausfall der Schnittstelle darf den Import nicht aufhalten: die
      // gesetzlichen Feiertage stehen fest und lassen sich rechnen.
      computed = true;
      log('feiertage-api.de nicht erreichbar — die Feiertage werden gerechnet');
    }

    const local = publicHolidays(year);
    rows.push(...local);
    log(`Feiertage ${year}: ${local.length} Zeilen gerechnet`);
  }
  notes.push(
    computed
      ? 'Gesetzliche Feiertage gerechnet (feiertage-api.de war nicht erreichbar oder --offline).'
      : 'Gesetzliche Feiertage von feiertage-api.de.',
  );

  // --- Schulferien ----------------------------------------------------------
  let school = 0;
  let schoolFailed = false;
  if (!offline) {
    for (const state of BUNDESLAENDER) {
      for (const year of years) {
        const payload = await fetchJson(`${FERIEN_API}/${state}/${year}`);
        if (payload === null) {
          schoolFailed = true;
          continue;
        }
        const parsed = parseSchoolHolidays(payload, state);
        rows.push(...parsed);
        school += parsed.length;
      }
    }
  }

  if (offline || schoolFailed) {
    notes.push(
      'OHNE Schulferien: ferien-api.de war nicht erreichbar. Diese Datei später mit' +
        ' Netzzugang neu erzeugen, wenn Trainings „Schulferien überspringen" nutzen sollen.',
    );
    warn('Schulferien fehlen — ferien-api.de war nicht erreichbar.');
  } else {
    log(`Schulferien: ${school} Zeilen von ferien-api.de`);
  }

  // --- Schreiben ------------------------------------------------------------
  const existing = await readdir(MIGRATIONS);
  const stamp = nextMigrationTimestamp(existing, new Date());
  const name = `${stamp}_holidays_${years[0]}_${years[years.length - 1]}.sql`;
  const target = join(MIGRATIONS, name);

  await writeFile(target, toSql(rows, { notes }), 'utf8');
  log(`Geschrieben: supabase/migrations/${name}`);
}

function yearsFrom(args: readonly string[]): number[] {
  const current = new Date().getUTCFullYear();
  const from = args.length > 0 ? Number(args[0]) : current;
  const to = args.length > 1 ? Number(args[1]) : from + 2;

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 2000 || to < from) {
    throw new Error(`Unbrauchbarer Jahresbereich: ${args.join(' ')}`);
  }

  const years: number[] = [];
  for (let year = from; year <= to; year += 1) years.push(year);
  return years;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wie lange zwischen zwei Abfragen gewartet wird.
 *
 * Die Schulferien brauchen 16 Bundesländer × 3 Jahre = 48 Abfragen. Ohne Pause laufen die
 * innerhalb einer Sekunde los, und `ferien-api.de` antwortet ab der zweiten mit HTTP 429 —
 * „zu viele Anfragen". Das Ergebnis ist eine Datei ohne eine einzige Ferienzeile, erzeugt
 * ohne Fehlerabbruch.
 *
 * Eine halbe Sekunde Abstand macht aus einem gescheiterten Lauf einen, der eine halbe
 * Minute dauert. Das ist einmal im Jahr.
 */
const REQUEST_DELAY_MS = 500;

/** Wie oft eine gedrosselte Abfrage wiederholt wird, mit wachsender Wartezeit. */
const MAX_RETRIES = 4;

let lastRequestAt = 0;

async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    // Abstand zur vorherigen Abfrage einhalten, egal an welche Schnittstelle sie ging.
    const waited = Date.now() - lastRequestAt;
    if (waited < REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS - waited);
    lastRequestAt = Date.now();

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });

      // 429 ist kein Fehler der Anfrage, sondern eine Bitte um Geduld. Die Wartezeit
      // verdoppelt sich mit jedem Versuch: 1s, 2s, 4s, 8s.
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const pause = 1000 * 2 ** attempt;
        warn(`${url}: HTTP 429 — warte ${pause / 1000}s (Versuch ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(pause);
        continue;
      }

      if (!response.ok) {
        warn(`${url}: HTTP ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      warn(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  warn(`${url}: nach ${MAX_RETRIES} Versuchen weiterhin gedrosselt — aufgegeben.`);
  return null;
}

function log(message: string): void {
  process.stderr.write(`→ ${message}\n`);
}

function warn(message: string): void {
  process.stderr.write(`! ${message}\n`);
}

await main();
