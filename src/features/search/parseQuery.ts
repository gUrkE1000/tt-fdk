import { fromBerlin, todayInBerlin } from '../../lib/dates';

/**
 * Zeitangaben in der Sucheingabe erkennen (docs/suche.md, 5.2 Stufe 4).
 *
 * „Samstag Borussia" heißt: das Spiel gegen Borussia am kommenden Samstag. Die Datenbank
 * bekommt dafür einen Zeitraum und den übrigen Text getrennt. Erkannt wird nur, was
 * eindeutig ist; alles andere bleibt Suchtext — lieber ein Treffer zu viel als ein
 * richtiger zu wenig.
 *
 * Gerechnet wird in Kalendertagen deutscher Zeit, nicht in Zeitpunkten: „morgen" ist
 * auch um 0:30 Uhr der nächste Tag in Berlin, nicht in UTC.
 */

export interface QueryRange {
  /** Beginn (einschließlich), als Zeitpunkt. */
  from: Date;
  /** Ende (ausschließlich), als Zeitpunkt. */
  to: Date;
  /** Für die Anzeige: „Sa 03.10." oder „05.10.–11.10.". */
  label: string;
}

export interface ParsedQuery {
  /** Der Suchtext ohne die erkannte Zeitangabe. */
  text: string;
  range: QueryRange | null;
}

interface Day {
  y: number;
  m: number; // 1–12
  d: number;
}

const WEEKDAYS: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonnabend: 6,
  sonntag: 7,
};

