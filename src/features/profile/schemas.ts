import { z } from 'zod';

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte Vornamen eingeben'),
  lastName: z.string().trim().min(1, 'Bitte Nachnamen eingeben'),
  gender: z.enum(['male', 'female', 'unspecified']),
  birthday: z.string().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  mobilePhone: z.string().trim().optional().or(z.literal('')),
  // Kommagetrennt, z. B. für Eltern („An die hinterlegten Adressen gehen alle
  // Benachrichtigungen in Kopie").
  emailsCopies: z.string().trim().optional().or(z.literal('')),
  // z.number() statt z.coerce.number(): die Umwandlung übernimmt react-hook-form über
  // valueAsNumber. Mit coerce wäre der Eingabetyp des Schemas `unknown` und der Resolver
  // passte nicht mehr zum Formulartyp.
  reminderGamesHours: z
    .number({ error: 'Bitte eine Zahl eingeben' })
    .int('Bitte eine ganze Zahl')
    .min(0, 'Nicht negativ')
    .max(336, 'Höchstens 336 Stunden (zwei Wochen)'),
  contactVisible: z.boolean(),
  hideBirthday: z.boolean(),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const absenceSchema = z
  .object({
    startDate: z.string().min(1, 'Bitte Startdatum wählen'),
    endDate: z.string().min(1, 'Bitte Enddatum wählen'),
    comment: z.string().trim().optional().or(z.literal('')),
  })
  .refine((values) => values.endDate >= values.startDate, {
    message: 'Das Ende darf nicht vor dem Anfang liegen',
    path: ['endDate'],
  });
export type AbsenceValues = z.infer<typeof absenceSchema>;

export const passwordSchema = z
  .object({
    password: z.string().min(8, 'Mindestens 8 Zeichen'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Die Passwörter stimmen nicht überein',
    path: ['confirm'],
  });
export type PasswordValues = z.infer<typeof passwordSchema>;

/** „a@x.de, b@y.de" → ["a@x.de", "b@y.de"] */
export function parseEmailList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
