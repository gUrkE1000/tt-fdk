import type { IcsEntry } from './ics.ts';

/**
 * Eine Zeile aus `calendar_feed_items()` (Migration calendar_subscription): Spiel,
 * Hallensperre oder Training für das Kalender-Abo eines Mitglieds.
 */
export interface FeedItem {
  uid: string;
  kind: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  title: string;
  location: string | null;
  description: string | null;
  cancelled: boolean;
}

/** Eine Zeile als Kalendereintrag. */
export function toIcsEntry(row: FeedItem): IcsEntry {
  return {
    // Stabil über Läufe hinweg: Art und ID des Objekts, nichts Zufälliges. Ändert sich
    // die UID, legt das Kalenderprogramm den Termin ein zweites Mal an.
    uid: `${row.uid}@vereinsplaner`,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    description: row.description,
    allDay: row.all_day === true,
    cancelled: row.cancelled === true,
  };
}
