import type { Enums } from '../../lib/database.types';
import type { MatchRow } from './api';

/**
 * Die Filterleiste der Spielterminliste als reine Funktion — dieselbe Begründung wie bei
 * `filterMembers`: ohne React und ohne Datenzugriff lässt sich jede Kombination in
 * Millisekunden durchtesten.
 */

export interface MatchFilters {
  search: string;
  teamId: string | 'all';
  from: string;
  to: string;
  rankingType: Enums<'ranking_type'> | 'all';
  venueId: string | 'all';
  /** vollständig = genug Zusagen für `required_players`. */
  roster: 'all' | 'complete' | 'incomplete';
  /** Termin weicht vom Verbandskalender ab (bestätigte Verlegung). */
  rescheduled: 'all' | 'only';
  missingCode: 'all' | 'only';
}

export const EMPTY_MATCH_FILTERS: MatchFilters = {
  search: '',
  teamId: 'all',
  from: '',
  to: '',
  rankingType: 'all',
  venueId: 'all',
  roster: 'all',
  rescheduled: 'all',
  missingCode: 'all',
};

export function hasActiveMatchFilters(filters: MatchFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.teamId !== 'all' ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.rankingType !== 'all' ||
    filters.venueId !== 'all' ||
    filters.roster !== 'all' ||
    filters.rescheduled !== 'all' ||
    filters.missingCode !== 'all'
  );
}

/** Beendet heißt: das Spiel ist vorbei. Nicht: es wurde abgesagt. */
export function isFinished(match: MatchRow, now: Date = new Date()): boolean {
  return new Date(match.dtend ?? match.dtstart ?? 0).getTime() < now.getTime();
}

export function filterMatches(
  matches: MatchRow[],
  filters: MatchFilters,
  teamRankingTypes: Record<string, Enums<'ranking_type'>> = {},
): MatchRow[] {
  const needle = filters.search.trim().toLowerCase();

  return matches.filter((match) => {
    if (needle) {
      const haystack = [match.summary, match.opponent, match.league, match.location_text]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (filters.teamId !== 'all' && match.team_id !== filters.teamId) return false;

    // Die Grenzen sind Tage, kein Zeitpunkt: „von 01.10." schließt den 1. Oktober ein.
    const day = (match.dtstart ?? '').slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;

    if (filters.rankingType !== 'all') {
      if (teamRankingTypes[match.team_id ?? ''] !== filters.rankingType) return false;
    }

    if (filters.venueId !== 'all' && match.venue_id !== filters.venueId) return false;

    if (filters.roster !== 'all') {
      const complete = (match.confirmedCount ?? 0) >= (match.required_players ?? 0);
      if (filters.roster === 'complete' && !complete) return false;
      if (filters.roster === 'incomplete' && complete) return false;
    }

    if (filters.rescheduled === 'only' && !match.dtstart_override) return false;

    if (filters.missingCode === 'only' && match.nuscore_code && match.nuscore_pin) return false;

    return true;
  });
}
