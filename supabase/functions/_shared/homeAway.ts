/**
 * Heim oder auswärts, aus dem Titel eines Kalendereintrags.
 *
 * Die Spielpläne von myTischtennis tragen den Titel „Heimmannschaft vs Gastmannschaft".
 * Mehr steht dort nicht — insbesondere kein Feld, das die Heimmannschaft benennt. Wer
 * wissen will, ob er fahren muss, muss also den eigenen Verein im Titel wiedererkennen.
 *
 * Woran er sich erkennt, kommt von außen herein: `club_aliases` aus den Vereinsdaten,
 * eine kommagetrennte Liste von Schreibweisen. Das ist der Unterschied zu einer
 * Vereins-App, die ihren eigenen Namen im Code stehen hat und für jeden anderen Verein
 * falsch antwortet.
 */

export interface HomeAwayInfo {
  isHome: boolean;
  opponent: string;
}

/** Was zwischen den beiden Mannschaften stehen darf: „vs", „vs.", beliebig groß. */
const SEPARATOR = /\s+vs\.?\s+/i;

/**
 * Passt dieser Mannschaftsname auf uns?
 *
 * Zwei Kriterien, in dieser Reihenfolge:
 *
 * 1. **Ein Alias steckt darin.** „TTC Musterstadt" findet sich in „TTC Musterstadt II"
 *    wieder. Das ist der Normalfall und der verlässliche.
 * 2. **Der Mannschaftsname überlappt.** Nur als Notnagel, wenn keine Aliase gepflegt
 *    sind. Beide Richtungen, weil der Verband die Mannschaft mal ausführlicher und mal
 *    knapper schreibt als wir.
 */
function matchesUs(side: string, teamName: string, clubAliases: string[]): boolean {
  const candidate = side.toLowerCase();

  for (const alias of clubAliases) {
    const normalized = alias.trim().toLowerCase();
    if (normalized !== '' && candidate.includes(normalized)) return true;
  }

  const team = teamName.trim().toLowerCase();
  if (team === '') return false;

  return candidate.includes(team) || team.includes(candidate);
}

/**
 * Der Titel, aufgeteilt in die beiden Seiten — oder `null`, wenn er dem Muster nicht
 * folgt. Ein Titel mit mehr als einem „vs" gilt als unlesbar: Bei „A vs B vs C" wäre
 * jede Aufteilung geraten.
 */
function splitSides(summary: string): { home: string; away: string } | null {
  const parts = summary.split(SEPARATOR);
  if (parts.length !== 2) return null;

  return { home: parts[0].trim(), away: parts[1].trim() };
}

export function determineHomeAway(
  summary: string,
  teamName: string,
  clubAliases: string[] = [],
): HomeAwayInfo {
  const sides = splitSides(summary);

  // Kein erkennbares Muster — etwa ein Vereinsturnier im selben Feed. Der ganze Titel
  // wird zum „Gegner", und der Termin steht als Heimspiel da. Das sieht merkwürdig aus,
  // und genau das ist der Zweck: Ein stiller Fehler wäre schlimmer als ein sichtbarer,
  // den der Mannschaftsführer am Termin korrigiert.
  if (!sides) return { isHome: true, opponent: summary };

  const homeIsUs = matchesUs(sides.home, teamName, clubAliases);
  const awayIsUs = matchesUs(sides.away, teamName, clubAliases);

  // Genau eine Seite sind wir: der eindeutige Fall.
  if (homeIsUs && !awayIsUs) return { isHome: true, opponent: sides.away };
  if (awayIsUs && !homeIsUs) return { isHome: false, opponent: sides.home };

  // Keine Seite (Aliase fehlen oder passen nicht) oder beide (zwei eigene Mannschaften
  // gegeneinander). In beiden Fällen Heimspiel annehmen und die zweite Seite als Gegner
  // führen — dieselbe Vorgabe wie oben, und dieselbe Begründung.
  return { isHome: true, opponent: sides.away };
}
