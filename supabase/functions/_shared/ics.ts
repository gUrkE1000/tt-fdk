/**
 * iCalendar lesen und schreiben (RFC 5545), so weit dieses Projekt es braucht.
 *
 * Zwei Richtungen, eine Datei, weil sie dasselbe Format von zwei Seiten betrachten:
 *
 * - **Lesen** — die Spielpläne, die myTischtennis je Mannschaft als Abo anbietet. Sie
 *   sind der einzige Weg, auf dem Termine aus click-TT hierher kommen.
 * - **Schreiben** — der Kalender, den jedes Mitglied in seinem eigenen Kalenderprogramm
 *   abonnieren kann.
 *
 * Bewusst ohne Bibliothek: Die Datei läuft unverändert in Deno und im Browser, und der
 * Ausschnitt des Standards, um den es geht, ist kleiner als jede Abhängigkeit, die ihn
 * abdecken würde.
 */

// ============================================================================= Lesen

export interface IcsEvent {
  uid: string;
  dtstart: Date;
  dtend: Date;
  summary: string;
  description: string;
  location: string;
}

/** Ohne DTEND: So lang gilt ein Termin. Nur für die Anzeige im Kalender. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** Die Zeitzone, in der Spielpläne deutscher Verbände Ortszeiten meinen. */
const DEFAULT_TIME_ZONE = 'Europe/Berlin';

/**
 * Zeilenfortsetzungen auflösen.
 *
 * RFC 5545 bricht Zeilen über 75 Oktett um und rückt die Fortsetzung um genau ein
 * Leerzeichen oder einen Tabulator ein. Dieses eine Zeichen gehört nicht zum Inhalt —
 * weg damit, und die Zeile ist wieder eine.
 */
export function unfoldLines(icsString: string): string {
  return icsString.replace(/\r?\n[ \t]/g, '');
}

/**
 * Eine Ortszeit als UTC-Zeitpunkt.
 *
 * `DTSTART;TZID=Europe/Berlin:20260912T180000` nennt eine Wanduhrzeit ohne Offset. Ob
 * davon eine oder zwei Stunden abzuziehen sind, weiß nur die Zeitzonendatenbank.
 *
 * Der Weg dorthin ohne Bibliothek: Die Wanduhrzeit **so tun lassen**, als wäre sie UTC,
 * diesen Zeitpunkt in der Zielzone anzeigen und die Abweichung messen. Was die Anzeige
 * zu viel hat, hatte der angenommene Zeitpunkt zu wenig — also abziehen.
 *
 * Das ist über Sommer- und Winterzeit hinweg richtig, weil `Intl` die Umstellungsdaten
 * kennt und wir sie nicht nachbauen.
 */
export function parseLocalDateToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone = DEFAULT_TIME_ZONE,
): Date {
  const wallClock = Date.UTC(year, monthIndex, day, hour, minute, second);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = new Map<string, string>(
    formatter.formatToParts(new Date(wallClock)).map((part) => [part.type, part.value]),
  );
  const part = (type: string) => Number.parseInt(parts.get(type) ?? '0', 10);

  // `hour` kann in manchen Umgebungen als „24" für Mitternacht herauskommen.
  const shown = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour') % 24,
    part('minute'),
    part('second'),
  );

  return new Date(wallClock - (shown - wallClock));
}

/**
 * Ein Datums- oder Zeitwert aus einer ICS-Zeile, oder `null`, wenn er keinem der drei
 * erlaubten Muster folgt.
 *
 * `null` statt eines Ersatzdatums: Ein Termin mit erfundenem Zeitpunkt sähe wie ein
 * echter aus und stünde bei jemandem im Kalender. Ein übergangener Termin fehlt sichtbar.
 */
function parseIcsDate(value: string): Date | null {
  const digits = value.trim().replace(/[-:]/g, '');

  // Ganztägig — `VALUE=DATE:20261005`.
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(digits);
  if (dateOnly) {
    const [, year, month, day] = dateOnly.map(Number);
    return parseLocalDateToUtc(year, month - 1, day, 0, 0, 0);
  }

  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(digits);
  if (!dateTime) return null;

  const [, year, month, day, hour, minute, second] = dateTime.map(Number);
  const isUtc = dateTime[7] === 'Z';

  return isUtc
    ? new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    : parseLocalDateToUtc(year, month - 1, day, hour, minute, second);
}

