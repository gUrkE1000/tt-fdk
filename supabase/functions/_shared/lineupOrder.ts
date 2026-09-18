/**
 * In welcher Reihenfolge die Spieler eines Spiels vorgeschlagen werden.
 *
 * Das Ergebnis ist ein **Vorschlag**, keine Aufstellung. Der Mannschaftsführer sortiert
 * um; diese Reihenfolge bestimmt nur, was er vorfindet, wenn er den Dialog öffnet. Sie
 * soll ihm die Arbeit abnehmen, nicht die Entscheidung.
 *
 * Wer auf der Ersatzbank sitzt, ergibt sich aus der Position in der fertigen Aufstellung
 * und nicht aus einem eigenen Antwortzustand (Zielbild 4.1). Deshalb gibt es hier vier
 * Rückmeldungen und kein „Ja als Ersatz".
 */

export type Response = 'yes' | 'none' | 'unclear' | 'no';

export interface LineupCandidate {
  profileId: string;
  response: Response;
  /** Stammspieler dieser Mannschaft. Ersatzspieler stehen dahinter. */
  isRegular: boolean;
  /** Vereinsweite Rangfolge: erst die Mannschaftsnummer, dann die Position darin. */
  teamNumber: number | null;
  positionNumber: number | null;
  name: string;
}

/**
 * Die vier Rückmeldungen als Reihenfolge.
 *
 * „Keine Antwort" steht **vor** „unsicher", und das ist die einzige Entscheidung hier,
 * die einer Begründung bedarf: Wer gar nicht reagiert hat, hat die Frage meist nur nicht
 * gesehen und ist mit einem Anruf zu gewinnen. Wer „unsicher" angekreuzt hat, hat sie
 * gesehen und sich nicht festgelegt — das ist in der Praxis ein halbes Nein.
 */
const RESPONSE_ORDER: readonly Response[] = ['yes', 'none', 'unclear', 'no'];

/** Fehlende Nummern sortieren hinter jede vorhandene, statt als 0 nach vorn zu rutschen. */
const LAST = Number.MAX_SAFE_INTEGER;

/**
 * Die Sortierschlüssel eines Kandidaten, vom wichtigsten zum unwichtigsten.
 *
 * Die Reihenfolge als Liste statt als Kette von `if`-Zweigen: So steht die fachliche
 * Rangfolge an einer Stelle und lesbar da, und der Vergleich darunter ist nur noch
 * Mechanik.
 */
function sortKeys(candidate: LineupCandidate): number[] {
  return [
    RESPONSE_ORDER.indexOf(candidate.response),
    // false < true wäre die falsche Richtung — Stammspieler sollen nach vorn.
    candidate.isRegular ? 0 : 1,
    candidate.teamNumber ?? LAST,
    candidate.positionNumber ?? LAST,
  ];
}

export function compareLineupCandidates(a: LineupCandidate, b: LineupCandidate): number {
  const left = sortKeys(a);
  const right = sortKeys(b);

  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }

  // Gleichstand bis hierher: nach Namen, damit die Liste bei jedem Aufruf gleich
  // aussieht. Eine Reihenfolge, die sich beim Neuladen ändert, kostet den
  // Mannschaftsführer mehr Zeit als jede Fehlsortierung.
  return a.name.localeCompare(b.name, 'de');
}

/** Kandidaten in Vorschlagsreihenfolge. Die übergebene Liste bleibt unverändert. */
export function orderLineupCandidates(candidates: LineupCandidate[]): LineupCandidate[] {
  return [...candidates].sort(compareLineupCandidates);
}
