/**
 * Namen kürzen und vergleichen.
 *
 * Drei kleine Funktionen mit einem gemeinsamen Begriff von „Name": eine Folge von
 * Wörtern, durch Leerraum getrennt, deren letztes der Nachname ist und deren übrige
 * zusammen der Vorname sind. Das ist für deutsche Vereinsmitglieder tragfähig und für
 * alles andere eine Vereinfachung — sie steht hier ausdrücklich, damit sie nicht für
 * eine Tatsache gehalten wird.
 */

/** Ein Name, zerlegt in seine Wörter. Leerer Name → leere Liste. */
function words(name: string): string[] {
  const trimmed = name.trim();
  return trimmed === '' ? [] : trimmed.split(/\s+/);
}

/**
 * „Max Mustermann" → „Max M".
 *
 * Für Listen, die auch jemand sehen darf, der nicht den ganzen Verein kennen muss.
 * Ein Name ohne Nachnamen bleibt, wie er ist: Aus „Max" lässt sich nichts kürzen, und
 * ein leerer Rückgabewert wäre an der Anzeigestelle schlimmer als der volle Name.
 */
export function getShortName(name: string): string {
  const parts = words(name);
  if (parts.length < 2) return name;

  const initial = parts[parts.length - 1].charAt(0).toUpperCase();
  if (initial === '') return name;

  return `${parts.slice(0, -1).join(' ')} ${initial}`;
}

/**
 * Nur der Vorname.
 *
 * Für Anreden in Nachrichten. „Hallo Max" liest sich wie ein Mensch, „Hallo Max
 * Mustermann" wie ein Serienbrief.
 */
export function getFirstName(fullName: string): string {
  return words(fullName)[0] ?? '';
}

/**
 * Meinen zwei Schreibweisen dieselbe Person?
 *
 * Gebraucht beim Abgleich von Namen aus fremden Quellen (Kaderlisten, Spielberichte) mit
 * den Mitgliedern hier. Zwei Fälle gelten als Treffer:
 *
 * 1. **Gleich** — bis auf Groß-/Kleinschreibung, Leerraum und einen Schlusspunkt.
 * 2. **Abkürzung** — der erste Name endet auf einen einzelnen Buchstaben, die Wörter
 *    davor stimmen überein, und das entsprechende Wort des zweiten Namens beginnt mit
 *    diesem Buchstaben. So trifft „Max M" auf „Max Mustermann" und „Karl Heinz M." auf
 *    „Karl Heinz Müller".
 *
 * Nur der **erste** Name darf abgekürzt sein. Das ist Absicht: Sonst träfe „M M" auf
 * jeden zweiten Verein, und ein falscher Treffer ordnet eine Rückmeldung der falschen
 * Person zu — deutlich teurer als ein verpasster Treffer, den jemand von Hand nachträgt.
 */
export function isNameMatch(abbreviated: string, full: string): boolean {
  const left = abbreviated.trim().toLowerCase().replace(/\.$/, '');
  const right = full.trim().toLowerCase();

  if (left === right) return true;

  const leftParts = words(left);
  const rightParts = words(right);
  if (leftParts.length === 0 || rightParts.length === 0) return false;

  // Fall 2 greift nur, wenn das letzte Wort links wirklich eine Initiale ist.
  const initial = leftParts[leftParts.length - 1];
  if (initial.length !== 1) return false;

  // Die Wörter vor der Initiale müssen Wort für Wort übereinstimmen …
  const prefixLength = leftParts.length - 1;
  for (let index = 0; index < prefixLength; index += 1) {
    if (leftParts[index] !== rightParts[index]) return false;
  }

  // … und an der Stelle der Initiale muss rechts ein Wort stehen, das mit ihr beginnt.
  return rightParts[prefixLength]?.startsWith(initial) ?? false;
}
