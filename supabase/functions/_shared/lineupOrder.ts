/**
 * Reihenfolge der Spieler für die Aufstellung eines Spiels.
 *
 * Im Basisprojekt gab es fünf Rückmeldezustände, darunter „Ja als Ersatz". Dieses Modell
 * kommt ohne aus: wer auf der Ersatzbank steht, ergibt sich aus der Position in der
 * Aufstellung, nicht aus einem eigenen Antwortzustand (Zielbild 4.1). Das ist einfacher
 * zu erklären und lässt sich vom Mannschaftsführer direkt umsortieren.
 */

export type Response = 'yes' | 'none' | 'unclear' | 'no';

export interface LineupCandidate {
  profileId: string;
  response: Response;
  /** Stammspieler der Mannschaft stehen vor Ersatzspielern. */
  isRegular: boolean;
  /** Vereinsweite Rangfolge: Mannschaftsnummer, dann Position. */
  teamNumber: number | null;
  positionNumber: number | null;
  name: string;
}

// Zusagen zuerst, dann wer noch nicht geantwortet hat, dann Unsichere, zuletzt Absagen.
// „Keine Antwort" vor „Vielleicht": wer gar nicht reagiert hat, ist oft noch zu gewinnen,
// während ein „unsicher" meist schon ein halbes Nein ist.
const RESPONSE_RANK: Record<Response, number> = {
  yes: 1,
  none: 2,
  unclear: 3,
  no: 4,
};

export function compareLineupCandidates(a: LineupCandidate, b: LineupCandidate): number {
  const byResponse = RESPONSE_RANK[a.response] - RESPONSE_RANK[b.response];
  if (byResponse !== 0) return byResponse;

  if (a.isRegular !== b.isRegular) return a.isRegular ? -1 : 1;

  const teamA = a.teamNumber ?? Number.MAX_SAFE_INTEGER;
  const teamB = b.teamNumber ?? Number.MAX_SAFE_INTEGER;
  if (teamA !== teamB) return teamA - teamB;

  const posA = a.positionNumber ?? Number.MAX_SAFE_INTEGER;
  const posB = b.positionNumber ?? Number.MAX_SAFE_INTEGER;
  if (posA !== posB) return posA - posB;

  return a.name.localeCompare(b.name, 'de');
}

/** Kandidaten in Aufstellungsreihenfolge. Verändert die übergebene Liste nicht. */
export function orderLineupCandidates(candidates: LineupCandidate[]): LineupCandidate[] {
  return [...candidates].sort(compareLineupCandidates);
}
