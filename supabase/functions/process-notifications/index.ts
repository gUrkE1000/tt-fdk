// Versand aus dem Postfach (Aufgabe 4.2).
//
// Läuft alle fünf Minuten per Cron und holt bis zu 50 fällige Nachrichten. Die
// Zustandslogik steckt in `_shared/notificationState.ts` und ist dort vollständig
// getestet; hier bleibt das Holen, das Verschicken und das Zurückschreiben.

import { authorize, environment, json, corsHeaders, type SupabaseClient } from '../_shared/http.ts';
import {
  applyOutcome,
  preflight,
  type NotificationRow,
  type SendOutcome,
} from '../_shared/notificationState.ts';
import { buildEmailHtml } from '../_shared/emailHtml.ts';
import {
  buildPushMessage,
  classifyPushStatus,
  summarizePush,
  type EndpointOutcome,
} from '../_shared/pushMessage.ts';
import { sanitizeCc, vapidSubject } from '../_shared/guards.ts';
import webpush from 'npm:web-push@3.6.7';

const BATCH_SIZE = 50;

/** Länger wartet ein Versand nicht auf Resend — sonst überholt der nächste Lauf diesen. */
const SEND_TIMEOUT_MS = 15_000;

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

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders('POST') });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const env = environment();
  if (!env) return json({ error: 'not_configured' }, 500);
  const { admin } = env;

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!(await authorize(request, env, ['admin']))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const settings = await loadSettings(admin);

  // Ohne VAPID-Schlüsselpaar und ohne echte Kontaktangabe nimmt kein Push-Dienst etwas
  // an. Fehlt eins davon, bleibt der E-Mail-Weg unberührt; die Push-Zeilen werden
  // übersprungen statt zu scheitern.
  const subject = vapidSubject(settings.senderEmail, settings.appUrl);
  const pushReady = Boolean(vapidPublic && vapidPrivate && subject);
  if (pushReady) {
    webpush.setVapidDetails(subject!, vapidPublic!, vapidPrivate!);
  }

  // Beanspruchen statt nur lesen: `claim_notifications` setzt die Zeilen in einem Schritt
  // auf `sending`. Ein zweiter, überlappender Lauf bekommt sie nicht mehr.
  const { data: queue, error: queueError } = await admin.rpc('claim_notifications', {
    p_limit: BATCH_SIZE,
  });

  if (queueError) {
    console.error('claim_notifications:', queueError.message);
    return json({ error: 'queue_unavailable' }, 500);
  }

  const rows = (queue ?? []) as QueueRow[];
  if (rows.length === 0) return json({ processed: 0, sent: 0, failed: 0, skipped: 0 });

  const profileIds = rows.map((row) => row.profile_id);
  const recipients = await loadRecipients(admin, profileIds);
  const subscriptions = rows.some((row) => row.channel === 'push')
    ? await loadSubscriptions(admin, profileIds)
    : new Map<string, PushSubscriptionRow[]>();

  const counts = { processed: 0, sent: 0, failed: 0, skipped: 0, retried: 0, writeErrors: 0 };

  for (const row of rows) {
    const recipient = recipients.get(row.profile_id);

    const state: NotificationRow = {
      id: row.id,
      channel: row.channel,
      attempts: row.attempts,
      recipient: recipient?.email ?? null,
      recipientDeleted: recipient?.deleted ?? true,
      pushEndpoints: pushReady ? (subscriptions.get(row.profile_id)?.length ?? 0) : 0,
    };

    const early = preflight(state);
    if (early) {
      if (!(await write(admin, row.id, early))) counts.writeErrors += 1;
      counts.processed += 1;
      counts.skipped += 1;
      continue;
    }

    const outcome =
      row.channel === 'push'
        ? await sendPush(admin, row, subscriptions.get(row.profile_id) ?? [], settings)
        : resendKey
          ? await sendEmail(resendKey, row, state.recipient!, settings)
          : ({ kind: 'error', message: 'RESEND_API_KEY ist nicht gesetzt.' } as SendOutcome);

    const change = applyOutcome(state, outcome);
    // Scheitert das Zurückschreiben, bleibt die Zeile in `sending` und kommt nach 30
    // Minuten wieder — dann womöglich doppelt. Das soll im Protokoll stehen.
    if (!(await write(admin, row.id, change))) counts.writeErrors += 1;

    counts.processed += 1;
    if (change.status === 'sent') counts.sent += 1;
    else if (change.status === 'failed') counts.failed += 1;
    else counts.retried += 1;
  }

  return json(counts);
});

