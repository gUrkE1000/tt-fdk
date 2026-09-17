export interface IcsEvent {
  uid: string;
  dtstart: Date;
  dtend: Date;
  summary: string;
  description: string;
  location: string;
}

export function unfoldLines(icsString: string): string {
  return icsString.replace(/\r?\n[ \t]/g, '');
}

export function parseLocalDateToUtc(
  year: number,
  monthIndex: number, // 0-indexed
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string = 'Europe/Berlin'
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
  const partVal = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  const formattedYear = partVal('year');
  const formattedMonth = partVal('month') - 1;
  const formattedDay = partVal('day');
  const formattedHour = partVal('hour');
  const formattedMinute = partVal('minute');
  const formattedSecond = partVal('second');

  const diffMs =
    Date.UTC(formattedYear, formattedMonth, formattedDay, formattedHour, formattedMinute, formattedSecond) -
    Date.UTC(year, monthIndex, day, hour, minute, second);

  return new Date(utcDate.getTime() - diffMs);
}

function parseIcsDate(value: string, params: string): Date {
  const cleanValue = value.replace(/[-:]/g, '');

  if (/^\d{8}$/.test(cleanValue)) {
    const year = parseInt(cleanValue.substring(0, 4), 10);
    const month = parseInt(cleanValue.substring(4, 6), 10) - 1;
    const day = parseInt(cleanValue.substring(6, 8), 10);
    return parseLocalDateToUtc(year, month, day, 0, 0, 0);
  }

  const dtMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(cleanValue);
  if (!dtMatch) {
    return new Date();
  }

  const year = parseInt(dtMatch[1], 10);
  const month = parseInt(dtMatch[2], 10) - 1;
  const day = parseInt(dtMatch[3], 10);
  const hour = parseInt(dtMatch[4], 10);
  const minute = parseInt(dtMatch[5], 10);
  const second = parseInt(dtMatch[6], 10);
  const isUtc = dtMatch[7] === 'Z';

  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  return parseLocalDateToUtc(year, month, day, hour, minute, second, 'Europe/Berlin');
}

export function parseIcs(icsContent: string): IcsEvent[] {
  const unfolded = unfoldLines(icsContent);
  const events: IcsEvent[] = [];

  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = veventRegex.exec(unfolded)) !== null) {
    const block = match[1];
    const lines = block.split(/\r?\n/);
    const rawLines: { key: string; params: string; val: string }[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const rawKeyPart = line.substring(0, colonIdx);
      const val = line.substring(colonIdx + 1).trim();

      let key = rawKeyPart;
      let params = '';
      const semiIdx = rawKeyPart.indexOf(';');
      if (semiIdx !== -1) {
        key = rawKeyPart.substring(0, semiIdx);
        params = rawKeyPart.substring(semiIdx + 1);
      }

      rawLines.push({ key: key.toUpperCase(), params, val });
    }

    const uid = rawLines.find(r => r.key === 'UID')?.val || '';
    const summary = rawLines.find(r => r.key === 'SUMMARY')?.val || '';
    const description = rawLines.find(r => r.key === 'DESCRIPTION')?.val || '';
    const location = rawLines.find(r => r.key === 'LOCATION')?.val || '';

    const dtstartRaw = rawLines.find(r => r.key === 'DTSTART');
    const dtendRaw = rawLines.find(r => r.key === 'DTEND');

    if (!uid || !dtstartRaw) {
      continue;
    }

    const dtstart = parseIcsDate(dtstartRaw.val, dtstartRaw.params);
    const dtend = dtendRaw ? parseIcsDate(dtendRaw.val, dtendRaw.params) : new Date(dtstart.getTime() + 2 * 60 * 60 * 1000);

    events.push({
      uid,
      dtstart,
      dtend,
      summary,
      description,
      location: location.replace(/\\,/g, ','),
    });
  }

  return events;
}

export function extractMatchday(description: string, summary: string): number | null {
  const match =
    /Spieltag:?\s*(\d+)/i.exec(description) ||
    /Spieltag:?\s*(\d+)/i.exec(summary) ||
    /(\d+)\.\s*Spieltag/i.exec(description) ||
    /(\d+)\.\s*Spieltag/i.exec(summary);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

export interface HomeAwayInfo {
  isHome: boolean;
  opponent: string;
}

export function determineHomeAway(summary: string, teamName: string, teamShortName: string): HomeAwayInfo {
  const normalizedSummary = summary.replace(/\s+vs\.?\s+/gi, ' vs ');
  const vsParts = normalizedSummary.split(' vs ');

  if (vsParts.length === 2) {
    const homeCandidate = vsParts[0].trim();
    const awayCandidate = vsParts[1].trim();

    const isOurTeam = (candidate: string) => {
      const lower = candidate.toLowerCase();
      // Check if it contains "heiligenhaus" or "heiligenhauser" (case-insensitive)
      if (lower.includes('heiligenhaus') || lower.includes('heiligenhauser')) {
        return true;
      }
      // Or if it matches teamName / teamShortName
      if (
        lower.includes(teamName.toLowerCase()) ||
        lower.includes(teamShortName.toLowerCase()) ||
        teamName.toLowerCase().includes(lower) ||
        teamShortName.toLowerCase().includes(lower)
      ) {
        return true;
      }
      return false;
    };

    const isHomeOur = isOurTeam(homeCandidate);
    const isAwayOur = isOurTeam(awayCandidate);

    if (isHomeOur && !isAwayOur) {
      return { isHome: true, opponent: awayCandidate };
    } else if (isAwayOur && !isHomeOur) {
      return { isHome: false, opponent: homeCandidate };
    } else {
      return { isHome: true, opponent: awayCandidate };
    }
  }

  return { isHome: true, opponent: summary };
}
