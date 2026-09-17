// Versand aus dem Postfach (Aufgabe 4.2).
//
// Läuft alle fünf Minuten per Cron und holt bis zu 50 fällige Nachrichten. Die
// Zustandslogik steckt in `_shared/notificationState.ts` und ist dort vollständig
// getestet; hier bleibt das Holen, das Verschicken und das Zurückschreiben.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  applyOutcome,
  preflight,
  type NotificationRow,
  type SendOutcome,
} from '../_shared/notificationState.ts';
import { buildEmailHtml } from '../_shared/emailHtml.ts';

const BATCH_SIZE = 50;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface QueueRow {
  id: string;
  profile_id: string;
  channel: 'email' | 'push';
  type: string;
  subject: string;
  body_text: string;
  payload: Record<string, unknown>;
  attempts: number;
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
  const resendKey = Deno.env.get('RESEND_API_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'not_configured' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!(await authorize(request, admin, supabaseUrl, anonKey))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const settings = await loadSettings(admin);

  const { data: queue, error: queueError } = await admin
    .from('notifications')
    .select('id, profile_id, channel, type, subject, body_text, payload, attempts')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for')
    .limit(BATCH_SIZE);

  if (queueError) return json({ error: 'queue_unavailable', detail: queueError.message }, 500);

  const rows = (queue ?? []) as QueueRow[];
  if (rows.length === 0) return json({ processed: 0, sent: 0, failed: 0, skipped: 0 });

  const recipients = await loadRecipients(
    admin,
    rows.map((row) => row.profile_id),
  );

  const counts = { processed: 0, sent: 0, failed: 0, skipped: 0, retried: 0 };

  for (const row of rows) {
    const recipient = recipients.get(row.profile_id);

    const state: NotificationRow = {
      id: row.id,
      channel: row.channel,
      attempts: row.attempts,
      recipient: recipient?.email ?? null,
      recipientDeleted: recipient?.deleted ?? true,
    };

    const early = preflight(state);
    if (early) {
      await write(admin, row.id, early);
      counts.processed += 1;
      counts.skipped += 1;
      continue;
    }

    const outcome = resendKey
      ? await sendEmail(resendKey, row, state.recipient!, settings)
      : ({ kind: 'error', message: 'RESEND_API_KEY ist nicht gesetzt.' } as SendOutcome);

    const change = applyOutcome(state, outcome);
    await write(admin, row.id, change);

    counts.processed += 1;
    if (change.status === 'sent') counts.sent += 1;
    else if (change.status === 'failed') counts.failed += 1;
    else counts.retried += 1;
  }

  return json(counts);
});

async function authorize(
  request: Request,
  admin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string,
): Promise<boolean> {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret) {
    const { data } = await admin
      .schema('private')
      .from('cron_config')
      .select('value')
      .eq('key', 'cron_secret')
      .maybeSingle();

    const expected = (data as { value?: string } | null)?.value;
    return Boolean(expected) && cronSecret === expected;
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: user } = await caller.auth.getUser();
  if (!user?.user) return false;

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status, deleted_at')
    .eq('id', user.user.id)
    .maybeSingle();

  const row = profile as { role?: string; status?: string; deleted_at?: string | null } | null;
  return row?.role === 'admin' && row.status === 'active' && !row.deleted_at;
}

interface Settings {
  clubName: string;
  senderName: string;
  senderEmail: string;
  appUrl: string;
}

async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin
    .from('club_settings')
    .select('key, value')
    .in('key', ['club_name', 'notification_sender_name', 'notification_sender_email', 'app_url']);

  const map = Object.fromEntries(
    ((data ?? []) as { key: string; value: string }[]).map((row) => [row.key, row.value]),
  );

  return {
    clubName: map.club_name || 'Vereinsplaner',
    senderName: map.notification_sender_name || map.club_name || 'Vereinsplaner',
    senderEmail: map.notification_sender_email || '',
    appUrl: map.app_url || '',
  };
}

async function loadRecipients(
  admin: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, { email: string | null; deleted: boolean }>> {
  const { data } = await admin
    .from('profiles')
    .select('id, email, deleted_at')
    .in('id', [...new Set(profileIds)]);

  return new Map(
    ((data ?? []) as { id: string; email: string | null; deleted_at: string | null }[]).map(
      (row) => [row.id, { email: row.email, deleted: row.deleted_at !== null }],
    ),
  );
}

async function sendEmail(
  apiKey: string,
  row: QueueRow,
  to: string,
  settings: Settings,
): Promise<SendOutcome> {
  if (!settings.senderEmail) {
    return { kind: 'permanent', message: 'Keine Absenderadresse in den Vereinsdaten hinterlegt.' };
  }

  const cc = Array.isArray(row.payload.cc) ? (row.payload.cc as string[]) : undefined;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${settings.senderName} <${settings.senderEmail}>`,
        to: [to],
        cc,
        subject: row.subject,
        text: row.body_text,
        html: buildEmailHtml({
          subject: row.subject,
          bodyText: row.body_text,
          clubName: settings.clubName,
          settingsUrl: settings.appUrl ? `${settings.appUrl}/profile` : undefined,
        }),
      }),
    });

    if (response.ok) return { kind: 'ok' };

    const detail = await response.text();

    // 4xx außer 429 heißt: so wird es auch beim nächsten Mal nichts.
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      return { kind: 'permanent', message: `HTTP ${response.status}: ${detail.slice(0, 200)}` };
    }

    return { kind: 'error', message: `HTTP ${response.status}: ${detail.slice(0, 200)}` };
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Versand nicht möglich',
    };
  }
}

async function write(
  admin: SupabaseClient,
  id: string,
  change: ReturnType<typeof applyOutcome>,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: change.status,
    attempts: change.attempts,
    error: change.error,
    sent_at: change.sentAt,
  };

  if (change.scheduledFor) update.scheduled_for = change.scheduledFor;

  await admin.from('notifications').update(update).eq('id', id);
}
