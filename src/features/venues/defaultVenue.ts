import { useMemo } from 'react';
import { useClubSettings } from '../club/api';
import { useVenues, type Venue } from './api';

/**
 * Der Standardort: die in den Vereinsdaten gewählte Halle, sonst die einzige aktive.
 * Ein Training oder Heimspiel ohne eigenen Ort findet dort statt. Dieselbe Regel wie
 * `club_default_venue()` in der Datenbank.
 */
export function defaultVenueId(
  settingValue: string | null | undefined,
  venues: readonly { id: string; active: boolean }[],
): string | null {
  const chosen = (settingValue ?? '').trim();
  if (chosen !== '' && venues.some((venue) => venue.id === chosen)) return chosen;

  const active = venues.filter((venue) => venue.active);
  return active.length === 1 ? active[0].id : null;
}

export function useDefaultVenueId(): string | null {
  const settings = useClubSettings();
  const venues = useVenues();
  return useMemo(
    () => defaultVenueId(settings.data?.default_venue_id, venues.data ?? []),
    [settings.data, venues.data],
  );
}

/** Der Ort eines Trainings — ohne eigenen Ort der Standardort. */
export function useVenueOf(): (venueId: string | null | undefined) => Venue | undefined {
  const venues = useVenues();
  const fallback = useDefaultVenueId();
  return useMemo(() => {
    const list = venues.data ?? [];
    return (venueId) => list.find((venue) => venue.id === (venueId ?? fallback));
  }, [venues.data, fallback]);
}
