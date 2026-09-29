import { supabase } from '../../lib/supabaseClient';
import { fetchAll } from '../../lib/fetchAll';

/**
 * „Meine Daten herunterladen" — Auskunft und Datenübertragbarkeit (Art. 15 und 20 DSGVO).
 *
 * Alles, was über eine Person gespeichert ist, als eine JSON-Datei: das Profil und je
 * Tabelle die Zeilen, in denen sie steht. Gelesen wird mit den Rechten der Person selbst —
 * die Datei enthält also nie mehr, als sie in der Anwendung ohnehin sehen darf.
 *
 * Nicht enthalten sind Zugangsgeheimnisse (Kalender-Token, Push-Schlüssel, Antwort-Token):
 * Eine weitergegebene Datei soll niemandem Zugang verschaffen.
 */

interface Source {
  /** Überschrift in der Datei. */
  label: string;
  table: string;
  column: string;
  /** Eindeutige Reihenfolge zusammen mit dem Filter — nötig zum Blättern. */
  order: string[];
}

const SOURCES: Source[] = [
  // Der Grund steht nur in der Sicht: Die Tabelle gibt ihn per Spaltenrecht nicht her.
  { label: 'abwesenheiten', table: 'v_absences', column: 'profile_id', order: ['id'] },
  { label: 'raenge', table: 'member_rankings', column: 'profile_id', order: ['ranking_type'] },
  { label: 'gruppen', table: 'group_members', column: 'profile_id', order: ['group_id'] },
  { label: 'aemter', table: 'club_role_members', column: 'profile_id', order: ['role_id'] },
  { label: 'mannschaften', table: 'team_members', column: 'profile_id', order: ['team_id'] },
  { label: 'mannschaftsfuehrung', table: 'team_leaders', column: 'profile_id', order: ['team_id'] },
  { label: 'rueckmeldungen_spiele', table: 'match_participations', column: 'profile_id', order: ['match_id'] },
  { label: 'fahrdienst_verpflegung', table: 'match_volunteers', column: 'profile_id', order: ['match_id', 'kind'] },
  { label: 'angebote_einzuspringen', table: 'match_offers', column: 'profile_id', order: ['match_id'] },
  { label: 'ersatzanfragen', table: 'substitute_requests', column: 'profile_id', order: ['id'] },
  { label: 'abstimmungen_verlegung', table: 'reschedule_votes', column: 'profile_id', order: ['poll_id', 'option_index'] },
  { label: 'trainings', table: 'training_members', column: 'profile_id', order: ['training_id'] },
  { label: 'trainer', table: 'training_trainers', column: 'profile_id', order: ['training_id'] },
  { label: 'rueckmeldungen_training', table: 'training_attendance', column: 'profile_id', order: ['session_id'] },
  { label: 'trainingstermine_zugeordnet', table: 'training_session_participants', column: 'profile_id', order: ['session_id'] },
  { label: 'hallenschluessel', table: 'v_session_keys', column: 'bearer_id', order: ['session_id'] },
  { label: 'schluesseldienst', table: 'key_duty_weekdays', column: 'profile_id', order: ['weekday'] },
  { label: 'schluesseldienst_vertretung', table: 'key_duty_overrides', column: 'profile_id', order: ['duty_date'] },
  { label: 'erinnerungsauswahl_training', table: 'training_reminder_filter', column: 'profile_id', order: ['training_id'] },
  { label: 'rueckmeldungen_vereinstermine', table: 'event_participations', column: 'profile_id', order: ['event_id'] },
  { label: 'stimmen_umfragen', table: 'poll_votes', column: 'profile_id', order: ['option_id'] },
  { label: 'eigene_umfragen', table: 'polls', column: 'created_by', order: ['id'] },
  { label: 'eigene_vereinstermine', table: 'club_events', column: 'created_by', order: ['id'] },
  { label: 'eigene_neuigkeiten', table: 'news', column: 'author_id', order: ['id'] },
  { label: 'nachrichten_an_terminen', table: 'object_messages', column: 'author_id', order: ['id'] },
  { label: 'benachrichtigungseinstellungen', table: 'notification_preferences', column: 'profile_id', order: ['type'] },
  { label: 'benachrichtigungen', table: 'notifications', column: 'profile_id', order: ['id'] },
  { label: 'push_geraete', table: 'push_subscriptions', column: 'profile_id', order: ['id'] },
  { label: 'kalender_abo', table: 'calendar_tokens', column: 'profile_id', order: ['profile_id'] },
];

/** Schlüssel, deren Wert Zugang verschafft. */
const SECRET_KEYS = new Set(['token', 'p256dh', 'auth']);

/** Antwort-Links („/r/<token>") öffnen eine Antwort ohne Anmeldung. */
const ACTION_LINK = /\/r\/[0-9a-f-]{36}/gi;

export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (typeof value === 'string') return value.replace(ACTION_LINK, '/r/…');
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECRET_KEYS.has(key))
        .map(([key, inner]) => [key, stripSecrets(inner)]),
    );
  }
  return value;
}

export interface DataExport {
  erstellt_am: string;
  hinweis: string;
  profil: unknown;
  /** Tabellen, die sich nicht lesen ließen — damit eine Lücke nicht still bleibt. */
  nicht_lesbar: string[];
  [label: string]: unknown;
}

export async function buildDataExport(profileId: string, now = new Date()): Promise<DataExport> {
  const profile = await supabase.rpc('rpc_my_profile');
  if (profile.error) throw profile.error;

  const result: DataExport = {
    erstellt_am: now.toISOString(),
    hinweis:
      'Alle über dich gespeicherten Daten im Vereinsplaner (Art. 15 und 20 DSGVO). ' +
      'Zugangsgeheimnisse wie Kalender- und Antwort-Token sind absichtlich nicht enthalten.',
    profil: stripSecrets(profile.data),
    nicht_lesbar: [],
  };

  for (const source of SOURCES) {
    try {
      const rows = await fetchAll((from, to) => {
        let query = supabase
          // Der Tabellenname kommt aus der festen Liste oben.
          .from(source.table as 'absences')
          .select('*', { count: 'exact' })
          .eq(source.column as 'profile_id', profileId);
        for (const column of source.order) {
          query = query.order(column as 'id');
        }
        return query.range(from, to);
      });
      result[source.label] = stripSecrets(rows);
    } catch {
      result.nicht_lesbar.push(source.label);
    }
  }

  return result;
}

export function exportFileName(now = new Date()): string {
  return `vereinsplaner-meine-daten-${new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
  }).format(now)}.json`;
}
