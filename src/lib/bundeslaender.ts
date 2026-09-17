/**
 * Die 16 Bundesländer, als Schlüssel die amtlichen Kürzel.
 *
 * Der TT-Planer hat kein solches Feld — dort wird die Region offenbar aus der Postleitzahl
 * des Ortes abgeleitet (Bestandsaufnahme, Abschnitt 6: „ungeklärt"). Wir fragen lieber
 * einmal explizit: Feiertage und Schulferien (Aufgabe 6.2) hängen daran, und eine
 * Ableitung aus der PLZ liegt bei Vereinen nahe der Landesgrenze regelmäßig daneben.
 */
export const BUNDESLAENDER: Record<string, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

export const BUNDESLAND_OPTIONS = Object.entries(BUNDESLAENDER).map(([value, label]) => ({
  value,
  label,
}));

export function bundeslandLabel(code: string | null | undefined): string {
  return code ? (BUNDESLAENDER[code] ?? code) : '';
}
