// Kalender-Abo je Mitglied (Aufgabe 7.4).
//
//   GET <functions>/calendar-feed?token=<uuid>
//
// Liefert die **zugesagten** Termine eines Mitglieds als ICS. Nur zugesagte: Ein
// Kalendereintrag heißt „da bin ich", nicht „das findet statt".
//
// Der Token ist ein Dauerausweis — ein Kalenderprogramm kann sich nicht anmelden. Er
// ist deshalb ein Zufallswert, für niemanden über die API lesbar und jederzeit neu
// erzeugbar. Mehr als die eigenen Termine gibt er nicht her.

import { createClient } from '../_shared/supabase.ts';
import { fetchAllPages } from '../_shared/guards.ts';
import { buildIcs, type IcsEntry } from '../_shared/ics.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** Zusagen. „Später" ist auch eine Zusage; „unsicher" und „nein" sind keine. */
const ATTENDING = new Set(['yes', 'late']);

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'GET') {
    return new Response('method_not_allowed', { status: 405, headers: CORS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('not_configured', { status: 500, headers: CORS });
  }

  const token = new URL(request.url).searchParams.get('token');
  if (!token) return new Response('missing_token', { status: 400, headers: CORS });
  // Ein Token ist eine UUID. Alles andere braucht keine Datenbankanfrage.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new Response('not_found', { status: 404, headers: CORS });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokenRow } = await admin
    .from('calendar_tokens')
    .select('profile_id')
    .eq('token', token)
    .maybeSingle();

  const profileId = (tokenRow as { profile_id?: string } | null)?.profile_id;
  // Ein unbekannter Token bekommt dieselbe Antwort wie ein fremder: 404, ohne Hinweis
  // darauf, ob es ihn gibt.
  if (!profileId) return new Response('not_found', { status: 404, headers: CORS });

  const { data: profile } = await admin
    .from('profiles')
    .select('status, deleted_at')
    .eq('id', profileId)
    .maybeSingle();

  const person = profile as { status?: string; deleted_at?: string | null } | null;
  if (!person || person.status !== 'active' || person.deleted_at) {
    return new Response('not_found', { status: 404, headers: CORS });
  }

  // Ein Jahr zurück, damit der Kalender auch die jüngste Vergangenheit zeigt.
  const from = new Date(Date.now() - 365 * 86_400_000).toISOString();

  // Blättern: Ein Jahr Training, Spiele und Termine kommt leicht über 1000 Zeilen.
  let rows: unknown[];
  try {
    rows = await fetchAllPages((start, end) =>
      admin
        .from('v_my_upcoming')
        .select('kind, id, starts_at, ends_at, title, location, my_status, active')
        .eq('profile_id', profileId)
        .gte('starts_at', from)
        .order('starts_at')
        .order('id')
        .range(start, end),
    );
  } catch (error) {
    console.error('v_my_upcoming:', error instanceof Error ? error.message : error);
    return new Response('unavailable', { status: 503, headers: CORS });
  }

  const entries: IcsEntry[] = (rows as {
    kind: string;
    id: string;
    starts_at: string;
    ends_at: string | null;
    title: string;
    location: string | null;
    my_status: string;
    active: boolean;
  }[])
    .filter((row) => row.active && ATTENDING.has(row.my_status))
    .map((row) => ({
      // Stabil über Läufe hinweg: Art und ID des Objekts, nichts Zufälliges.
      uid: `${row.kind}-${row.id}@vereinsplaner`,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      location: row.location,
    }));

  const { data: settings } = await admin
    .from('club_settings')
    .select('value')
    .eq('key', 'club_name')
    .maybeSingle();

  const calendarName = (settings as { value?: string } | null)?.value || 'Verein';
  const body = buildIcs(entries, { calendarName: `${calendarName} – Meine Termine` });

  return new Response(body, {
    headers: {
      ...CORS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="vereinsplaner.ics"',
      // Kalenderprogramme fragen von sich aus etwa stündlich; öfter wäre nur Last.
      // `private`: Die Antwort gehört einer Person und hat in geteilten Caches nichts zu suchen.
      'Cache-Control': 'private, max-age=3600',
    },
  });
});
