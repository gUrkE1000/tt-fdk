import { formatShortDayDate, formatTime, arrivalTime, deadlineBefore } from './dates';
import { getFirstName } from './names';

/**
 * Erzeugt den Text, den der Mannschaftsführer in WhatsApp einfügt („Aufstellung teilen").
 *
 * Der TT-Planer hat dafür einen reinen Textblock mit Kopierknopf — offenbar die meistgenutzte
 * Funktion überhaupt, weil die Kommunikation ohnehin im Messenger stattfindet. Wir ergänzen
 * zwei Dinge, die dort fehlen: die Ankunftszeit und den Hinweis auf ein zeitgleiches Spiel
 * einer anderen Vereinsmannschaft.
 *
 * Bewusst ohne Datenbanktypen: die Funktion bekommt genau das, was im Text vorkommt, und
 * lässt sich damit vollständig testen.
 */

export interface LineupTextInput {
  teamName: string;
  opponent: string;
  league?: string | null;
  isHome: boolean;
  /** ISO-Zeitpunkt des Spielbeginns. */
  startsAt: string;
  /** Hallenname und Adresse, so wie sie am Termin hinterlegt sind. */
  venue?: string | null;
  /** Wie viele Spieler das Spiel braucht (Kadergröße der Mannschaft). */
  requiredPlayers: number;
  /** Namen der Zusagen in Aufstellungsreihenfolge. */
  confirmedNames: string[];
  /** Namen derer, die fahren können. */
  driverNames?: string[];
  /** Namen derer, die direkt zur Auswärtshalle fahren (nicht zum Treffpunkt). */
  directNames?: string[];
  /** Minuten vor Spielbeginn, zu denen man da sein soll. */
  arrivalMinutes: number;
  /** Standardhinweis der Mannschaft für Heim- bzw. Auswärtsspiele. */
  note?: string | null;
  /** Zeitgleiches Spiel einer anderen Mannschaft am selben Ort. */
  concurrentTeamName?: string | null;
}

function formatList(names: string[]): string {
  return names.length > 0 ? names.join(', ') : 'niemand';
}

/**
 * Vollständige Aufstellungsmeldung — für den Fall, dass genug Zusagen da sind.
 */
export function buildLineupText(input: LineupTextInput): string {
  const firstNames = input.confirmedNames.map(getFirstName).filter(Boolean);
  const starters = firstNames.slice(0, input.requiredPlayers);
  const backups = firstNames.slice(input.requiredPlayers);

  const kind = input.isHome ? 'Heimspiel' : 'Auswärtsspiel';
  const when = `${formatShortDayDate(input.startsAt)} um ${formatTime(input.startsAt)} Uhr`;
  const league = input.league ? ` | ${input.league}` : '';

  const lines: string[] = [
    '📍 Spielzusammenfassung',
    '',
    `${input.teamName} ${input.isHome ? 'zuhause' : 'auswärts'} gegen ${input.opponent}${league}`,
    `${kind} am ${when}`,
  ];

  if (input.venue) lines.push(`Spielort: ${input.venue}`);

  lines.push('', `Aufstellung: ${formatList(starters)}`);
  if (backups.length > 0) lines.push(`Ersatz: ${formatList(backups)}`);
  if (input.driverNames && input.driverNames.length > 0) {
    lines.push(`Fahrer: ${formatList(input.driverNames.map(getFirstName))}`);
  }
  if (!input.isHome && input.directNames && input.directNames.length > 0) {
    lines.push(`Fährt direkt: ${formatList(input.directNames.map(getFirstName))}`);
  }

  lines.push(
    '',
    `Bitte seid um ${arrivalTime(input.startsAt, input.arrivalMinutes)} Uhr ${
      input.isHome ? 'in der Halle' : 'am Spielort'
    }.`,
  );

  if (input.concurrentTeamName) {
    lines.push(`${input.concurrentTeamName} spielt zeitgleich am selben Ort.`);
  }

  if (input.note) lines.push('', input.note);

  return lines.join('\n');
}

/**
 * Aufruf, wenn noch Zusagen fehlen. Nennt die Zahl der fehlenden Spieler, die bisherigen
 * Zusagen und eine Frist — ohne Frist passiert erfahrungsgemäß nichts.
 */
export function buildMissingPlayersText(input: LineupTextInput): string {
  const missing = Math.max(input.requiredPlayers - input.confirmedNames.length, 0);
  const firstNames = input.confirmedNames.map(getFirstName).filter(Boolean);

  const kind = input.isHome ? 'Heimspiel' : 'Auswärtsspiel';
  const when = `${formatShortDayDate(input.startsAt)} um ${formatTime(input.startsAt)} Uhr`;
  const missingPhrase =
    missing === 1 ? 'fehlt uns noch 1 Spieler' : `fehlen uns noch ${missing} Spieler`;

  return [
    `⚠️ Für das ${kind} gegen ${input.opponent} am ${when} ${missingPhrase}.`,
    '',
    `Bisher zugesagt: ${formatList(firstNames)}`,
    `Bitte bis ${deadlineBefore(input.startsAt)} zurückmelden.`,
  ].join('\n');
}

/** Wählt automatisch die passende Vorlage. */
export function buildShareText(input: LineupTextInput): string {
  return input.confirmedNames.length >= input.requiredPlayers
    ? buildLineupText(input)
    : buildMissingPlayersText(input);
}
