/**
 * Die Ersatzkette als reine Funktion.
 *
 * Das ist die komplizierteste Regel der ganzen Anwendung, und zugleich die, bei der
 * Fehler am meisten kosten: Eine Anfrage zu viel verärgert jemanden, eine zu wenig
 * heißt, dass die Mannschaft zu dritt antritt. Deshalb steht hier keine Zeile
 * Datenbankzugriff — die Funktion bekommt einen Zustand und gibt eine Liste von
 * Aktionen zurück, und jede einzelne Regel lässt sich damit in Millisekunden prüfen.
 *
 * Die Regeln (Zielbild 4.2), ausformuliert:
 *
 *   Aufräumen (immer, in jedem Modus):
 *     - Eine Anfrage zu einer überholten Fassung des Spiels wird abgebrochen. Wer
 *       für Samstag zugesagt hätte, hat nicht für Sonntag zugesagt.
 *     - Eine Anfrage zu einem abgesagten oder vergangenen Spiel wird abgebrochen.
 *     - Eine abgelaufene Anfrage läuft ab.
 *     - Sind genug Spieler da, werden offene Anfragen abgebrochen.
 *
 *   Neue Anfragen (nur wenn Spieler fehlen, das Spiel läuft, die Aufstellung nicht
 *   gesperrt ist und der Modus nicht `manual` ist):
 *     - `sequential`: der nächste Ersatzspieler nach Rang, der noch nicht gefragt
 *       wurde, nicht abwesend ist und nicht schon geantwortet hat. Nur einer auf
 *       einmal — solange eine Anfrage offen ist, wartet die Kette.
 *     - `parallel`: alle in Frage kommenden gleichzeitig.
 *
 *   Ist niemand mehr übrig und es fehlen weiterhin Spieler, wird die Mannschafts-
 *   führung einmal je Fassung benachrichtigt.
 */

export type SubstituteMode = 'sequential' | 'parallel' | 'manual';
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type Response = 'none' | 'yes' | 'no' | 'unclear';

export interface EngineMatch {
  id: string;
  version: number;
  /** ISO-Zeitpunkt des Spielbeginns. */
  startsAt: string;
  active: boolean;
  requiredPlayers: number;
  lineupLocked: boolean;
}

export interface EngineTeam {
  id: string;
  substituteMode: SubstituteMode;
  manualAutoAdd: boolean;
}

export interface EngineParticipation {
  profileId: string;
  response: Response;
  versionResponded: number | null;
  lineupPosition: number | null;
  removed: boolean;
  isRegular: boolean;
}

export interface EngineCandidate {
  profileId: string;
  rank: number;
}

export interface EngineRequest {
  id: string;
  profileId: string;
  rank: number | null;
  status: RequestStatus;
  /** ISO-Zeitpunkt. */
  expiresAt: string;
  matchVersion: number;
  createdBy: 'system' | 'leader';
}

export interface EngineAbsence {
  profileId: string;
  /** „JJJJ-MM-TT". */
  startDate: string;
  endDate: string;
}

export interface EngineInput {
  now: Date;
  timeoutHours: number;
  match: EngineMatch;
  team: EngineTeam;
  participations: EngineParticipation[];
  candidates: EngineCandidate[];
  requests: EngineRequest[];
  absences: EngineAbsence[];
  /** Wurde für diese Fassung schon gemeldet, dass die Kette leer ist? */
  exhaustedNotified: boolean;
}

export type EngineAction =
  | { kind: 'expire'; requestId: string }
  | { kind: 'cancel'; requestId: string; reason: string }
  | { kind: 'request'; profileId: string; rank: number | null; expiresAt: string }
  | { kind: 'exhausted' };

/** Wie viele Spieler in der Aufstellung zugesagt haben. */
export function countConfirmed(input: EngineInput): number {
  return input.participations.filter(
    (entry) =>
      entry.response === 'yes' &&
      !entry.removed &&
      entry.lineupPosition !== null &&
      entry.lineupPosition <= input.match.requiredPlayers,
  ).length;
}

