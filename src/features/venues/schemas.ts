import { z } from 'zod';

export const venueSchema = z.object({
  name: z.string().trim().min(1, 'Der Ort braucht einen Namen'),
  address: z.string().trim(),
  postalCode: z.string().trim(),
  city: z.string().trim(),
  // „Maximale Anzahl gleichzeitiger Spieltermine" (Bestandsaufnahme F). Leer = unbegrenzt.
  // Das ist eine Grenze für die Terminplanung, keine Tischbelegung.
  maxGames: z
    .number({ error: 'Bitte eine Zahl eingeben' })
    .int('Bitte eine ganze Zahl')
    .min(1, 'Mindestens ein Spieltermin — sonst den Ort stilllegen')
    .max(99, 'So viele Tische hat keine Halle')
    .nullable(),
  allowTrainingAtMaxGames: z.boolean(),
  trainingOnly: z.boolean(),
  active: z.boolean(),
});
export type VenueValues = z.infer<typeof venueSchema>;

export const EMPTY_VENUE: VenueValues = {
  name: '',
  address: '',
  postalCode: '',
  city: '',
  maxGames: null,
  allowTrainingAtMaxGames: false,
  trainingOnly: false,
  active: true,
};

/** „Turnstraße 5, 12345 Musterstadt" — leere Teile fallen weg. */
export function formatVenueAddress(venue: {
  address: string | null;
  postal_code: string | null;
  city: string | null;
}): string {
  const place = [venue.postal_code, venue.city].filter(Boolean).join(' ').trim();
  return [venue.address?.trim(), place].filter(Boolean).join(', ');
}
