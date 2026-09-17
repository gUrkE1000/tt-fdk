# Datenbank

Referenz zum Schema. Verbindlich ist immer die Migration in `supabase/migrations/`;
dieses Dokument erklärt, warum etwas so aussieht.

Stand: Baseline v2 (`20261001000000_schema_v2.sql`) — Verein, Mitglieder, Ränge, Gruppen,
Orte, Rechte. Mannschaften und Spiele folgen in Aufgabe 3.1, Benachrichtigungen in 4.1,
Training in 6.1.

## Grundsätze

1. **Die Datenbank erzwingt die Rechte, nicht das Frontend.** Jede Tabelle hat RLS, jede
   Policy einen positiven und einen negativen pgTAP-Test. Was die Oberfläche ausblendet,
   ist Bequemlichkeit — die Grenze zieht Postgres.
2. **Englische Bezeichner, deutsche Oberfläche.** Enum-Werte heißen `team_leader`, die
   Anzeige „Mannschaftsführer" kommt aus `src/lib/labels.ts`.
3. **Zeitpunkte sind `timestamptz`, Tagesangaben `date`.** Abwesenheiten, Geburtstage und
   Feiertage sind Kalendertage, keine Zeitpunkte.
4. **Soft-Delete für Mitglieder.** `deleted_at` statt `DELETE`, damit Rückmeldungen und
   Aufstellungen der Vergangenheit lesbar bleiben.

## Tabellen

### `club_settings`

Schlüssel-Wert-Tabelle für alles Vereinsweite. Beide Spalten sind `TEXT`; die Auswertung
passiert in `src/lib/clubSettings.ts` bzw. in den Funktionen, die den Wert brauchen.

| Schlüssel | Bedeutung |
|---|---|
| `club_name`, `club_short_name` | Anzeige in Kopfzeile, Anmeldung, ICS-Export |
| `club_aliases` | kommagetrennte Namensbestandteile für die Heim/Auswärts-Erkennung aus dem ICS-Titel |
| `website_url`, `facebook_url`, `instagram_url`, `youtube_url`, `whatsapp_url` | Vereinsdaten |
| `about_html`, `welcome_email_html` | Freitexte |
| `bundesland` | steuert Feiertage und Schulferien (Aufgabe 6.2) |
| `timezone` | fest `Europe/Berlin` |
| `app_url` | Basis für Links in Benachrichtigungen |
| `open_reminder_days`, `open_reminder_time` | täglicher Sammelhinweis auf offene Rückmeldungen |
| `event_reminder_hours` | Vorlauf für Vereinstermine |
| `notification_sender_name`, `notification_sender_email` | Absender der E-Mails |
| `registration_code` | Vereinscode für die Selbstregistrierung; leer = aus |
| `default_venue_id` | Vorbelegung bei neuen Terminen |

Schlüssel mit dem Präfix `secret_` sind per Policy von jedem Lesezugriff ausgenommen —
dort gehören Werte hin, die nur Edge Functions mit `service_role` sehen dürfen.

### `profiles`

Ein Datensatz je Vereinsmitglied. **Kein Fremdschlüssel auf `auth.users`:** der Admin legt
Mitglieder an, lange bevor (und oft ohne dass) sie sich jemals anmelden.

Beim ersten Login übernimmt `handle_new_user()` die `id` des Auth-Benutzers in die
bestehende Profilzeile. Alle Verweise auf `profiles.id` tragen deshalb
`ON UPDATE CASCADE` — sonst würden Ränge, Gruppen und später Rückmeldungen ins Leere zeigen.

Bemerkenswerte Spalten:

| Spalte | Anmerkung |
|---|---|
| `full_name` | generiert aus Vor- und Nachname, für Suche und Sortierung |
| `email` | optional (Mitglieder ohne E-Mail sind möglich), aber eindeutig über `LOWER(email)` |
| `role` | `admin`, `team_leader`, `trainer`, `organizer`, `member`, `guest` |
| `status` | `active`, `pending_approval` (wartet auf Freischaltung), `unconfirmed` (angelegt/eingeladen) |
| `no_games` | reiner Trainingsteilnehmer, spielt keine Mannschaftsspiele |
| `contact_visible`, `hide_birthday` | Sichtbarkeit, die das Mitglied selbst steuert |
| `emails_copies` | Zusatzadressen für alle Benachrichtigungen, z. B. Eltern |
| `reminder_games_hours` | Vorlauf der Spielerinnerung, pro Mitglied (Default 24) |
| `auth_linked_at` | gesetzt, sobald ein Auth-Benutzer verknüpft ist |
| `deleted_at` | Soft-Delete; endgültiges Löschen nach 30 Tagen |

### `member_rankings`

Im TT-Planer steht am Mitglied je Altersklasse ein Rang wie „1.2". Hier ist das eine Zeile
je `ranking_type` mit `team_number` und `position_number` getrennt — sonst ließe sich nicht
auswerten, wer die Nummer 1 der zweiten Mannschaft ist.