interface Settings {
  clubName: string;
  senderName: string;
  senderEmail: string;
  /**
   * Wohin Antworten gehen. Leer heißt: an die Absenderadresse — und hinter der steht in
   * aller Regel kein Postfach.
   */
  replyTo: string;
  appUrl: string;
}

async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin
    .from('club_settings')
    .select('key, value')
    .in('key', [
      'club_name',
      'notification_sender_name',
      'notification_sender_email',
      'notification_reply_to',
      'app_url',
    ]);

  const map = Object.fromEntries(
    ((data ?? []) as { key: string; value: string }[]).map((row) => [row.key, row.value]),
  );

  return {
    clubName: map.club_name || 'Vereinsplaner',
    senderName: map.notification_sender_name || map.club_name || 'Vereinsplaner',
    senderEmail: map.notification_sender_email || '',
    replyTo: map.notification_reply_to || '',
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

  const cc = sanitizeCc(row.payload.cc, to);

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
        // Weggelassen, wenn nichts hinterlegt ist: Ein leeres Feld lehnt Resend ab, und
        // ohne das Feld antwortet der Mailer an den Absender — dasselbe Verhalten wie
        // bisher, nur ohne Fehlschlag.
        reply_to: settings.replyTo || undefined,
        subject: row.subject,
        text: row.body_text,
        html: buildEmailHtml({
          subject: row.subject,
          bodyText: row.body_text,
          clubName: settings.clubName,
          settingsUrl: settings.appUrl ? `${settings.appUrl}/profile` : undefined,
        }),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
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

/** Den neuen Zustand zurückschreiben. `false`, wenn das nicht geklappt hat. */
async function write(
  admin: SupabaseClient,
  id: string,
  change: ReturnType<typeof applyOutcome>,
): Promise<boolean> {
  const update: Record<string, unknown> = {
    status: change.status,
    attempts: change.attempts,
    error: change.error,
    sent_at: change.sentAt,
  };

  if (change.scheduledFor) update.scheduled_for = change.scheduledFor;

  const { error } = await admin.from('notifications').update(update).eq('id', id);
  if (error) console.error(`notifications ${id}:`, error.message);
  return !error;
}

// ---------------------------------------------------------------------------- Push

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function loadSubscriptions(
  admin: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, PushSubscriptionRow[]>> {
  const { data } = await admin
    .from('push_subscriptions')
    .select('id, profile_id, endpoint, p256dh, auth')
    .in('profile_id', [...new Set(profileIds)]);

  const map = new Map<string, PushSubscriptionRow[]>();
  for (const row of (data ?? []) as (PushSubscriptionRow & { profile_id: string })[]) {
    const list = map.get(row.profile_id) ?? [];
    list.push({ id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    map.set(row.profile_id, list);
  }
  return map;
}

/**
 * Eine Nachricht an alle Geräte eines Mitglieds.
 *
 * Endpunkte, die der Push-Dienst nicht mehr kennt (404/410), werden dabei gelöscht:
 * Sie kommen nie wieder, und jeder weitere Lauf würde auf sie warten.
 */
async function sendPush(
  admin: SupabaseClient,
  row: QueueRow,
  subscriptions: PushSubscriptionRow[],
  settings: Settings,
): Promise<SendOutcome> {
  if (subscriptions.length === 0) {
    return { kind: 'permanent', message: 'Kein Gerät für Push angemeldet.' };
  }

  const message = buildPushMessage(row, settings.appUrl || '/');
  const payload = JSON.stringify(message);

  const outcomes: EndpointOutcome[] = [];
  const gone: string[] = [];
  const errors: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        { TTL: 60 * 60 * 24, timeout: SEND_TIMEOUT_MS },
      );
      outcomes.push({ gone: false, delivered: true, retry: false });

      await admin
        .from('push_subscriptions')
        .update({ failures: 0, last_success_at: new Date().toISOString() })
        .eq('id', subscription.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 0;
      const outcome = classifyPushStatus(status);
      outcomes.push(outcome);

      if (outcome.gone) gone.push(subscription.id);
      else errors.push(`HTTP ${status || '?'}`);
    }
  }

  if (gone.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', gone);
  }

  const summary = summarizePush(outcomes);
  if (summary.delivered) return { kind: 'ok' };

  const detail = errors.length > 0 ? errors.join(', ') : 'Alle Geräte abgemeldet';
  return summary.retry ? { kind: 'error', message: detail } : { kind: 'permanent', message: detail };
}
