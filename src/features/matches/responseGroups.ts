import type { MatchRow, Participation } from './api';

export interface ResponseGroups {
  yes: string[];
  unclear: string[];
  no: string[];
  /** Keine Antwort — oder eine Antwort auf eine ältere Fassung des Termins. */
  open: string[];
}

/**
 * Wer hat zu-, ab- oder noch gar nicht geantwortet?
 *
 * Für Spieler, die überlegen einzuspringen, ist das die wichtigste Auskunft an einer
 * Spielkarte — die Aufstellung allein sagt nicht, wer fehlt. „Vorerst entfernt" zählt
 * nicht mit: Der Mannschaftsführer hat die Person bewusst herausgenommen.
 */
export function groupResponses(
  match: Pick<MatchRow, 'version'>,
  participations: Participation[],
  nameOf: (profileId: string) => string,
): ResponseGroups {
  const groups: ResponseGroups = { yes: [], unclear: [], no: [], open: [] };

  for (const entry of participations) {
    if (entry.removed) continue;
    const name = nameOf(entry.profile_id) || 'Unbekannt';
    const current = (entry.version_responded ?? 0) >= (match.version ?? 1);

    if (entry.response === 'none' || !current) groups.open.push(name);
    else if (entry.response === 'yes') groups.yes.push(name);
    else if (entry.response === 'unclear') groups.unclear.push(name);
    else groups.no.push(name);
  }

  const byName = (a: string, b: string) => a.localeCompare(b, 'de');
  groups.yes.sort(byName);
  groups.unclear.sort(byName);
  groups.no.sort(byName);
  groups.open.sort(byName);
  return groups;
}
