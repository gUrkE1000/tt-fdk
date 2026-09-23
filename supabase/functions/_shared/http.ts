/**
 * Gemeinsames Gerüst der Edge Functions: CORS, JSON-Antworten, Clients und die Frage
 * „wer darf das aufrufen?".
 *
 * Die Anmeldeprüfung stand vorher fünfmal fast gleich in den Functions — und gerade die
 * Unterschiede (welche Rollen dürfen) sind die Stellen, an denen sich Fehler verstecken.
 */

import { createClient, type SupabaseClient } from './supabase.ts';
import { safeEqual } from './guards.ts';

export type { SupabaseClient };

export function corsHeaders(methods: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': `${methods}, OPTIONS`,
  };
}

export function json(body: unknown, status = 200, methods = 'POST'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(methods), 'Content-Type': 'application/json' },
  });
}

export interface Environment {
  supabaseUrl: string;
  anonKey: string;
  admin: SupabaseClient;
}

/** Clients und Schlüssel — oder null, wenn die Function nicht eingerichtet ist. */
export function environment(): Environment | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) return null;

  return {
    supabaseUrl,
    anonKey,
    admin: createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export type CallerRole = 'admin' | 'team_leader' | 'trainer' | 'organizer' | 'member';

/**
 * Darf der Aufrufer die Function auslösen?
 *
 * Zwei Wege herein:
 *   - der Cron-Job mit `x-cron-secret`. Geprüft über `verify_cron_secret()` in der
 *     Datenbank: Das Schema `private` veröffentlicht PostgREST nicht, und service_role hat
 *     dort kein USAGE — die frühere Abfrage per REST scheiterte deshalb immer.
 *     Zusätzlich darf das Secret als Function-Secret `CRON_SECRET` gesetzt sein; dann
 *     genügt der Vergleich hier, ohne Datenbankanfrage.
 *   - ein angemeldeter, aktiver Benutzer mit einer der Rollen in `roles`.
 */
export async function authorize(
  request: Request,
  env: Environment,
  roles: readonly CallerRole[],
): Promise<boolean> {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret) {
    const configured = Deno.env.get('CRON_SECRET');
    if (configured) return safeEqual(cronSecret, configured);

    const { data, error } = await env.admin.rpc('verify_cron_secret', { p_secret: cronSecret });
    if (error) console.error('verify_cron_secret:', error.message);
    return data === true;
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const caller = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: user } = await caller.auth.getUser();
  if (!user?.user) return false;

  const { data: profile } = await env.admin
    .from('profiles')
    .select('role, status, deleted_at')
    .eq('id', user.user.id)
    .maybeSingle();

  const row = profile as { role?: CallerRole; status?: string; deleted_at?: string | null } | null;
  return Boolean(
    row && row.status === 'active' && !row.deleted_at && row.role && roles.includes(row.role),
  );
}

/** Den JSON-Body lesen; ein leerer oder kaputter Body ist ein leeres Objekt. */
export async function readBody<T extends object>(request: Request): Promise<Partial<T>> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<T>) : {};
  } catch {
    return {};
  }
}
