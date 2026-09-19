/**
 * Plant, was ein Kalenderabgleich an der Datenbank ändern muss — ohne selbst zu schreiben.
 *
 * Die Trennung ist Absicht: das Zusammenspiel aus Neuanlage, Verlegung, Absage und
 * Sicherheitssperre ist der heikelste Teil des Imports und lässt sich so vollständig
 * testen, ohne eine Datenbank anzufassen. Die Edge Function führt die Aktionen nur aus.
 */

import type { IcsEvent } from './ics.ts';

export interface ExistingMatch {
  id: string;
  external_uid: string;
  dtstart: string;
  dtend: string;
  summary: string;
  description: string | null;
  location_text: string | null;
  opponent: string;
  is_home: boolean;
  matchday: number | null;
  active: boolean;
  version: number;
  /** Gesetzt, wenn eine bestätigte Spielverlegung vorliegt, die click-TT noch nicht kennt. */
  dtstart_override: string | null;
}

export interface PlannedMatch {
  external_uid: string;
  summary: string;
  description: string;
  location_text: string;
  dtstart: string;
  dtend: string;
  is_home: boolean;
  opponent: string;
  matchday: number | null;
}

export type SyncAction =
  | { kind: 'insert'; match: PlannedMatch }
  | { kind: 'reschedule'; id: string; match: PlannedMatch; fromDtstart: string; newVersion: number }
  | { kind: 'update_details'; id: string; match: PlannedMatch }
  | { kind: 'clear_override'; id: string; uid: string }
  | { kind: 'touch'; id: string; uid: string }
  | { kind: 'deactivate'; id: string };

export interface SyncPlan {
  actions: SyncAction[];
  status: 'success' | 'warning';
  /** Gesetzt, wenn die Sicherheitssperre gegriffen hat. */
  warning?: string;
}

export interface SyncPlanInput {
  existing: ExistingMatch[];
  events: IcsEvent[];
  /** Liefert Heim/Auswärts und Gegner zu einem Titel. */
  resolve: (event: IcsEvent) => { isHome: boolean; opponent: string; matchday: number | null };
}

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

/**
 * Der Zweitschlüssel: Seite und Gegner.
 *
 * Gebraucht wird er, weil sich die UID nicht auf allen Feeds auf eine gleich bleibende
 * Kennung verlassen lässt. myTischtennis vergibt sie je Export neu — dieselbe Begegnung
 * kommt beim zweiten Abruf mit einer anderen UID zurück. Über die UID allein sähe der
 * Abgleich dann ein unbekanntes Spiel (anlegen) und ein verschwundenes (absagen), und
 * nach drei Klicks auf „Import starten" stünde jede Begegnung dreimal in der Liste, zwei
 * davon als „entfällt".
 *
 * Innerhalb einer Runde spielt eine Mannschaft jeden Gegner einmal daheim und einmal
 * auswärts. Damit ist das Paar aus Seite und Gegner so eindeutig wie eine UID — nur
 * eben stabil. Der Spieltag bleibt bewusst draußen: Er fehlt in manchen Feeds ganz und
 * wäre dann kein Schlüssel, sondern ein Zufall.
 */
