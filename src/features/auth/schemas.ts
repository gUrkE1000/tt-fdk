import { z } from 'zod';

export const magicLinkSchema = z.object({
  email: z.string().trim().min(1, 'Bitte E-Mail-Adresse eingeben').email('Das sieht nicht nach einer E-Mail-Adresse aus'),
});
export type MagicLinkValues = z.infer<typeof magicLinkSchema>;

export const passwordLoginSchema = z.object({
  email: z.string().trim().min(1, 'Bitte E-Mail-Adresse eingeben').email('Das sieht nicht nach einer E-Mail-Adresse aus'),
  password: z.string().min(1, 'Bitte Passwort eingeben'),
});
export type PasswordLoginValues = z.infer<typeof passwordLoginSchema>;

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte Vornamen eingeben'),
  lastName: z.string().trim().min(1, 'Bitte Nachnamen eingeben'),
  email: z.string().trim().min(1, 'Bitte E-Mail-Adresse eingeben').email('Das sieht nicht nach einer E-Mail-Adresse aus'),
  // Optional: wer nur per Magic Link kommt, braucht kein Passwort.
  password: z
    .string()
    .min(8, 'Mindestens 8 Zeichen')
    .optional()
    .or(z.literal('')),
});
export type RegisterValues = z.infer<typeof registerSchema>;