/**
 * Die Eigenschaften eines VEVENT-Blocks als Zuordnung Name → Wert.
 *
 * Eine Inhaltszeile heißt `NAME;PARAM=WERT:Inhalt`. Uns interessiert nur der Name —
 * `TZID` wird nicht ausgewertet, weil die Feeds, um die es geht, ausschließlich
 * Ortszeit in Europe/Berlin oder UTC liefern. Steht eine Eigenschaft mehrfach da,
 * gewinnt die erste.
 */
function readProperties(block: string): Map<string, string> {
  const properties = new Map<string, string>();

  for (const line of block.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const nameAndParams = line.slice(0, colon);
    const semicolon = nameAndParams.indexOf(';');
    const name = (semicolon === -1 ? nameAndParams : nameAndParams.slice(0, semicolon))
      .trim()
      .toUpperCase();

    if (name !== '' && !properties.has(name)) {
      properties.set(name, line.slice(colon + 1).trim());
    }
  }

  return properties;
}

/** Gegenstück zu `escapeIcsText`: die Maskierungen des Standards zurücknehmen. */
function unescapeIcsText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, character: string) =>
    character === 'n' || character === 'N' ? '\n' : character,
  );
}

/**
 * Alle Termine eines Kalenders.
 *
 * Übergangen wird ein Block, dem UID oder DTSTART fehlt oder dessen DTSTART unlesbar
 * ist. Das ist die einzige Fehlerbehandlung hier — und sie genügt, weil der Abgleich
 * eine eigene Sicherung hat: Kommen null Termine zurück, während Spiele aktiv sind,
 * wird nichts stillgelegt (`planSync`).
 */
export function parseIcs(icsContent: string): IcsEvent[] {
  const unfolded = unfoldLines(icsContent);
  const events: IcsEvent[] = [];

  const blocks = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let block: RegExpExecArray | null;

  while ((block = blocks.exec(unfolded)) !== null) {
    const properties = readProperties(block[1]);

    const uid = properties.get('UID') ?? '';
    const startRaw = properties.get('DTSTART');
    if (uid === '' || startRaw === undefined) continue;

    const dtstart = parseIcsDate(startRaw);
    if (!dtstart) continue;

    const endRaw = properties.get('DTEND');
    const parsedEnd = endRaw === undefined ? null : parseIcsDate(endRaw);
    const dtend = parsedEnd ?? new Date(dtstart.getTime() + DEFAULT_DURATION_MS);

    events.push({
      uid,
      dtstart,
      dtend,
      summary: unescapeIcsText(properties.get('SUMMARY') ?? ''),
      description: unescapeIcsText(properties.get('DESCRIPTION') ?? ''),
      location: unescapeIcsText(properties.get('LOCATION') ?? ''),
    });
  }

  return events;
}

/**
 * Die Spieltagsnummer, wenn eine im Text steht.
 *
 * Die Verbände schreiben sie unterschiedlich: „Spieltag: 5", „Spieltag 5" oder
 * „5. Spieltag". Gesucht wird erst in der Beschreibung, dann im Titel — die Beschreibung
 * ist das Feld, in das der Verband sie absichtlich schreibt, der Titel das, in dem sie
 * zufällig auftaucht.
 */
export function extractMatchday(description: string, summary: string): number | null {
  const patterns = [/Spieltag:?\s*(\d+)/i, /(\d+)\.\s*Spieltag/i];

  for (const text of [description, summary]) {
    for (const pattern of patterns) {
      const found = pattern.exec(text);
      if (found) return Number.parseInt(found[1], 10);
    }
  }

  return null;
}

// ========================================================================== Schreiben

export interface IcsEntry {
  /** Stabil über Läufe hinweg: dasselbe Objekt behält denselben Eintrag im Kalender. */
  uid: string;
  title: string;
  /** ISO-Zeitpunkt. */
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
  /**
   * Ganztägig (Hallensperre): `startsAt`/`endsAt` sind Mitternacht deutscher Zeit, das
   * Ende ausschließlich. Geschrieben wird dann ein reines Datum, sonst zeigte ein
   * Kalender in einer anderen Zeitzone den Tag verschoben an.
   */
  allDay?: boolean;
  /** Abgesagt: bleibt im Kalender, aber als STATUS:CANCELLED. */
  cancelled?: boolean;
}

