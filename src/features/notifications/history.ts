import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { Tables } from '../../lib/database.types';

export type HistoryRow = Pick<
  Tables<'notifications'>,
  'id' | 'channel' | 'type' | 'subject' | 'body_text' | 'payload' | 'scheduled_for' | 'status'
>;

export interface HistoryEntry {
  id: string;
  type: string;
  subject: string;
  body: string;
  at: string;
  link: string | null;
  channels: ('push' | 'email')[];
}

/** So viele Mitteilungen zeigt der Verlauf — älteres hilft niemandem mehr weiter. */
export const HISTORY_LIMIT = 100;

/**
 * Aus je einer Zeile pro Kanal wird ein Eintrag.
 *
 * `enqueue_notification` legt für App und E-Mail je eine Zeile an, mit demselben Text
 * und demselben Zeitpunkt. Im Verlauf wäre das doppelt — hier steht es einmal, mit den
 * Kanälen, über die es kam.
 */
export function mergeHistory(rows: HistoryRow[]): HistoryEntry[] {
  const byKey = new Map<string, HistoryEntry>();

  for (const row of rows) {
    const key = `${row.type}|${row.subject}|${row.scheduled_for}`;
    const link =
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? ((row.payload as Record<string, unknown>).link as string | undefined) ?? null
        : null;
    const channel = row.channel as 'push' | 'email';

    const existing = byKey.get(key);
    if (existing) {
      if (!existing.channels.includes(channel)) existing.channels.push(channel);
      continue;
    }

    byKey.set(key, {
      id: row.id,
      type: row.type,
      subject: row.subject,
      body: row.body_text,
      at: row.scheduled_for,
      link: typeof link === 'string' && link !== '' ? link : null,
      channels: [channel],
    });
  }

  return [...byKey.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Die eigenen Mitteilungen der letzten Zeit — auch die, die als Push kamen und
 * weggewischt wurden, und die, die mangels eingeschalteter Push-Mitteilungen gar
 * nicht zugestellt werden konnten (`skipped`): Genau dafür ist der Verlauf da. Was
 * noch geplant ist (eine vordatierte Neuigkeit), steht nicht dabei.
 */
export function useMyNotifications(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.notifications.mine(profileId),
    enabled: profileId !== null,
    queryFn: async (): Promise<HistoryEntry[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, channel, type, subject, body_text, payload, scheduled_for, status')
        .eq('profile_id', profileId!)
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: false })
        .limit(HISTORY_LIMIT * 2);
      if (error) throw error;
      return mergeHistory((data ?? []) as HistoryRow[]).slice(0, HISTORY_LIMIT);
    },
  });
}