const MONTHS: Record<string, number> = {
  januar: 1,
  jaenner: 1,
  jänner: 1,
  februar: 2,
  maerz: 3,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const MONTH_LABELS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toUtc(day: Day): number {
  return Date.UTC(day.y, day.m - 1, day.d);
}

function fromUtc(ms: number): Day {
  const date = new Date(ms);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function addDays(day: Day, days: number): Day {
  return fromUtc(toUtc(day) + days * 86_400_000);
}

/** 1 = Montag … 7 = Sonntag */
function weekday(day: Day): number {
  const js = new Date(toUtc(day)).getUTCDay();
  return js === 0 ? 7 : js;
}

function iso(day: Day): string {
  return `${day.y}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')}`;
}

function short(day: Day): string {
  return `${String(day.d).padStart(2, '0')}.${String(day.m).padStart(2, '0')}.`;
}

function valid(day: Day): boolean {
  const back = fromUtc(toUtc(day));
  return back.y === day.y && back.m === day.m && back.d === day.d;
}

/** Zeitraum von `first` bis einschließlich `last`, in Berliner Tagesgrenzen. */
function range(first: Day, last: Day, label?: string): QueryRange {
  return {
    from: fromBerlin(`${iso(first)}T00:00:00`),
    to: fromBerlin(`${iso(addDays(last, 1))}T00:00:00`),
    label:
      label ??
      (toUtc(first) === toUtc(last)
        ? `${DAY_LABELS[weekday(first) - 1]} ${short(first)}`
        : `${short(first)}–${short(last)}`),
  };
}

function todayOf(now: Date): Day {
  const [y, m, d] = todayInBerlin(now).split('-').map(Number);
  return { y, m, d };
}

interface Rule {
  pattern: RegExp;
  resolve: (match: RegExpExecArray, today: Day) => QueryRange | null;
}

const WEEKDAY_NAMES = Object.keys(WEEKDAYS).join('|');
const MONTH_NAMES = Object.keys(MONTHS).join('|');
// Wortgrenzen mit Umlauten: \b kennt nur ASCII.
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';

const RULES: Rule[] = [
  // 12.10.2026 · 12.10.26 · 12.10. · 12.10
  {
    pattern: new RegExp(`${B}(\\d{1,2})\\.(\\d{1,2})\\.?(\\d{4}|\\d{2})?${E}`, 'u'),
    resolve: (match, today) => {
      const d = Number(match[1]);
      const m = Number(match[2]);
      if (match[3]) {
        const y = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
        const day = { y, m, d };
        return valid(day) ? range(day, day) : null;
      }
      // Ohne Jahr: das Vorkommen, das heute am nächsten liegt.
      const candidates = [today.y - 1, today.y, today.y + 1]
        .map((y) => ({ y, m, d }))
        .filter(valid);
      if (candidates.length === 0) return null;
      const nearest = candidates.reduce((best, day) =>
        Math.abs(toUtc(day) - toUtc(today)) < Math.abs(toUtc(best) - toUtc(today)) ? day : best,
      );
      return range(nearest, nearest);
    },
  },
  {
    pattern: new RegExp(`${B}(heute|übermorgen|uebermorgen|morgen|vorgestern|gestern)${E}`, 'u'),
    resolve: (match, today) => {
      const offset: Record<string, number> = {
        heute: 0,
        morgen: 1,
        übermorgen: 2,
        uebermorgen: 2,
        gestern: -1,
        vorgestern: -2,
      };
      const day = addDays(today, offset[match[1]]);
      return range(day, day);
    },
  },
  {
    pattern: new RegExp(
      `${B}(?:(nächstes|naechstes|kommendes|dieses)\\s+)?wochenende${E}`,
      'u',
    ),
    resolve: (match, today) => {
      const wd = weekday(today);
      const next = /^n(ä|ae)chstes$/.test(match[1] ?? '');
      // Am Wochenende selbst ist „Wochenende" das laufende, „nächstes" das folgende.
      let saturday = wd === 7 ? addDays(today, -1) : addDays(today, 6 - wd);
      if (next && wd >= 6) saturday = addDays(saturday, 7);
      const first = wd === 7 && !next ? today : saturday;
      return range(first, addDays(saturday, 1), 'Wochenende');
    },
  },
  {
    pattern: new RegExp(
      `${B}(diese|nächste|naechste|kommende|letzte|vorige|vergangene)\\s+woche${E}`,
      'u',
    ),
    resolve: (match, today) => {
      const monday = addDays(today, 1 - weekday(today));
      const shift = /^(diese)$/.test(match[1])
        ? 0
        : /^(letzte|vorige|vergangene)$/.test(match[1])
          ? -7
          : 7;
      const first = addDays(monday, shift);
      return range(first, addDays(first, 6));
    },
  },
  {
    pattern: new RegExp(
      `${B}(?:(?:am|nächsten|naechsten|kommenden|diesen|letzten|vorigen)\\s+)*(${WEEKDAY_NAMES})${E}`,
      'u',
    ),
    resolve: (match, today) => {
      const target = WEEKDAYS[match[1]];
      const past = /(letzten|vorigen)\s/.test(match[0]);
      let diff = (target - weekday(today) + 7) % 7;
      if (past) diff = diff === 0 ? -7 : diff - 7;
      const day = addDays(today, diff);
      return range(day, day);
    },
  },
  {
    pattern: new RegExp(`${B}(?:im\\s+)?(${MONTH_NAMES})(?:\\s+(\\d{4}))?${E}`, 'u'),
    resolve: (match, today) => {
      const m = MONTHS[match[1]];
      let y = match[2] ? Number(match[2]) : today.y;
      if (!match[2]) {
        // Ohne Jahr: der Monat, der heute am nächsten liegt (bis ein halbes Jahr zurück).
        const diff = m - today.m;
        if (diff > 6) y -= 1;
        else if (diff < -6) y += 1;
      }
      const first = { y, m, d: 1 };
      const last = addDays({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: 1 }, -1);
      return range(first, last, `${MONTH_LABELS[m - 1]} ${y}`);
    },
  },
];

export function parseQuery(input: string, now: Date = new Date()): ParsedQuery {
  const lower = input.toLowerCase();
  const today = todayOf(now);

  for (const rule of RULES) {
    const match = rule.pattern.exec(lower);
    if (!match) continue;
    const found = rule.resolve(match, today);
    if (!found) continue;
    const text = (input.slice(0, match.index) + ' ' + input.slice(match.index + match[0].length))
      .replace(/\s+/g, ' ')
      .trim();
    return { text, range: found };
  }

  return { text: input.trim(), range: null };
}
