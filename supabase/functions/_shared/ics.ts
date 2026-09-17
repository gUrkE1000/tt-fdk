/**
 * ICS-Parser für die Spielpläne von myTischtennis.de.
 *
 * Übernommen aus dem Basisprojekt (src/lib/icsParser.ts) und hierher verschoben, damit
 * Frontend und Edge Function dieselbe Implementierung nutzen. Keine Laufzeit-Abhängigkeit:
 * die Datei läuft unverändert in Deno und im Browser.
 */

export interface IcsEvent {
  uid: string;
  dtstart: Date;
  dtend: Date;
  summary: string;
  description: string;
  location: string;
}

/** ICS bricht lange Zeilen um und setzt die Fortsetzung mit Leerzeichen oder Tab ein. */
export function unfoldLines(icsString: string): string {
  return icsString.replace(/\r?\n[ \t]/g, '');
}

/**
 * Rechnet eine Ortszeit in einen UTC-Zeitpunkt um.
 *
 * myTischtennis liefert `DTSTART;TZID=Europe/Berlin:20260912T180000` — also Ortszeit ohne
 * Offset. Der Weg über Intl.DateTimeFormat vermeidet eine Zeitzonen-Bibliothek und ist
 * über Sommer- und Winterzeit hinweg korrekt.
 */
export function parseLocalDateToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone = 'Europe/Berlin',
): Date {
  const utcDate = new Date(Date.UTC(year, monthIndex, day, hour, minute, second));

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

  const parts = formatter.formatToParts(utcDate);
  const partVal = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  const diffMs =
    Date.UTC(
      partVal('year'),
      partVal('month') - 1,
      partVal('day'),
      partVal('hour'),
      partVal('minute'),
      partVal('second'),
    ) - Date.UTC(year, monthIndex, day, hour, minute, second);

  return new Date(utcDate.getTime() - diffMs);
}

function parseIcsDate(value: string): Date {
  const clean = value.replace(/[-:]/g, '');

  // Ganztägig: nur ein Datum
  if (/^\d{8}$/.test(clean)) {
    return parseLocalDateToUtc(
      parseInt(clean.slice(0, 4), 10),
      parseInt(clean.slice(4, 6), 10) - 1,
      parseInt(clean.slice(6, 8), 10),
      0,
      0,
      0,
    );
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(clean);
  if (!match) return new Date();

  const [, y, mo, d, h, mi, s, zulu] = match;
  const year = parseInt(y, 10);
  const monthIndex = parseInt(mo, 10) - 1;
  const day = parseInt(d, 10);
  const hour = parseInt(h, 10);
  const minute = parseInt(mi, 10);
  const second = parseInt(s, 10);

  if (zulu === 'Z') {
    return new Date(Date.UTC(year, monthIndex, day, hour, minute, second));
  }
  return parseLocalDateToUtc(year, monthIndex, day, hour, minute, second);
}

export function parseIcs(icsContent: string): IcsEvent[] {
  const unfolded = unfoldLines(icsContent);
  const events: IcsEvent[] = [];

  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let block: RegExpExecArray | null;

  while ((block = veventRegex.exec(unfolded)) !== null) {
    const fields = new Map<string, string>();

    for (const line of block[1].split(/\r?\n/)) {
      if (!line.trim()) continue;
      const colon = line.indexOf(':');
      if (colon === -1) continue;

      const rawKey = line.slice(0, colon);
      const semicolon = rawKey.indexOf(';');
      const key = (semicolon === -1 ? rawKey : rawKey.slice(0, semicolon)).toUpperCase();

      // Mehrfach vorkommende Felder: das erste gewinnt, wie im Bestand.
      if (!fields.has(key)) fields.set(key, line.slice(colon + 1).trim());
    }

    const uid = fields.get('UID') ?? '';
    const dtstartRaw = fields.get('DTSTART');
    if (!uid || !dtstartRaw) continue;

    const dtstart = parseIcsDate(dtstartRaw);
    const dtendRaw = fields.get('DTEND');
    // Ohne Ende rechnen wir mit zwei Stunden — ein Tischtennis-Spieltag dauert länger,
    // aber der Wert dient nur der Kalenderanzeige.
    const dtend = dtendRaw
      ? parseIcsDate(dtendRaw)
      : new Date(dtstart.getTime() + 2 * 60 * 60 * 1000);

    events.push({
      uid,
      dtstart,
      dtend,
      summary: fields.get('SUMMARY') ?? '',
      description: fields.get('DESCRIPTION') ?? '',
      location: (fields.get('LOCATION') ?? '').replace(/\\,/g, ','),
    });
  }

  return events;
}

/** Spieltagsnummer aus Beschreibung oder Titel, z. B. „Spieltag: 1" oder „2. Spieltag". */
export function extractMatchday(description: string, summary: string): number | null {
  const patterns = [/Spieltag:?\s*(\d+)/i, /(\d+)\.\s*Spieltag/i];

  for (const text of [description, summary]) {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}
