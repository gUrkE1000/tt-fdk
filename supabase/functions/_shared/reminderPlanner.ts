/**
 * Wer bekommt wann welche Erinnerung — als reine Funktion.
 *
 * Erinnerungen sind der Teil, bei dem Fehler am teuersten sind: eine zu viel ist lästig,
 * eine zu wenig heißt, dass jemand nicht kommt. Beides hängt an Zeitfenstern, und
 * Zeitfenster lassen sich nur dann verlässlich prüfen, wenn man die Uhr in der Hand hat.
 * Deshalb steckt die ganze Entscheidung hier und nicht in der Edge Function.
 */

export interface ReminderMatch {
  id: string;
  /** ISO-Zeitpunkt des Spielbeginns. */
  startsAt: string;
  version: number;
  active: boolean;
}

export interface ReminderCandidate {
  matchId: string;
  profileId: string;
  /** Vorlauf dieser Person in Stunden; 0 heißt „keine Erinnerung". */
  hoursBefore: number;
  /** Steht in der Aufstellung oder gehört zum Kader ohne Absage. */
  eligible: boolean;
}

export interface SentReminder {
  matchId: string;
  profileId: string;
  matchVersion: number;
}

export interface MatchReminderInput {
  now: Date;
  matches: ReminderMatch[];
  candidates: ReminderCandidate[];
  alreadySent: SentReminder[];
}

export interface MatchReminderAction {
  matchId: string;
  profileId: string;
  matchVersion: number;
}

/**
 * Das Fangfenster: Läuft der Job einmal aus, soll die Erinnerung nachgeholt werden —
 * aber nicht beliebig spät. Sechs Stunden nach dem eigentlichen Zeitpunkt ist eine
 * Erinnerung entweder noch nützlich oder das Spiel hat längst begonnen.
 */
export const CATCH_UP_HOURS = 6;

export function planMatchReminders(input: MatchReminderInput): MatchReminderAction[] {
  const byId = new Map(input.matches.map((match) => [match.id, match]));

  const sent = new Set(
    input.alreadySent.map((entry) => key(entry.matchId, entry.profileId, entry.matchVersion)),
  );

  const actions: MatchReminderAction[] = [];

  for (const candidate of input.candidates) {
    if (!candidate.eligible) continue;
    if (candidate.hoursBefore <= 0) continue;

    const match = byId.get(candidate.matchId);
    if (!match || !match.active) continue;

    const starts = new Date(match.startsAt).getTime();
    if (Number.isNaN(starts)) continue;

    // Nach Spielbeginn ist eine Erinnerung sinnlos.
    if (starts <= input.now.getTime()) continue;

    const due = starts - candidate.hoursBefore * 3600_000;
    const now = input.now.getTime();

    if (now < due) continue;
    if (now - due > CATCH_UP_HOURS * 3600_000) continue;

    if (sent.has(key(match.id, candidate.profileId, match.version))) continue;

    actions.push({
      matchId: match.id,
      profileId: candidate.profileId,
      matchVersion: match.version,
    });
  }

  return actions;
}

// --------------------------------------------------------------------------------

export interface OpenItem {
  profileId: string;
  kind: 'match' | 'training' | 'event';
  id: string;
  startsAt: string;
  title: string;
}

export interface OpenReminderInput {
  now: Date;
  /** Uhrzeit, ab der der Sammelhinweis rausgeht, als „HH:MM" in Ortszeit. */
  sendAfter: string;
  /** Wie weit im Voraus offene Antworten zählen. */
  withinDays: number;
  openItems: OpenItem[];
  /** Wem heute schon geschrieben wurde. */
  sentToday: string[];
  /** Ortszeit-Datum von `now`, als „JJJJ-MM-TT". */
  today: string;
}

export interface OpenReminderAction {
  profileId: string;
  items: OpenItem[];
}

/**
 * Der tägliche Sammelhinweis auf offene Rückmeldungen.
 *
 * Einer statt einer je Termin: Wer fünf offene Antworten hat, bekommt eine E-Mail mit
 * fünf Zeilen, nicht fünf E-Mails. Der TT-Planer macht das genauso, und das ist auch der
 * Grund, warum seine Erinnerungen nicht nerven.
 */
export function planOpenReminders(input: OpenReminderInput): OpenReminderAction[] {
  if (!isAfterLocalTime(input.now, input.sendAfter)) return [];

  const sent = new Set(input.sentToday);
  const horizon = input.now.getTime() + input.withinDays * 24 * 3600_000;

  const byProfile = new Map<string, OpenItem[]>();

  for (const item of input.openItems) {
    if (sent.has(item.profileId)) continue;

    const starts = new Date(item.startsAt).getTime();
    if (Number.isNaN(starts)) continue;
    if (starts <= input.now.getTime()) continue;
    if (starts > horizon) continue;

    const list = byProfile.get(item.profileId) ?? [];
    list.push(item);
    byProfile.set(item.profileId, list);
  }

  return [...byProfile.entries()]
    .map(([profileId, items]) => ({
      profileId,
      items: items.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    }))
    .sort((a, b) => a.profileId.localeCompare(b.profileId));
}

/** „Mo 05.10. um 19:00 — 1. Herren gegen TTC Nachbarstadt" je Zeile. */
export function formatOpenItems(items: OpenItem[], timeZone = 'Europe/Berlin'): string {
  return items
    .map((item) => {
      const when = new Intl.DateTimeFormat('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).format(new Date(item.startsAt));
      return `• ${when} Uhr — ${item.title}`;
    })
    .join('\n');
}

function key(matchId: string, profileId: string, version: number): string {
  return `${matchId}|${profileId}|${version}`;
}

function isAfterLocalTime(now: Date, hhmm: string, timeZone = 'Europe/Berlin'): boolean {
  const [hour, minute] = hhmm.split(':').map(Number);
  if (Number.isNaN(hour)) return true;

  const parts = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(now);

  const nowHour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const nowMinute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return nowHour * 60 + nowMinute >= hour * 60 + (minute || 0);
}
