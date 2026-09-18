import { useQuery } from '@tanstack/react-query';
import { supabase, APP_URL } from '../../lib/supabaseClient';
import type { Tables } from '../../lib/database.types';

export type Profile = Tables<'profiles'>;

/**
 * Anmeldelink anfordern.
 *
 * shouldCreateUser: false ist die wichtigste Zeile dieser Datei. Ohne sie könnte sich
 * jede beliebige E-Mail-Adresse ein Konto verschaffen; so bekommt nur jemand einen Link,
 * den der Verein kennt. Neue Mitglieder kommen über Einladung oder Registrierungscode.
 */
export async function requestMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: APP_URL,
      shouldCreateUser: false,
    },
  });

  if (error) {
    // Supabase meldet den unbekannten Benutzer je nach Version unterschiedlich.
    if (/signups? not allowed|user not found/i.test(error.message)) {
      throw new Error(
        'Diese E-Mail-Adresse ist im Verein nicht bekannt. Bitte beim Administrator melden oder den Registrierungslink des Vereins nutzen.',
      );
    }
    throw error;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    throw new Error('E-Mail-Adresse oder Passwort stimmen nicht.');
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${APP_URL}/profile`,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  registrationCode: string;
}

/**
 * Selbstregistrierung über den Vereinscode. Der Trigger handle_new_user() prüft den Code
 * noch einmal in der Datenbank — die Prüfung hier ist nur für eine frühe Fehlermeldung.
 */
export async function registerWithCode(input: RegisterInput): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: input.email.trim(),
    // Ohne Passwort trotzdem eines vergeben: Supabase verlangt es beim signUp. Das Konto
    // wird danach ohnehin per Magic Link genutzt.
    password: input.password || crypto.randomUUID(),
    options: {
      emailRedirectTo: APP_URL,
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        registration_code: input.registrationCode,
      },
    },
  });

  if (error) {
    if (/nicht bekannt|Registrierungslink/i.test(error.message)) {
      throw new Error(error.message);
    }
    if (/already registered/i.test(error.message)) {
      throw new Error('Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte anmelden.');
    }
    throw error;
  }
}

export async function validateRegistrationCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_validate_registration_code', {
    p_code: code,
  } as never);
  if (error) throw error;
  return data === true;
}

export interface PublicClubInfo {
  club_name: string;
  club_short_name: string;
  /** Adresse des Datenschutzhinweises; leer, solange der Verein keinen hinterlegt hat. */
  privacy_url?: string;
  imprint_url?: string;
}

/** Vereinsname für Anmeldung und Registrierung — abrufbar, bevor jemand angemeldet ist. */
export function usePublicClubInfo() {
  return useQuery({
    queryKey: ['public-club-info'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicClubInfo> => {
      const { data, error } = await supabase.rpc('get_public_club_info' as never);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PublicClubInfo) ?? { club_name: 'Vereinsplaner', club_short_name: 'Verein' };
    },
  });
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Hält fest, wann jemand zuletzt da war — Grundlage für „seit deinem letzten Login". */
export async function touchLastLogin(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
}
