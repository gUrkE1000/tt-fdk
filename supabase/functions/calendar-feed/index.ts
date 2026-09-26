// Kalender-Abo je Mitglied (Aufgabe 7.4).
//
//   GET <functions>/calendar-feed?token=<uuid>
//
// Liefert als ICS, was ins private Kalenderprogramm gehört (Vereinsentscheidung
// 26.09.2026): die Heim- und Auswärtsspiele der eigenen Mannschaften und Spiele mit
// Anfrage, jede Hallensperre — und auf Wunsch die eigenen Trainings. Welche Einträge
// das sind, rechnet `calendar_feed_items()` in der Datenbank; hier wird nur geholt
// und formatiert.
//
// Der Token ist ein Dauerausweis — ein Kalenderprogramm kann sich nicht anmelden. Er
// ist deshalb ein Zufallswert, für niemanden über die API lesbar und jederzeit neu
// erzeugbar. Mehr als die eigenen Termine gibt er nicht her.

import { createClient } from '../_shared/supabase.ts';
import { fetchAllPages } from '../_shared/guards.ts';
import { buildIcs, type IcsEntry } from '../_shared/ics.ts';
import { toIcsEntry, type FeedItem } from '../_shared/calendarFeed.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

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
    .select('profile_id, include_trainings')
    .eq('token', token)
    .maybeSingle();

  const subscription = tokenRow as { profile_id?: string; include_trainings?: boolean } | null;
  const profileId = subscription?.profile_id;
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

  // Blättern: Ein Jahr Spiele und Trainings kommt leicht über 1000 Zeilen.
  let rows: unknown[];
  try {
    rows = await fetchAllPages((start, end) =>
      admin
        .rpc('calendar_feed_items', {
          p_profile_id: profileId,
          p_since: from,
          p_include_trainings: subscription?.include_trainings === true,
        })
        .range(start, end),
    );
  } catch (error) {
    console.error('calendar_feed_items:', error instanceof Error ? error.message : error);
    return new Response('unavailable', { status: 503, headers: CORS });
  }

  const entries: IcsEntry[] = (rows as FeedItem[]).map(toIcsEntry);

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
