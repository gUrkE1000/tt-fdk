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
  | { kind: 'clear_override'; id: string }
  | { kind: 'touch'; id: string }
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

export function planSync({ existing, events, resolve }: SyncPlanInput): SyncPlan {
  const actions: SyncAction[] = [];
  const byUid = new Map(existing.map((m) => [m.external_uid, m]));
  const seen = new Set<string>();

  for (const event of events) {
    seen.add(event.uid);
    const { isHome, opponent, matchday } = resolve(event);

    const planned: PlannedMatch = {
      external_uid: event.uid,
      summary: event.summary,
      description: event.description,
      location_text: event.location,
      dtstart: event.dtstart.toISOString(),
      dtend: event.dtend.toISOString(),
      is_home: isHome,
      opponent,
      matchday,
    };

    const current = byUid.get(event.uid);

    if (!current) {
      actions.push({ kind: 'insert', match: planned });
      continue;
    }

    // Eine bestätigte Verlegung, die jetzt auch im Verbandskalender steht, ist keine
    // Verlegung mehr — der Termin ist offiziell geworden.
    if (current.dtstart_override && sameInstant(current.dtstart_override, planned.dtstart)) {
      actions.push({ kind: 'clear_override', id: current.id });
      continue;
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
      continue;
    }

    const detailsChanged =
      current.summary !== planned.summary ||
      (current.description ?? '') !== planned.description ||
      (current.location_text ?? '') !== planned.location_text ||
      current.is_home !== planned.is_home ||
      current.matchday !== planned.matchday ||
      !current.active;

    actions.push(
      detailsChanged
        ? { kind: 'update_details', id: current.id, match: planned }
        : { kind: 'touch', id: current.id },
    );
  }

  const activeExisting = existing.filter((m) => m.active);

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
    if (!seen.has(match.external_uid) && match.active) {
      actions.push({ kind: 'deactivate', id: match.id });
    }
  }

  return { actions, status: 'success' };
}
