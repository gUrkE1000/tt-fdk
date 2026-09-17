// Einladung per E-Mail (Aufgabe 2.3).
//
// Warum eine Edge Function und nicht der Browser? Der Aufruf
// `auth.admin.inviteUserByEmail` braucht den `service_role`-Schlüssel. Der darf nie in
// eine Auslieferung an den Browser geraten — dort könnte ihn jeder auslesen und damit
// die gesamte Datenbank lesen und schreiben. Also läuft der Aufruf hier, serverseitig,
// und die Funktion prüft vorher selbst, dass der Aufrufer wirklich Administrator ist.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InviteRequest {
  profileId?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const appUrl = Deno.env.get('APP_URL') ?? '';

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'not_configured' }, 500);
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  // Schritt 1: Wer ruft an? Der Client bekommt das Token des Aufrufers — damit gilt für
  // ihn dieselbe Row Level Security wie im Browser.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: user } = await caller.auth.getUser();
  if (!user?.user) return json({ error: 'unauthorized' }, 401);

  const { data: callerProfile } = await caller
    .from('profiles')
    .select('role, status')
    .eq('id', user.user.id)
    .maybeSingle();

  if (callerProfile?.role !== 'admin' || callerProfile?.status !== 'active') {
    return json({ error: 'forbidden' }, 403);
  }

  // Schritt 2: Wer soll eingeladen werden?
  let body: InviteRequest;
  try {
    body = (await request.json()) as InviteRequest;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  if (!body.profileId) return json({ error: 'missing_profile_id' }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, first_name, last_name, deleted_at')
    .eq('id', body.profileId)
    .maybeSingle();

  if (profileError) return json({ error: 'lookup_failed', detail: profileError.message }, 500);
  if (!profile || profile.deleted_at) return json({ error: 'unknown_profile' }, 404);
  if (!profile.email) return json({ error: 'no_email' }, 400);

  // Schritt 3: Einladen. Die id des Profils wandert als Metadatum mit, damit
  // handle_new_user() beim ersten Login das vorhandene Profil verknüpft statt ein
  // zweites anzulegen.
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(profile.email, {
    redirectTo: appUrl || undefined,
    data: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      profile_id: profile.id,
    },
  });

  if (inviteError) {
    const alreadyRegistered =
      inviteError.status === 422 || /already been registered/i.test(inviteError.message);
    return json(
      { error: alreadyRegistered ? 'already_registered' : 'invite_failed', detail: inviteError.message },
      alreadyRegistered ? 409 : 500,
    );
  }

  return json({ ok: true, email: profile.email });
});