export function matchFingerprint(isHome: boolean, opponent: string): string {
  return `${isHome ? 'H' : 'A'}|${opponent.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

/**
 * Welche der gleich aussehenden Zeilen der Feed-Termin meint.
 *
 * Eindeutig ist nur der Fall mit genau einem aktiven Kandidaten. Steht dahinter der
 * Scherbenhaufen eines früheren Fehlimports (ein aktives Spiel, mehrere abgesagte), ist
 * das aktive gemeint. Sind es mehrere aktive, wird nicht geraten: dann legt der Abgleich
 * lieber neu an, als eine fremde Aufstellung zu überschreiben.
 */
function pickCandidate(candidates: readonly ExistingMatch[]): ExistingMatch | null {
  const active = candidates.filter((match) => match.active);
  if (active.length === 1) return active[0];
  if (active.length === 0 && candidates.length === 1) return candidates[0];
  return null;
}

export function planSync({ existing, events, resolve }: SyncPlanInput): SyncPlan {
  const resolved = events.map((event) => ({ event, info: resolve(event) }));

  const byUid = new Map(existing.map((match) => [match.external_uid, match]));
  const claimed = new Set<string>();
  /** Feed-Termin (über seinen Platz in der Liste) → vorhandene Zeile. */
  const partner = new Map<number, ExistingMatch>();

  // Erster Durchgang: alles, was sich über die UID wiederfindet. Ein Feed mit stabilen
  // UIDs ist hier fertig, und der zweite Durchgang findet nichts mehr vor.
  resolved.forEach(({ event }, index) => {
    const hit = byUid.get(event.uid);
    if (!hit || claimed.has(hit.id)) return;
    claimed.add(hit.id);
    partner.set(index, hit);
  });

  // Zweiter Durchgang: der Zweitschlüssel, für alles ohne UID-Treffer.
  const spare = new Map<string, ExistingMatch[]>();
  for (const match of existing) {
    if (claimed.has(match.id)) continue;
    const key = matchFingerprint(match.is_home, match.opponent);
    const list = spare.get(key);
    if (list) list.push(match);
    else spare.set(key, [match]);
  }

  resolved.forEach(({ info }, index) => {
    if (partner.has(index)) return;

    const list = spare.get(matchFingerprint(info.isHome, info.opponent));
    if (!list || list.length === 0) return;

    const hit = pickCandidate(list);
    if (!hit) return;

    list.splice(list.indexOf(hit), 1);
    claimed.add(hit.id);
    partner.set(index, hit);
  });

  const actions: SyncAction[] = [];

  resolved.forEach(({ event, info }, index) => {
    const planned: PlannedMatch = {
      external_uid: event.uid,
      summary: event.summary,
      description: event.description,
      location_text: event.location,
      dtstart: event.dtstart.toISOString(),
      dtend: event.dtend.toISOString(),
      is_home: info.isHome,
      opponent: info.opponent,
      matchday: info.matchday,
    };

    const current = partner.get(index);

    if (!current) {
      actions.push({ kind: 'insert', match: planned });
      return;
    }

    // Eine bestätigte Verlegung, die jetzt auch im Verbandskalender steht, ist keine
    // Verlegung mehr — der Termin ist offiziell geworden.
    if (current.dtstart_override && sameInstant(current.dtstart_override, planned.dtstart)) {
      actions.push({ kind: 'clear_override', id: current.id, uid: planned.external_uid });
      return;
    }

    const timeChanged =
      !sameInstant(current.dtstart, planned.dtstart) || !sameInstant(current.dtend, planned.dtend);

    if (timeChanged) {
      actions.push({
        kind: 'reschedule',
        id: current.id,
        match: planned,
        fromDtstart: current.dtstart,
        newVersion: current.version + 1,
      });
      return;
    }

    const detailsChanged =
      current.summary !== planned.summary ||
      (current.description ?? '') !== planned.description ||
      (current.location_text ?? '') !== planned.location_text ||
      current.opponent !== planned.opponent ||
      current.is_home !== planned.is_home ||
      current.matchday !== planned.matchday ||
      !current.active;

    actions.push(
      detailsChanged
        ? { kind: 'update_details', id: current.id, match: planned }
        : { kind: 'touch', id: current.id, uid: planned.external_uid },
    );
  });

  const activeExisting = existing.filter((match) => match.active);

  // Sicherheitssperre: ein leerer Kalender ist fast immer eine Störung der Gegenstelle,
  // keine abgesagte Saison. Ohne diese Bremse würde ein einziger Fehlabruf sämtliche
  // Spiele deaktivieren und alle Rückmeldungen entwerten.
  if (events.length === 0 && activeExisting.length > 0) {
    return {
      actions: [],
      status: 'warning',
      warning:
        `Sicherheitssperre: Der Kalender lieferte 0 Termine, obwohl ${activeExisting.length} aktive Spiele vorhanden sind. Es wurde nichts geändert.`,
    };
  }

  for (const match of existing) {
    if (!claimed.has(match.id) && match.active) {
      actions.push({ kind: 'deactivate', id: match.id });
    }
  }

  return { actions, status: 'success' };
}
