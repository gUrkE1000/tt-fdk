import { useMemo } from 'react';
import { todayInBerlin } from '../../lib/dates';
import { useTrainingCancellations, type TrainingCancellation } from '../trainings/api';
import { useDefaultVenueId } from '../venues/defaultVenue';
import type { MatchRow } from './api';

/**
 * Heimspiel in gesperrter Halle.
 *
 * Eine Hallensperre sagt die Trainings dort ab, ein Punktspiel aber nicht: Das ist ein
 * Verbandstermin und muss verlegt werden. Die Spielkarte warnt deshalb, und die
 * Mannschaftsführung bekommt eine Nachricht (Migration feedback_round).
 *
 * Ein Heimspiel ohne eigenen Ort — der Normalfall beim Import aus click-TT — findet im
 * Standardort statt. Dieselbe Regel wie `club_default_venue()` in der Datenbank.
 */

export function findVenueBlock(
  match: Pick<MatchRow, 'is_home' | 'venue_id' | 'dtstart' | 'active'>,
  cancellations: readonly Pick<TrainingCancellation, 'venue_id' | 'from_date' | 'to_date'>[],
  fallbackVenueId: string | null,
): Pick<TrainingCancellation, 'venue_id' | 'from_date' | 'to_date'> | null {
  if (!match.is_home || !match.active || !match.dtstart) return null;

  const venueId = match.venue_id ?? fallbackVenueId;
  if (!venueId) return null;

  const day = todayInBerlin(new Date(match.dtstart));
  return (
    cancellations.find(
      (entry) => entry.venue_id === venueId && entry.from_date <= day && entry.to_date >= day,
    ) ?? null
  );
}

/** Für die Spielkarten: zu einem Spiel die Hallensperre, die es trifft — oder `null`. */
export function useVenueBlockFor(): (
  match: Pick<MatchRow, 'is_home' | 'venue_id' | 'dtstart' | 'active'>,
) => TrainingCancellation | null {
  const cancellations = useTrainingCancellations();
  const fallback = useDefaultVenueId();

  return useMemo(() => {
    const blocks = (cancellations.data ?? []).filter((entry) => entry.venue_id !== null);
    return (match) =>
      (findVenueBlock(match, blocks, fallback) as TrainingCancellation | null) ?? null;
  }, [cancellations.data, fallback]);
}