### `groups`, `group_members`

Gruppen sind die Adressierungsdimension neben den Mannschaften: Trainings, Umfragen und die
Sichtbarkeit von Statistiken greifen darauf zu. Eine Gruppe hat, wie im TT-Planer, nur einen
Namen.

### `venues`

Orte mit Adresse. `max_games` ist die „maximale Anzahl gleichzeitiger Spieltermine" —
eine Grenze für die Terminplanung, **keine Tischbelegung**. Die gibt es im TT-Planer auch
nicht und wir bauen sie nicht.

### `private.cron_config`

Liegt im Schema `private`, das PostgREST nicht veröffentlicht. Ab Aufgabe 3.3 lesen die
pg_cron-Jobs hier die Funktions-URL und das Cron-Secret.

## Views

### `v_members_directory`

Mitgliederverzeichnis mit maskierten Kontaktdaten: E-Mail, Telefon und Geburtstag erscheinen
nur, wenn das Mitglied sie freigegeben hat, man selbst gemeint ist oder man Admin ist.

Sichtbarkeit von Spalten ist keine Zeilenfrage, deshalb eine View statt einer Policy.
`security_invoker = true` sorgt dafür, dass die RLS von `profiles` weiterhin für den
Aufrufer gilt — die View ist keine Hintertür.

## Funktionen

| Funktion | Zweck |
|---|---|
| `set_updated_at()` | Trigger, hält `updated_at` aktuell |
| `current_member_role()` | Rolle des angemeldeten Mitglieds. Heißt bewusst nicht `current_role()` — das ist in SQL bereits ein Schlüsselwort |
| `is_active_member()`, `is_admin()`, `is_organizer_or_admin()` | Rechteprüfungen für die Policies |
| `protect_profile_columns()` | Trigger: `role`, `status`, `qttr`, `member_number`, `no_games` darf nur ein Admin ändern |
| `handle_new_user()` | Trigger auf `auth.users`: verknüpft oder legt an (siehe unten) |
| `get_public_club_info()` | Vereinsname für den Anmeldebildschirm, ohne Anmeldung |
| `rpc_validate_registration_code(text)` | prüft den Vereinscode, gibt nur wahr/falsch zurück |

Alle Rechte-Helfer sind `SECURITY DEFINER` mit festem `search_path`. Ohne `DEFINER` liefe
die `profiles`-Policy in eine Rekursion, weil sie `profiles` liest, um `profiles` zu prüfen.

## Wie aus einem Login ein Mitglied wird

`handle_new_user()` läuft nach jedem Eintrag in `auth.users` und kennt genau drei Ausgänge:

1. **Es gibt ein Profil mit dieser E-Mail, das noch nicht verknüpft ist** → es wird
   übernommen: `id` wird zur Auth-ID, `auth_linked_at` gesetzt, `unconfirmed` wird `active`.
   Das ist der Weg für alle, die der Verein angelegt oder eingeladen hat.
2. **Kein Profil, aber ein gültiger `registration_code` in den Metadaten** → neues Profil
   mit `status = 'pending_approval'` und `role = 'member'`. Ein Admin schaltet frei.
3. **Sonst** → `RAISE EXCEPTION`. Eine unbekannte E-Mail bekommt kein Konto.

Zusammen mit `shouldCreateUser: false` beim Magic-Link-Login heißt das: Fremde können sich
nicht einfach registrieren, und der Verein behält die Kontrolle darüber, wer Mitglied ist.

## Rechte im Überblick

| Tabelle | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `club_settings` | aktive Mitglieder, außer `secret_*` | Admin |
| `profiles` | eigene Zeile immer; sonst aktive Mitglieder. Ein Gast sieht nur Admins und Trainer | eigene Zeile oder Admin; Spaltenschutz per Trigger |
| `member_rankings` | aktive Mitglieder | Admin |
| `groups`, `group_members` | aktive Mitglieder | Admin |
| `venues` | aktive Mitglieder | Admin |

`service_role` (Edge Functions) umgeht RLS — das ist gewollt und der Grund, warum der
`service_role`-Schlüssel niemals ins Frontend gehört.

## Typen für TypeScript

`src/lib/database.types.ts` wird erzeugt, nicht gepflegt:

```bash
npm run gen:types
```

Der Generator (`scripts/gen-types.mjs`) liest den Katalog über `psql`. `supabase gen types`
wäre der übliche Weg, startet aber einen Container — und in unserer Umgebung wie in der CI
gibt es keinen Docker-Daemon. Objekte, die zu einer Extension gehören (pgTAP, pgcrypto),
bleiben bewusst draußen, damit die erzeugten Typen lokal und in Supabase identisch sind.

Die CI prüft, dass die eingecheckte Datei zum Schema passt.
