import type { Participation } from './api';

/**
 * Die sechs Abschnitte des Dialogs „Spieler verwalten" (Bestandsaufnahme C).
 *
 * Reine Funktion, damit die Einteilung testbar ist, ohne eine Datenbank oder React
 * anzufassen. Die Datenbank kennt dieselbe Einteilung als `v_match_lineup_status` — hier
 * steht sie noch einmal, weil die Oberfläche sie zusammen mit den Namen und der
 * Reihenfolge braucht und ein zweiter Rundtrip dafür zu teuer wäre.
 */

export type LineupStatus = 'lineup' | 'open' | 'absent' | 'removed' | 'declined' | 'unclear';

export interface LineupSections {
  lineup: Participation[];
  open: Participation[];
  absent: Participation[];
  removed: Participation[];
  declined: Participation[];
  unclear: Participation[];
}

export interface AbsenceWindow {
  profileId: string;
  startDate: string;
  endDate: string;
}

export function statusOf(
  participation: Participation,
  matchDay: string,
  absences: AbsenceWindow[],
): LineupStatus {
  if (participation.removed) return 'removed';
  if (participation.lineup_position !== null && participation.response === 'yes') return 'lineup';
  if (participation.response === 'no') return 'declined';
  if (participation.response === 'unclear') return 'unclear';

  const away = absences.some(
    (absence) =>
      absence.profileId === participation.profile_id &&
      absence.startDate <= matchDay &&
      absence.endDate >= matchDay,
  );
  if (away) return 'absent';

  return 'open';
}

export function groupParticipations(
  participations: Participation[],
  matchDay: string,
  absences: AbsenceWindow[],
): LineupSections {
  const sections: LineupSections = {
    lineup: [],
    open: [],
    absent: [],
    removed: [],
    declined: [],
    unclear: [],
  };

  for (const participation of participations) {
    sections[statusOf(participation, matchDay, absences)].push(participation);
  }

  sections.lineup.sort((a, b) => (a.lineup_position ?? 0) - (b.lineup_position ?? 0));

  return sections;
}

/**
 * Wer am selben Tag innerhalb von drei Stunden noch ein anderes Spiel zugesagt hat.
 * Der TT-Planer nennt diesen Abschnitt „Spieler mit Spieltermin am gleichen Tag".
 */
export function findSameDayConflicts(
  participations: Participation[],
  allParticipations: Participation[],
  matchStart: string,
  matchStartsById: Record<string, string>,
  currentMatchId: string,
): string[] {
  const start = new Date(matchStart).getTime();
  const threeHours = 3 * 60 * 60 * 1000;
  const here = new Set(participations.map((entry) => entry.profile_id));

  const conflicted = new Set<string>();

  for (const entry of allParticipations) {
    if (entry.match_id === currentMatchId) continue;
    if (entry.response !== 'yes' || entry.removed) continue;
    if (!here.has(entry.profile_id)) continue;

    const otherStart = matchStartsById[entry.match_id];
    if (!otherStart) continue;

    if (Math.abs(new Date(otherStart).getTime() - start) <= threeHours) {
      conflicted.add(entry.profile_id);
    }
  }

  return [...conflicted];
}

/** Die Tooltips aus der Bestandsaufnahme, im Wortlaut der Oberfläche des TT-Planers. */
export const ACTION_HELP = {
  add: 'Fügt den Spieler beim Spiel hinzu und informiert diesen per E-Mail darüber',
  remove: 'Entfernt den Spieler vorerst beim Spiel und informiert diesen per E-Mail darüber',
  decline: 'Setzt den Spieler beim Spiel auf Absage und informiert diesen per E-Mail darüber',
  request: 'Fragt den Spieler an, ob dieser bei dem Spiel Ersatz spielen könnte',
  reset: 'Setzt den Teilnahme Status des Spielers zurück',
  deleteRequest: 'Löscht die Ersatzanfrage',
} as const;
