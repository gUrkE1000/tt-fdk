import { z } from 'zod';
import { BUNDESLAENDER } from '../../lib/bundeslaender';

/** Leer ist erlaubt; wenn etwas dasteht, muss es eine http(s)-Adresse sein. */
const optionalUrl = z
  .string()
  .trim()
  .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), {
    message: 'Bitte eine vollständige Adresse mit https:// eingeben',
  });

export const clubDataSchema = z.object({
  club_name: z.string().trim().min(1, 'Der Verein braucht einen Namen'),
  club_short_name: z.string().trim(),
  // Kommagetrennte Schreibweisen des Vereinsnamens. Die Heim/Auswärts-Erkennung beim
  // Kalenderimport (Phase 3) vergleicht damit gegen die Bezeichnungen aus click-TT.
  club_aliases: z.string().trim(),
  website_url: optionalUrl,
  facebook_url: optionalUrl,
  instagram_url: optionalUrl,
  youtube_url: optionalUrl,
  whatsapp_url: optionalUrl,
  about_html: z.string(),
  welcome_email_html: z.string(),
  bundesland: z.string().refine((value) => value in BUNDESLAENDER, {
    message: 'Bitte ein Bundesland wählen',
  }),
  // Leer schaltet die Selbstregistrierung ab. Sonst mindestens zehn Zeichen: Der Code
  // lässt sich ohne Anmeldung prüfen, ein kurzer wäre schnell erraten. Der Knopf
  // „Vorschlagen" erzeugt zwölf.
  registration_code: z
    .string()
    .trim()
    .refine((value) => value === '' || value.length >= 10, {
      message: 'Mindestens zehn Zeichen – oder leer lassen, um die Registrierung abzuschalten',
    }),
  default_venue_id: z.string(),
});
export type ClubDataValues = z.infer<typeof clubDataSchema>;

export const CLUB_DATA_KEYS = Object.keys(clubDataSchema.shape) as (keyof ClubDataValues)[];

/** Aus den Schlüssel-Wert-Paaren der Datenbank ein vollständiges Formular machen. */
export function toClubFormValues(settings: Record<string, string>): ClubDataValues {
  const values = {} as Record<string, string>;
  for (const key of CLUB_DATA_KEYS) values[key] = settings[key] ?? '';
  if (!values.bundesland) values.bundesland = 'NW';
  return values as unknown as ClubDataValues;
}

/** „TTC Musterstadt, TTC Muster" → ["TTC Musterstadt", "TTC Muster"] */
export function parseAliases(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