/**
 * Ein Kalender zum Abonnieren.
 *
 * Kein Baukasten, sondern genau das, was ein Abo braucht: Kopf, alle Zeiten in UTC, je
 * Termin ein VEVENT mit stabiler UID.
 *
 * **Die UID ist der Punkt, an dem so etwas scheitert.** Ändert sie sich zwischen zwei
 * Abrufen, legt jedes Kalenderprogramm den Termin ein zweites Mal an, statt den
 * vorhandenen zu aktualisieren. Wer sie aus einem Zeitstempel oder einem Zähler bildet,
 * merkt das erst, wenn ein Mitglied denselben Spieltag viermal im Kalender hat.
 */
export function buildIcs(
  entries: readonly IcsEntry[],
  options: { calendarName: string; now?: Date } = { calendarName: 'Verein' },
): string {
  const stamp = formatIcsDate(options.now ?? new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vereinsplaner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const entry of entries) {
    const start = new Date(entry.startsAt);
    // Ein Termin ohne brauchbaren Zeitpunkt wird übergangen. Ein Kalender, der wegen
    // einer krummen Zeile gar nicht lädt, wäre der teurere Fehler.
    if (Number.isNaN(start.getTime())) continue;

    const declaredEnd = entry.endsAt ? new Date(entry.endsAt) : null;
    const endIsUsable =
      declaredEnd !== null && !Number.isNaN(declaredEnd.getTime()) && declaredEnd > start;

    lines.push('BEGIN:VEVENT', `UID:${entry.uid}`, `DTSTAMP:${stamp}`);

    if (entry.allDay) {
      const firstDay = berlinDate(start);
      const lastDayExclusive = endIsUsable ? berlinDate(declaredEnd as Date) : '';
      lines.push(
        `DTSTART;VALUE=DATE:${firstDay}`,
        `DTEND;VALUE=DATE:${
          lastDayExclusive > firstDay ? lastDayExclusive : nextIcsDay(firstDay)
        }`,
      );
    } else {
      const end = endIsUsable
        ? (declaredEnd as Date)
        : new Date(start.getTime() + DEFAULT_DURATION_MS);
      lines.push(`DTSTART:${formatIcsDate(start)}`, `DTEND:${formatIcsDate(end)}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(entry.title)}`);
    if (entry.cancelled) lines.push('STATUS:CANCELLED');

    if (entry.location) lines.push(`LOCATION:${escapeIcsText(entry.location)}`);
    if (entry.description) lines.push(`DESCRIPTION:${escapeIcsText(entry.description)}`);

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // CRLF, und auch die letzte Zeile bekommt einen. Manche Kalenderprogramme sind da
  // streng und zeigen sonst gar nichts an.
  return `${lines.flatMap(foldIcsLine).join('\r\n')}\r\n`;
}

/** `20261005` — der Kalendertag in deutscher Zeit. */
export function berlinDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })
    .format(value)
    .replace(/-/g, '');
}

/** Der Folgetag eines `YYYYMMDD`. */
function nextIcsDay(day: string): string {
  const date = new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** `20261005T170000Z` — UTC, ohne Trennzeichen, ohne Millisekunden. */
export function formatIcsDate(value: Date): string {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Maskiert die vier Zeichen, die in einem ICS-Wert eine eigene Bedeutung haben.
 *
 * Der Backslash zuerst — sonst maskiert der nächste Schritt die Backslashes, die dieser
 * Schritt gerade erst eingefügt hat, und aus einem Komma wird `\\,`.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Wie viele Oktett ein Zeichen in UTF-8 belegt. */
function utf8Length(character: string): number {
  const code = character.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

/**
 * Eine zu lange Zeile in Fortsetzungszeilen zerlegen.
 *
 * Der Standard zählt **Oktett**, nicht Zeichen. Wer Zeichen zählt, baut Zeilen, die mit
 * Umlauten über die Grenze gehen — ein Fehler, der im Test mit englischen Namen nie
 * auftritt und im Verein mit „Sporthalle Königsmühle" sofort.
 *
 * Die Fortsetzung beginnt mit einem Leerzeichen, das selbst ein Oktett belegt; deshalb
 * haben Folgezeilen nur 74 Oktett Inhalt. Ein Zeichen wird nie zerschnitten.
 */
function foldIcsLine(line: string): string[] {
  const characters = [...line];
  const folded: string[] = [];

  let current = '';
  let octets = 0;
  let limit = 75;

  for (const character of characters) {
    const size = utf8Length(character);

    if (octets + size > limit) {
      folded.push(current);
      current = ' ';
      octets = 1;
      limit = 75;
    }

    current += character;
    octets += size;
  }

  folded.push(current);
  return folded;
}
