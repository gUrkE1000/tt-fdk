import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Bewusst ein harter Fehler statt eines Platzhalters: eine Anwendung, die gegen eine
// nicht existierende Datenbank läuft, verwirrt nur — sie zeigt leere Listen statt einer
// klaren Fehlermeldung.
if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen. Lege .env.local nach dem Vorbild von .env.example an (siehe docs/entwicklung.md).',
  );
}

/**
 * Adresse und öffentlicher Schlüssel, für die wenigen Aufrufe, die **vor** der Anmeldung
 * laufen und deshalb bewusst am Supabase-Client vorbeigehen (siehe `publicRpc`).
 */
export const SUPABASE_URL = url.replace(/\/$/, '');
export const SUPABASE_ANON_KEY = anonKey;

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Der Magic Link bringt die Sitzung im URL-Fragment mit.
    detectSessionInUrl: true,
  },
});

/** Basis für Links, die in Benachrichtigungen verschickt werden. */
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

/**
 * Basis der Edge Functions, für Links, die kein Supabase-Client abruft — etwa das
 * Kalender-Abo, das ein fremdes Programm öffnet.
 */
export const FUNCTIONS_URL = `${url.replace(/\/$/, '')}/functions/v1`;
