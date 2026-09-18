/**
 * Was ein Lauf des Kalenderabgleichs bewirkt hat — aus dem JSON in `sync_runs.summary`
 * in einen Satz, den man im Vorbeigehen liest.
 *
 * Als reine Funktion, weil das Format aus der Edge Function kommt und sich dort ändern
 * kann: Ein Test hält fest, womit die Oberfläche rechnet.
 */

interface TeamResult {
  team?: unknown;
  status?: unknown;
  inserted?: unknown;
  rescheduled?: unknown;
  updated?: unknown;
  deactivated?: unknown;
  message?: unknown;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export interface SyncTotals {
  inserted: number;
  rescheduled: number;
  updated: number;
  deactivated: number;
  teams: number;
  /** Warnungen der einzelnen Mannschaften, zusammengefasst. */
  messages: string[];
}

export function syncTotals(summary: unknown): SyncTotals {
  const empty: SyncTotals = {
    inserted: 0,
    rescheduled: 0,
    updated: 0,
    deactivated: 0,
    teams: 0,
    messages: [],
  };

  if (typeof summary !== 'object' || summary === null) return empty;

  const map = summary as Record<string, unknown>;

  // Ein Lauf, der gar nicht erst angefangen hat, meldet nur einen Fehler.
  if (typeof map.error === 'string' && map.error) {
    return { ...empty, messages: [map.error] };
  }

  const teams = Array.isArray(map.teams) ? (map.teams as TeamResult[]) : [];

  return teams.reduce<SyncTotals>(
    (totals, team) => ({
      inserted: totals.inserted + count(team.inserted),
      rescheduled: totals.rescheduled + count(team.rescheduled),
      updated: totals.updated + count(team.updated),
      deactivated: totals.deactivated + count(team.deactivated),
      teams: totals.teams + 1,
      messages:
        typeof team.message === 'string' && team.message
          ? [...totals.messages, team.message]
          : totals.messages,
    }),
    empty,
  );
}

/** „3 neu · 1 verlegt · 2 abgesagt" — oder „keine Änderungen". */
export function summaryText(summary: unknown): string {
  const totals = syncTotals(summary);
  const parts: string[] = [];

  if (totals.inserted > 0) parts.push(`${totals.inserted} neu`);
  if (totals.rescheduled > 0) parts.push(`${totals.rescheduled} verlegt`);
  if (totals.updated > 0) parts.push(`${totals.updated} geändert`);
  if (totals.deactivated > 0) parts.push(`${totals.deactivated} abgesagt`);

  if (parts.length === 0) {
    if (totals.messages.length > 0) return totals.messages.join(' · ');
    return totals.teams > 0 ? 'keine Änderungen' : '—';
  }

  return [...parts, ...totals.messages].join(' · ');
}
