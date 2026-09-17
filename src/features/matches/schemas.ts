import { z } from 'zod';

export const matchSchema = z.object({
  teamId: z.string().min(1, 'Bitte eine Mannschaft wählen'),
  date: z.string().min(1, 'Bitte ein Datum wählen'),
  time: z.string().min(1, 'Bitte eine Uhrzeit angeben'),
  durationMinutes: z
    .number({ error: 'Bitte eine Zahl eingeben' })
    .int()
    .min(30, 'Mindestens 30 Minuten')
    .max(720, 'Höchstens zwölf Stunden'),
  isHome: z.boolean(),
  venueId: z.string(),
  locationText: z.string().trim(),
  opponent: z.string().trim(),
  league: z.string().trim(),
  requiredPlayers: z
    .number({ error: 'Bitte eine Zahl eingeben' })
    .int('Bitte eine ganze Zahl')
    .min(1, 'Mindestens ein Spieler')
    .max(12, 'Mehr als zwölf Spieler stehen nicht am Tisch'),
  supervisorId: z.string(),
  comment: z.string(),
  nuscoreCode: z.string().trim(),
  nuscorePin: z.string().trim(),
});
export type MatchValues = z.infer<typeof matchSchema>;

export const EMPTY_MATCH: MatchValues = {
  teamId: '',
  date: '',
  time: '19:00',
  durationMinutes: 240,
  isHome: true,
  venueId: '',
  locationText: '',
  opponent: '',
  league: '',
  requiredPlayers: 4,
  supervisorId: '',
  comment: '',
  nuscoreCode: '',
  nuscorePin: '',
};

/**
 * Die Adresse muss auf einen einzelnen Mannschaftskalender zeigen.
 *
 * Der Gesamtspielplan des Vereins ist der häufigste Fehler beim Import — er lädt anstandslos
 * und schreibt dann die Spiele aller Mannschaften in eine einzige. Deshalb hier eine
 * Warnung, bevor es passiert, statt einer Fehlermeldung danach.
 */
export function validateCalendarUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return 'Bitte die Kalender-Adresse eingeben';

  if (!/^(https?|webcal):\/\//i.test(url)) {
    return 'Die Adresse muss mit https:// oder webcal:// beginnen';
  }

  if (!/exportICSCalendar/i.test(url)) {
    return 'Das sieht nicht nach einem myTischtennis-Spielplan aus. Erwartet wird eine Adresse mit „exportICSCalendar“.';
  }

  if (!/teamIds=/i.test(url)) {
    return 'In der Adresse fehlt „teamIds“. Nimm den Kalender deiner Mannschaft, nicht den Gesamtspielplan des Vereins.';
  }

  return null;
}

/** Datum und Uhrzeit aus dem Formular in einen Zeitpunkt der lokalen Zeitzone. */
export function toLocalIso(date: string, time: string): string {
  return `${date}T${time}:00`;
}