export function planSubstituteStep(input: EngineInput): EngineAction[] {
  const actions: EngineAction[] = [];
  const now = input.now.getTime();
  const starts = new Date(input.match.startsAt).getTime();

  const matchOver = !input.match.active || starts <= now;
  const staleVersion = (request: EngineRequest) => request.matchVersion !== input.match.version;

  const needed = Math.max(input.match.requiredPlayers - countConfirmed(input), 0);

  // ---------------------------------------------------------------- Aufräumen
  const stillPending: EngineRequest[] = [];

  for (const request of input.requests) {
    if (request.status !== 'pending') continue;

    if (staleVersion(request)) {
      actions.push({
        kind: 'cancel',
        requestId: request.id,
        reason: 'Der Termin hat sich geändert.',
      });
      continue;
    }

    if (matchOver) {
      actions.push({
        kind: 'cancel',
        requestId: request.id,
        reason: input.match.active ? 'Das Spiel hat begonnen.' : 'Das Spiel entfällt.',
      });
      continue;
    }

    if (new Date(request.expiresAt).getTime() <= now) {
      actions.push({ kind: 'expire', requestId: request.id });
      continue;
    }

    if (needed === 0) {
      actions.push({
        kind: 'cancel',
        requestId: request.id,
        reason: 'Es sind genug Spieler zusammen.',
      });
      continue;
    }

    stillPending.push(request);
  }

  // ---------------------------------------------------------------- Anfragen
  if (matchOver || needed === 0) return actions;
  if (input.team.substituteMode === 'manual') return actions;

  // Hat der Mannschaftsführer die Aufstellung selbst gesetzt, hört die Automatik auf.
  // Sonst würde sie gegen eine bewusste Entscheidung anarbeiten.
  if (input.match.lineupLocked) return actions;

  // Wer schon geantwortet hat oder schon gefragt wurde, kommt nicht noch einmal dran.
  const answered = new Set(
    input.participations
      .filter(
        (entry) =>
          entry.response !== 'none' && entry.versionResponded === input.match.version,
      )
      .map((entry) => entry.profileId),
  );

  const asked = new Set(
    input.requests
      .filter((request) => request.matchVersion === input.match.version)
      .map((request) => request.profileId),
  );

  const matchDay = input.match.startsAt.slice(0, 10);
  const away = new Set(
    input.absences
      .filter((absence) => absence.startDate <= matchDay && absence.endDate >= matchDay)
      .map((absence) => absence.profileId),
  );

  const available = [...input.candidates]
    .sort((a, b) => a.rank - b.rank)
    .filter(
      (candidate) =>
        !asked.has(candidate.profileId) &&
        !answered.has(candidate.profileId) &&
        !away.has(candidate.profileId),
    );

  if (available.length === 0) {
    // Erst melden, wenn auch nichts mehr offen ist — solange jemand noch antworten
    // kann, ist die Kette nicht am Ende.
    if (stillPending.length === 0 && !input.exhaustedNotified) {
      actions.push({ kind: 'exhausted' });
    }
    return actions;
  }

  const expiresAt = new Date(
    Math.min(now + input.timeoutHours * 3600_000, starts),
  ).toISOString();

  if (input.team.substituteMode === 'sequential') {
    // Einer nach dem anderen: Solange eine Anfrage offen ist, wartet die Kette.
    if (stillPending.length > 0) return actions;

    const next = available[0];
    actions.push({ kind: 'request', profileId: next.profileId, rank: next.rank, expiresAt });
    return actions;
  }

  // parallel: alle auf einmal, aber nur so viele, wie noch fehlen — plus die
  // bereits offenen. Mehr Zusagen als Plätze wären keine Hilfe, sondern Arbeit.
  const open = stillPending.length;
  for (const candidate of available.slice(0, Math.max(needed - open, 0))) {
    actions.push({
      kind: 'request',
      profileId: candidate.profileId,
      rank: candidate.rank,
      expiresAt,
    });
  }

  return actions;
}
