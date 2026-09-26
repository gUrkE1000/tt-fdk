/**
 * Die Zuordnungsspalten der Vereinsübersicht (Bestandsaufnahme I).
 *
 * Training, Mannschaft, Ersatz und Schlüsseldienst je Mitglied — vier Listen, die alle
 * dieselbe Form haben: „welche Objekte nennen diese Person?". Als reine Funktion,
 * weil die Tabelle sonst in jeder Zelle über alle Trainings und Mannschaften
 * iterieren würde: bei 80 Mitgliedern und 6 Mannschaften sind das fast 500
 * Durchläufe je Neuzeichnen.
 */

export interface Assignments {
  trainings: string[];
  teams: string[];
  substituteFor: string[];
  /** Feste Wochentage im Schlüsseldienst, z. B. „Montag". */
  keyDuty: string[];
}

export const NO_ASSIGNMENTS: Assignments = {
  trainings: [],
  teams: [],
  substituteFor: [],
  keyDuty: [],
};

export interface AssignmentSources {
  trainings: readonly { name: string; memberIds: readonly string[] }[];
  teams: readonly { name: string; regularIds: readonly string[]; substituteIds: readonly string[] }[];
  /** Feste Wochentage des Schlüsseldienstes. */
  keyDuty: readonly { weekday: string; profile_id: string }[];
}

export function memberAssignments(sources: AssignmentSources): Map<string, Assignments> {
  const result = new Map<string, Assignments>();

  const entry = (id: string): Assignments => {
    const existing = result.get(id);
    if (existing) return existing;
    const created: Assignments = { trainings: [], teams: [], substituteFor: [], keyDuty: [] };
    result.set(id, created);
    return created;
  };

  for (const training of sources.trainings) {
    for (const id of training.memberIds) entry(id).trainings.push(training.name);
  }

  for (const team of sources.teams) {
    for (const id of team.regularIds) entry(id).teams.push(team.name);
    for (const id of team.substituteIds) entry(id).substituteFor.push(team.name);
  }

  for (const duty of sources.keyDuty) {
    entry(duty.profile_id).keyDuty.push(duty.weekday);
  }

  return result;
}

/** „Erwachsenentraining, Jugendtraining" — oder ein Gedankenstrich. */
export function assignmentText(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : '—';
}
