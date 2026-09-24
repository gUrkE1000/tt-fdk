# Zielbild und Design: Vereinsplaner (Nachbau TT-Planer)

Stand: 17.09.2026 · Grundlage: [tt-planer-bestandsaufnahme.md](tt-planer-bestandsaufnahme.md) (Erhebung in der eingeloggten Anwendung, Champion-Umfang) und der Repo-Stand nach Übernahme von `dgaida/tt_hsv_planner`.

Dieses Dokument legt fest, **was** gebaut wird und **wie es aufgebaut ist**. Der
[Umsetzungsplan](umsetzungsplan.md) zerlegt es in Aufgaben. Bei Widerspruch gilt dieses Dokument;
Änderungen daran sind Planungsentscheidungen, keine Agentenentscheidungen.

---

## 1. Zieldefinition

### 1.1 Ein Satz

Eine vereinseigene, selbst gehostete Web-App (PWA), die den Funktionsumfang des TT-Planer-Champion-Pakets
für den Vereinsalltag abbildet — Mitglieder, Mannschaften, Spieltermine aus click-TT, Rückmeldungen,
Ersatzsuche, Training, Termine, Umfragen, Kalender, Benachrichtigungen — und an den zwei Stellen besser
ist, an denen der TT-Planer schwach ist: Transparenz der Ersatzkette und Aufstellung als kopierfertiger
Text mit allem, was der Spieler wissen muss.

### 1.2 Was „fertig" bedeutet (Abnahmekriterien auf Produktebene)

Die Lösung ist fertig, wenn ein Verein den TT-Planer kündigen kann, ohne dass ein Mannschaftsführer,
Trainer oder Mitglied eine der folgenden Tätigkeiten wieder über WhatsApp/Telefon erledigen muss:

| # | Tätigkeit | Nachweis |
|---|---|---|
| Z1 | Spieltermine erscheinen automatisch aus click-TT, Verlegungen werden erkannt | ICS-URL je Mannschaft hinterlegen → Termine erscheinen ≤ 24 h; Terminänderung → Rückmeldungen werden entwertet, Beteiligte informiert |
| Z2 | Spieler melden sich mit einem Klick zu/ab, auch von einem Link in der Benachrichtigung | Push/E-Mail enthält Link; Klick ohne weiteren Login speichert die Antwort |
| Z3 | ~~Bei Absage eines Stammspielers wird automatisch Ersatz gesucht~~ — **entfallen** (E-1, 24.09.2026): Der Mannschaftsführer fragt je Spiel an, wer spielen soll | Modus „Einzeln": Ersatz 1 angefragt → Ablehnung/Frist → Ersatz 2 …; Modus „Alle": alle angefragt, erste Zusage gewinnt, Rest storniert; Modus „Manuell": nichts automatisch. Leerlauf wird den Mannschaftsführern gemeldet |
| Z4 | Der Mannschaftsführer legt die Aufstellung fest und teilt sie | Dialog „Spieler verwalten" mit allen sechs Aktionen; „Aufstellung teilen" erzeugt kopierfertigen Text inkl. Ort, Fahrer, Hinweis |
| Z5 | Jeder wird erinnert, ohne dass jemand daran denken muss | Spiel: X h vorher pro Mitglied; Training: X h vorher pro Training; offene Rückmeldungen: täglicher Sammelhinweis |
| Z6 | Jeder bestimmt selbst, worüber und wie er informiert wird | Matrix Ereignistyp × Kanal (App-Push, E-Mail) pro Mitglied; Kopie-Adressen (Eltern) |
| Z7 | Training läuft ohne Zettel | Wiederkehrende Trainings, Teilnahme dabei/später/nicht, Ausfälle (einzeln, Zeitraum, je Ort), Feiertage/Ferien automatisch, Hallenschlüssel-Pflicht |
| Z8 | Vereinstermine, Umfragen, Abwesenheiten, Kalender | Termin mit Anmeldefrist und Teilnehmerliste; Umfrage (Abstimmung / Personen); Abwesenheit fließt in Aufstellung ein; Kalender Monat/Woche/Liste + ICS-Abo pro Mitglied |
| Z9 | Verwaltung ohne Entwickler | Admin pflegt Mitglieder (inkl. Excel-Import/-Export), Rollen, Gruppen, Ämter, Orte, Mannschaften, Vereinsdaten in der Oberfläche |
| Z10 | Datenschutz | Nur eingeloggte Mitglieder sehen Daten; Rechte werden in der Datenbank erzwungen; Kontaktdaten nur bei Freigabe sichtbar; Mitglied kann sich selbst löschen; Hosting EU |
| Z11 | Betrieb | Läuft auf Supabase Free/Pro + GitHub Pages; Sachkosten ≤ 80 €/Jahr; alle Zeitjobs in der Datenbank (pg_cron); Fehler sichtbar im Admin-Bereich |

### 1.3 Scope in drei Stufen

**Stufe A — Muss (ersetzt Champion-Kern).** Ohne das kann nicht gekündigt werden.

Mitglieder · Benutzerrollen · Gruppen · Vereinsdaten · Orte · Mannschaften mit Kader (Stamm/Ersatz + Rangfolge) ·
Spieltermine (ICS-Import, manuell) · Rückmeldungen · Aufstellung („Spieler verwalten", „Aufstellung teilen") ·
Fahrdienst/Verpflegung · Ersatzkette (3 Modi) · Spielverlegung (Terminumfrage) · Benachrichtigungen
(Matrix, Push, E-Mail, Erinnerungen) · Abwesenheiten · Training (komplett wie in E der Bestandsaufnahme) ·
Vereinstermine · Umfragen · Kalender (Monat/Woche/Liste, Kategorien, ICS-Abo) · Persönliches Dashboard ·
Mein Profil · Magic-Link-Login · PWA mit Push-Glocke · Einladung per E-Mail/Link/QR.

**Stufe B — Soll (hoher Nutzen, geringer Aufwand).** Nach Stufe A, vor Go-live wünschenswert.

Schlüsselverwaltung mit Übergabe · Nachrichten am Termin (Spiel/Training/Vereinstermin) · Vereinsneuigkeiten ·
Dateien · Excel-Import/-Update der Mitglieder · Ämter (Vereinsrollen) mit Kontaktdaten-Seite · Automatische
Trainingszusagen · NuScore-Code/PIN am Spiel (manuell; PDF-Import optional) · Statistik
Trainingsbeteiligung · „Anmelden als" (Eltern/Kind) · QTTR-Pflege im Profil.

**Stufe C — Nicht (bewusst).**

Chat als eigener Kanal (Verein/Mannschaft/persönlich) — WhatsApp bleibt; der Kommentar-Thread am
einzelnen Termin ist davon ausgenommen und bleibt in Stufe B · **Arbeitszeiten** · Trainer-Abrechnung ·
Inventar · Bekleidung · Sponsor-Logo · Ligenkatalog mit 1.657 Einträgen (stattdessen Freitext) ·
Braunschweiger System (nur Flag, keine Logik) · Vereinswechsel · Mehrsprachigkeit (nur Deutsch) ·
Tischbelegung (gibt es im TT-Planer auch nicht).

Entscheidung des Vereins vom 17.09.2026: Arbeitszeiten und Chat werden nicht gebaut. Der Thread am
Termin („Nachrichten (3)" auf der Karte) bleibt, weil er Rückfragen am konkreten Spiel bündelt.

### 1.4 Wo wir bewusst vom TT-Planer abweichen

| Thema | TT-Planer | Wir | Grund |
|---|---|---|---|
| Frist in der Ersatzkette | kein sichtbares Feld | `substitute_timeout_hours` je Mannschaft (Default 24), sichtbar am Request | Transparenz; Bestandsaufnahme nennt es als Schwäche |
| Kette leergelaufen | kein Signal | Benachrichtigung `substitute_chain_exhausted` an Mannschaftsführer | dito |
| Rückmeldung mit Bemerkung | nicht gefunden | Bemerkungsfeld an der Rückmeldung (aus Repo-Stand übernommen) | „komme erst 19:30" ist Alltag |
| Chat | eigener Kanal (Verein/Mannschaft/persönlich) | nur Kommentar-Thread am Termin | Ein zweiter Messenger neben WhatsApp wird nicht genutzt; Rückfragen gehören ans konkrete Spiel |
| Arbeitszeiten / Trainer-Abrechnung | vorhanden | nicht | Wird im Verein nicht gebraucht |
| Ligen | Katalog | Freitext je Mannschaft | Katalog ist Pflegeaufwand ohne Funktion |
| Bundesland | nicht sichtbar | explizite Vereinseinstellung | Feiertage/Ferien brauchen es eindeutig |
| Aufstellung teilen | Text ohne Ankunftszeit | Text inkl. Ankunftszeit (Heim 60 min, Auswärts 30 min vorher, je Mannschaft einstellbar) und Parallelspiel-Hinweis | aus Repo-Stand, bewährt |
| Erinnerung „offene Teilnahmen" | Frequenz unbekannt | täglich 18:00 für alles in den nächsten `open_reminder_days` (Default 14) Tagen, nur an Nichtantworter | definierte Regel statt Unklarheit |

### 1.5 Aufwandsrahmen (ehrlich)

Stufe A ≈ 350–450 Entwicklungsstunden, Stufe B ≈ 70–105 h (ohne Arbeitszeiten). Das ist kein Wochenendprojekt; der Vergleich mit
180 €/Jahr Abo steht in [recherche-tt-planer.md](recherche-tt-planer.md). Der Plan ist deshalb in **Releases**
geschnitten, die jeweils für sich nutzbar sind (siehe Umsetzungsplan Teil J), damit der Verein früh
Nutzen sieht und jederzeit anhalten kann.

---

## 2. Informationsarchitektur (Navigation)

Die Routen spiegeln den TT-Planer, damit Mitglieder, die ihn kennen, nichts neu lernen müssen.

```
/                    Übersicht (persönliches Dashboard)
/my-games            Meine Spiele
/my-dates            Meine Termine (+ Kalender abonnieren)
— Verein —
/my-club             Mein Verein: Neuigkeiten · Dateien · Mitglieder · Trainings · Vereinstermine · Mannschaften · Spiele · Rollen & Kontaktdaten
/statistics          Statistiken                                     [B]
— Planen —
/trainings           Trainings: Termine · Planung
/teams               Mannschaften (+ /teams/players-management)
/games               Spieltermine: Offene · Beendete (+ Import)
/dates               Vereinstermine: Offene · Beendete
/calendar            Kalender: Planung · Abwesenheiten
/votes               Umfragen
— Verwalten (Admin) —
/players             Mitglieder: Mitglieder · Gruppen
/club                Verein: Daten · Ämter · Neuigkeiten · Dateien · Übersicht
/venues              Orte & Schlüssel
— Kopfzeile —
/profile             Mein Profil: Profil · Abwesenheiten · Benachrichtigungen · Automatische Trainingszusagen
/logout
— ohne Login —
/login               Magic Link / Passwort
/r/:token            Antwort-Link (Ersatzanfrage, Rückmeldung, Umfrage) — speichert ohne Login
/register/:code      Registrierung per Link/QR
```

Sichtbarkeit von Menüpunkten hängt an der Rolle (Abschnitt 5). Mobil: Kopfzeile + Hamburger-Drawer mit
derselben Struktur; die vier wichtigsten Ziele (Übersicht, Meine Spiele, Trainings, Kalender) zusätzlich
als Bottom-Bar.

---

## 3. Domänenmodell

Alle Tabellen in Schema `public`, RLS aktiv, `id UUID DEFAULT gen_random_uuid()`, `created_at`, `updated_at`
(Trigger `set_updated_at`). Enum-Werte sind Englisch, UI-Labels Deutsch (Mapping in `src/lib/labels.ts`).

### 3.1 Verein, Mitglieder, Struktur

```
club_settings(key PK, value)                       -- siehe 3.8
profiles
  id (= auth.users.id nach Verknüpfung), first_name, last_name, email UNIQUE(lower), phone, mobile_phone,
  gender enum(male, female, unspecified), birthday date, member_number,
  role enum(admin, team_leader, trainer, organizer, member, guest) DEFAULT member,
  status enum(active, pending_approval, unconfirmed) DEFAULT unconfirmed,
  no_games bool, qttr int, contact_visible bool DEFAULT false, hide_birthday bool DEFAULT false,
  emails_copies text[] DEFAULT '{}', reminder_games_hours int DEFAULT 24,
  auth_linked_at, last_login_at, deleted_at (Soft-Delete für Selbstlöschung; Hard-Delete per Job nach 30 Tagen)
member_rankings(profile_id, ranking_type enum(...15 Werte...), team_number int, position_number int)  PK(profile_id, ranking_type)
groups(id, name UNIQUE)                            group_members(group_id, profile_id) PK
club_roles(id, name, description, activities text[])   -- Ämter (reine Darstellung) [B]
club_role_members(club_role_id, profile_id) PK
venues(id, name, address, postal_code, city, max_games int NULL, allow_training_at_max_games bool, training_only bool, active bool)
keys(id, name, venue_id NULL, responsible_id, holder_id NULL, no_forwarding bool)           [B]
key_handovers(id, key_id, from_profile_id NULL, to_profile_id, handed_at)                  [B]
login_delegations(delegate_id, target_id) PK  -- "Anmelden als" (Eltern) [B]
```

`ranking_type`-Werte: `men, women, seniors_40, seniors_50, seniors_60, seniors_70, seniors_75, youth_19,
youth_15, youth_13, youth_11, girls_19, girls_15, girls_13, girls_11`.

### 3.2 Mannschaften

```
teams
  id, name, color, size int NOT NULL (Stammspieler je Spiel), ranking_type, ranking int,
  leagues text[], lineup_mode enum(fixed, open) DEFAULT fixed,
  substitute_mode enum(sequential, parallel, manual) DEFAULT sequential,
  substitute_timeout_hours int DEFAULT 24,
  hide_users_no_ranking bool, block_participants_after date NULL,
  comment_home_games text, comment_away_games text,
  arrival_minutes_home int DEFAULT 60, arrival_minutes_away int DEFAULT 30,
  manual_request_auto_add bool DEFAULT true, hide_drivers_catering bool DEFAULT false,
  is_braunschweiger bool DEFAULT false,
  webcal_url text NULL, sync_enabled bool DEFAULT true, active bool DEFAULT true, sort_order int
team_leaders(team_id, profile_id) PK
team_members(team_id, profile_id, kind enum(regular, substitute), rank int NULL) PK(team_id, profile_id)
   -- Constraint per Trigger: count(regular) <= teams.size; substitute.rank UNIQUE je Team
```

### 3.3 Spieltermine und Beteiligung

```
matches
  id, team_id, source enum(ics, manual), external_uid NULL (UNIQUE(team_id, external_uid)),
  summary, opponent, league, description, location_text, venue_id NULL, is_home bool,
  dtstart_external, dtend_external,            -- was der Import liefert (bei manual = eingegeben)
  dtstart_override NULL, dtend_override NULL,  -- bestätigte Spielverlegung, bis click-TT nachzieht
  dtstart GENERATED ALWAYS AS (COALESCE(dtstart_override, dtstart_external)) STORED, dtend analog,
  required_players int NOT NULL (Default teams.size beim Anlegen), supervisor_id NULL,
  comment text, nuscore_code text, nuscore_pin text, matchday int,
  version int DEFAULT 1, active bool DEFAULT true, cancel_reason text,
  lineup_locked bool DEFAULT false, last_synced_at
match_participations
  match_id, profile_id, PK
  response enum(none, yes, no, unclear) DEFAULT none,
  version_responded int,               -- Antwort gilt nur, wenn = matches.version
  lineup_position int NULL,            -- gesetzt = steht in der Aufstellung (1..required_players, danach Ersatzbank)
  removed bool DEFAULT false,          -- „vorerst entfernt" durch MF
  comment text, source enum(auto, self, leader, request, link), updated_by NULL
match_volunteers(match_id, profile_id, kind enum(driver, catering)) PK
substitute_requests
  id, match_id, match_version, profile_id, rank int, status enum(pending, accepted, declined, expired, cancelled),
  created_by enum(system, leader), requested_at, expires_at, answered_at, token UUID UNIQUE
  UNIQUE(match_id, match_version, profile_id)
reschedule_polls(id, match_id, initiated_by, options timestamptz[] (1..3), status enum(open, closed, applied), chosen_index int NULL, created_at, closed_at)
reschedule_votes(poll_id, profile_id, option_index int, available bool) PK(poll_id, profile_id, option_index)
match_changes(id, match_id, change_type text, old_value jsonb, new_value jsonb, actor NULL, created_at)   -- Audit
sync_runs(id, started_at, completed_at, status enum(pending, success, warning, failed), summary jsonb)
```

### 3.4 Training

```
trainings
  id, name, type enum(adults, youth), weekday int (1=Mo..7=So), time_start time, time_end time NULL,
  venue_id NULL, rhythm enum(weekly, biweekly, monthly), start_date date, reminder_hours int DEFAULT 5,
  details text, max_participants int NULL, is_open bool, trainer_invites_only bool, is_incognito bool,
  requires_key_owner bool, skip_public_holidays bool, skip_school_holidays bool, hide_in_calendar bool,
  auto_cancel_no_trainers bool, statistics_visibility enum(all, admins, groups), active bool
training_trainers(training_id, profile_id) PK
training_members(training_id, profile_id) PK
training_statistics_groups(training_id, group_id) PK
training_sessions(id, training_id, session_date date, starts_at, ends_at, cancelled bool, cancel_reason, cancellation_id NULL, reminder_sent_at NULL)  UNIQUE(training_id, session_date)
training_cancellations(id, training_id NULL, venue_id NULL, from_date, to_date, reason, notify_email bool, created_by)
   -- genau eines von training_id / venue_id gesetzt
training_attendance(session_id, profile_id, status enum(yes, late, no), guests int DEFAULT 0, updated_at) PK
training_auto_attendance(profile_id, training_id, until_date, late bool) PK
holidays(id, bundesland char(2), kind enum(public, school), name, start_date, end_date)
```

Sessions werden **materialisiert**: ein Job erzeugt täglich alle Sessions bis 8 Wochen im Voraus aus
`trainings` (Rhythmus ab `start_date`), überspringt Feiertage/Ferien laut Flags und markiert Sessions in
`training_cancellations`-Zeiträumen als `cancelled`. Bereits existierende Sessions werden nie gelöscht, nur
aktualisiert (Teilnahmen bleiben erhalten).

### 3.5 Vereinstermine, Umfragen, Abwesenheiten, Sonstiges

```
club_events(id, name, full_day bool, starts_at, ends_at NULL, participate_until date NULL, max_participants NULL,
            address, description_html, hide_in_my_club bool, exclude_calendar bool, created_by, reminder_sent_at)
event_participations(event_id, profile_id, status enum(yes, no), guests int) PK
polls(id, title, details_html, type enum(vote, persons), max_answers int DEFAULT 1, expires_at NULL, hide_results bool, created_by)
poll_targets(poll_id, team_id NULL, group_id NULL)    -- leer = ganzer Verein
poll_options(id, poll_id, text, position)
poll_votes(option_id, profile_id) PK
absences(id, profile_id, start_date, end_date, comment_private)
news(id, title, body_html, published_at, author_id)                                  [B]
files(id, name, storage_path, size, uploaded_by, visibility enum(all, admins))       [B]
object_messages(id, target_type enum(match, training_session, event), target_id, author_id, body, created_at)  [B]
```

### 3.6 Benachrichtigungen

```
notification_preferences(profile_id, type, email bool, push bool) PK(profile_id, type)   -- fehlende Zeile = beide an
notifications(id, profile_id, channel enum(email, push), type, subject, body_text, payload jsonb,
              status enum(pending, sent, failed, skipped), scheduled_for, sent_at, attempts, error)
push_subscriptions(id, profile_id, endpoint UNIQUE, p256dh, auth, user_agent, failures, last_success_at)
calendar_tokens(profile_id PK, token UUID UNIQUE)      -- ICS-Abo pro Mitglied
action_tokens(token UUID PK, profile_id, action enum(match_response, substitute_answer, event_response, poll_vote),
              target_id, expires_at, used_at NULL)     -- Links in Benachrichtigungen ohne Login
```

**Ereignistypen** (Spalte `type`, Reihenfolge = Reihenfolge in der Einstellungs-Matrix):

| Typ | Label | Auslöser | Empfänger |
|---|---|---|---|
| `training_attendance_request` | Teilnahme am Training? | `reminder_hours` vor Session | zugeordnete Mitglieder ohne Antwort |
| `reschedule_poll` | Terminumfrage für Spielverlegung | Umfrage gestartet | verfügbare Spieler der Mannschaft |
| `reschedule_confirmed` | Bestätigung der Spielverlegung | MF wählt Termin | Kader |
| `substitute_request` | Ersatzanfrage an dich gestellt | Engine/MF erstellt Request | Angefragter |
| `substitute_found` | Ersatz erfolgreich gefunden | Request accepted | ursprünglich abgesagter Stammspieler + MF |
| `match_created` | Neues Mannschaftsspiel angelegt | Import/manuell | Kader |
| `event_invitation` | Einladung für Vereinstermin | Termin angelegt | alle aktiven Mitglieder |
| `match_reminder` | Erinnerung an Spieltermin | `reminder_games_hours` (pro Mitglied) vor Spiel | Aufstellung + offene Kaderspieler |
| `event_reminder` | Erinnerung an Vereinstermin | 24 h vor Termin | Zusagende |
| `match_assigned` | Mannschaftsspiel zugeordnet | MF fügt Spieler hinzu / setzt Aufstellung | Spieler |
| `open_participations` | Erinnerung an offene Spiel- und Terminteilnahmen | täglich 18:00 | Mitglieder mit offenen Antworten in `open_reminder_days` |
| `object_message` | Neue Nachricht im Training, Spiel oder Vereinstermin | Nachricht [B] | Beteiligte |
| `training_cancelled` | Benachrichtigung bei Trainingsausfall | Ausfall angelegt | zugeordnete Mitglieder |
| `substitute_chain_exhausted` | Kein Ersatz gefunden (**Zusatz**) | Kette leer | Mannschaftsführer |
| `match_changed` | Spieltermin geändert (**Zusatz**) | Sync erkennt Verlegung/Absage | Kader |

Direkt-E-Mails ohne Matrix (immer, wie im TT-Planer): Spieler hinzugefügt/entfernt/auf Absage gesetzt
durch MF; Einladung; Willkommen nach Freischaltung; Ausfall mit Checkbox „sofort per E-Mail".

Jede E-Mail geht zusätzlich als Kopie an `profiles.emails_copies`.

### 3.7 Abgeleitete Sichten (Views, für Frontend-Queries)

- `v_match_lineup_status(match_id, profile_id, status)` mit `status` ∈ `lineup, open, declined, unclear, absent, removed`
  — genau die Abschnitte des Dialogs „Spieler verwalten"; `absent` aus `absences` über `dtstart`.
- `v_my_upcoming(profile_id, kind, id, starts_at, title, my_status)` — Dashboard/Meine Termine/ICS-Abo.
- `v_open_participations(profile_id, kind, id, starts_at)` — Grundlage für den täglichen Sammelhinweis.

### 3.8 Vereinseinstellungen (`club_settings`)

`club_name, club_short_name, club_aliases, website_url, facebook_url, instagram_url, youtube_url, whatsapp_url,
about_html, welcome_email_html, bundesland (Default 'NW'), timezone ('Europe/Berlin', fest), app_url,
open_reminder_days ('14'), open_reminder_time ('18:00'), event_reminder_hours ('24'),
notification_sender_name, notification_sender_email, registration_code (für Link/QR), default_venue_id`.

---

## 4. Verhalten: Zustandsautomaten

### 4.1 Rückmeldung und Aufstellung eines Spiels

Für jede Person im Kader (regular + substitute) existiert ab Anlage des Spiels eine `match_participations`-Zeile
mit `response=none`. Andere Mitglieder erhalten eine Zeile, sobald sie sich selbst eintragen oder
hinzugefügt werden.

```
response:  none ──(Spieler/Link/MF)──> yes | no | unclear ──(MF „zurücksetzen")──> none
removed:   false ──(MF 👤−)──> true ──(MF 👤+ / zurücksetzen)──> false
lineup_position:
  lineup_mode = fixed:
     regular mit response=yes und removed=false  → automatisch Position nach team_members.rank-unabhängiger Reihenfolge
        (Reihenfolge: member_rankings.position_number der Mannschaft, dann Name); Positionen > required_players = Ersatzbank
     substitute/andere mit yes → hinter den regulars
     MF darf jede Position manuell setzen; ab dann lineup_locked=true und die Automatik fasst das Spiel nicht mehr an
  lineup_mode = open:
     niemand automatisch; MF setzt Positionen im Dialog (Vorschlag: alle yes in Rangfolge)
Sync erhöht version → alle response=none (Zeile bleibt, version_responded < version), lineup_position bleibt, MF wird gewarnt
```

Konflikt „Spieltermin am gleichen Tag" (Dialog-Abschnitt 7): Spieler mit `response=yes` bei einem anderen
Spiel innerhalb ±3 h.

### 4.2 Ersatzkette

Auslöser: `match_participations` eines **regular** wechselt auf `no` (oder MF setzt ⊖) **und** Anzahl
`lineup`-Spieler < `required_players` **und** `lineup_locked=false` **und** `substitute_mode ≠ manual`.

```
sequential: nimm ersten substitute nach rank, der: keine Zeile mit response≠none für diese version hat,
            keinen Request (irgendein Status) für diese version hat, nicht abwesend ist
            → request(pending, expires_at = now + timeout) → Benachrichtigung
            Antwort yes → accepted; Spieler bekommt response=yes und (fixed) lineup_position; substitute_found an Absager + MF
            Antwort no / Frist → declined/expired → nächster
            keiner mehr → substitute_chain_exhausted an MF (einmal je match_version)
parallel:   alle Kandidaten gleichzeitig → erste Zusage accepted, alle anderen pending → cancelled
manual:     nichts automatisch. MF erstellt Requests per „?"; bei Zusage und manual_request_auto_add → in Aufstellung
Aufräumen (jeder Lauf): Spiel inaktiv / vorbei / version geändert / genug Spieler → pending → cancelled
```

Die Regeln sind als reine Funktion `planSubstituteStep(input): Action[]` implementiert (Umsetzungsplan 5.2)
und laufen (a) sofort nach jeder relevanten Antwort per Function-Aufruf, (b) alle 10 Minuten per Cron
für Fristen.

### 4.3 Spielverlegung

```
MF startet Umfrage (1..3 Optionen) → reschedule_poll(open) → reschedule_poll-Benachrichtigung an Kader mit response≠no
Spieler stimmt je Option „kann / kann nicht" (auch per Link)
Alle Angeschriebenen haben abgestimmt ODER MF schließt manuell → status closed, MF benachrichtigt
MF wählt Option → dtstart_override gesetzt, version+1, reschedule_confirmed an Kader, status applied
Sync: liefert click-TT später dtstart_external = dtstart_override → override wird auf NULL gesetzt (Termin „offiziell");
      liefert click-TT ein anderes Datum → override bleibt, MF wird gewarnt (match_changed mit Hinweis)
```

### 4.4 Training

```
Session-Erzeugung täglich: für jedes aktive Training alle Termine bis heute+56 Tage nach Rhythmus ab start_date
   – Feiertag (holidays.kind=public, bundesland) und skip_public_holidays → keine Session
   – Schulferien (kind=school) und skip_school_holidays → keine Session
   – innerhalb training_cancellations (training_id oder venue_id passend) → Session cancelled mit reason
Teilnahme: none → yes | late | no (+ guests), jederzeit änderbar bis Sessionbeginn
Auto-Zusage: bis until_date wird bei Session-Erzeugung attendance yes/late gesetzt (source auto), änderbar
auto_cancel_no_trainers: alle Trainer no → Session cancelled („alle Trainer abgesagt"), training_cancelled an Mitglieder
requires_key_owner: Warnhinweis in der Session-Karte, wenn kein zugesagter Teilnehmer aktueller Schlüsselinhaber eines Schlüssels des Ortes ist
Erinnerung: reminder_hours vor starts_at an zugeordnete Mitglieder (bzw. bei is_open: alle aktiven) ohne Antwort — je Mitglied nur, wenn Training in seiner Erinnerungsauswahl (leer = alle)
```

### 4.5 Mitgliedsstatus

```
unconfirmed (per Einladung/Import angelegt, noch nie eingeloggt)
  → active bei erstem Magic-Link-Login, wenn per Einladung/Import angelegt
pending_approval (Selbstregistrierung per Link/QR) → active durch Admin („freischalten", löst Willkommens-E-Mail aus)
active → deleted_at gesetzt (Selbstlöschung oder Admin) → nach 30 Tagen Hard-Delete (Job)
```

---

## 5. Rechte

Sechs Benutzerrollen wie im TT-Planer. Was „Organisator" darf, ist dort undokumentiert — hier festgelegt.

| Funktion | admin | team_leader | trainer | organizer | member | guest |
|---|---|---|---|---|---|---|
| Alles lesen (Mitglieder, Termine, Spiele) | ja | ja | ja | ja | ja | nur eigene Trainings/Termine |
| Kontaktdaten anderer sehen | ja | nur bei `contact_visible` | dito | dito | dito | nein |
| Eigene Rückmeldungen/Abwesenheiten/Profil/Benachrichtigungen | ja | ja | ja | ja | ja | ja |
| Mannschaften anlegen/bearbeiten/löschen, Kader | ja | Kader nur eigener Teams | nein | nein | nein | nein |
| Spieler verwalten, Ersatzanfragen, Aufstellung teilen, Spielverlegung | ja | eigene Teams | nein | nein | nein | nein |
| Spieltermine anlegen/importieren/bearbeiten | ja | eigene Teams | nein | nein | nein | nein |
| Trainings anlegen/bearbeiten, Ausfälle, Mitglieder zuweisen | ja | nein | eigene Trainings | nein | nein | nein |
| Inkognito-Teilnehmerliste sehen | ja | nein | eigene Trainings | nein | nein | nein |
| Vereinstermine, Umfragen, Neuigkeiten, Dateien anlegen | ja | nein | nein | **ja** | nein | nein |
| Mitglieder anlegen/einladen/bearbeiten/freischalten, Rollen, Gruppen, Ämter, Orte, Vereinsdaten | ja | nein | nein | nein | nein | nein |
| Abwesenheiten anderer bearbeiten | ja | nein | nein | nein | nein | nein |
| Sync-Läufe, Benachrichtigungsprotokoll, Einstellungen | ja | nein | nein | nein | nein | nein |

„Eigene Teams" = `team_leaders`, „eigene Trainings" = `training_trainers`. Guest sieht nur Trainings mit
`is_open` bzw. Zuordnung und Vereinstermine; keine Mitgliederliste.

Durchsetzung: RLS-Policies je Tabelle mit den Helferfunktionen `current_role()`, `is_admin()`,
`leads_team(team_id)`, `trains(training_id)`, `is_organizer_or_admin()`. Spaltenschutz per Trigger
(`role`, `status`, `qttr`, `member_number`, Rangdaten nur admin). Service Role (Edge Functions) umgeht RLS.

---

## 6. UI-Design

### 6.1 Prinzipien

1. **Mobil zuerst.** Die Hauptnutzung ist das Handy nach der Push-Benachrichtigung: eine Frage, ein Tipp,
   fertig. Jede Rückmeldung ist mit maximal zwei Tipps erledigt; Antwort-Links aus Benachrichtigungen
   erledigen sie mit einem.
2. **Zustand sichtbar.** Jede Karte zeigt ihren Status farbig (Aufstellung n/size als Balken, eigener
   Status als Badge, Ersatzkette als Schrittleiste). Nichts ist „irgendwo im Menü".
3. **Deutsch, kurz, du.** Beschriftungen wie im TT-Planer (Bin dabei / Komme später / Bin nicht dabei;
   Spieler verwalten; Aufstellung teilen).
4. **Wenig Dialoge, wenn möglich Inline.** Rückmeldung inline auf der Karte; nur Verwaltung in Dialogen.
5. **Keine Überraschungen für Admins.** Alles, was das System automatisch tut (Sync, Erinnerung,
   Ersatzanfrage), ist im Admin-Bereich als Protokoll sichtbar.

### 6.2 Layout

- Desktop ≥ 1280 px: feste Seitenleiste 256 px links (Logo/Vereinsname, Navigation in drei Gruppen,
  Fußbereich mit Versionsnummer), Kopfzeile mit Seitentitel, Glocke, Profilmenü. Inhalt max. 1200 px.
- Tablet/Mobil: Kopfzeile mit Hamburger (Drawer = Seitenleiste), Bottom-Bar mit Übersicht · Meine Spiele ·
  Trainings · Kalender · Mehr. Tabellen werden ab < 768 px zu Kartenlisten.
- Seitenaufbau: Titel + Primäraktion rechts (z. B. „Training anlegen"), darunter Tab-Leiste, darunter
  Filterzeile (Suche, Auswahlfelder, Zeitraum, Zurücksetzen), dann Inhalt.

### 6.3 Design-Tokens (Tailwind-Konfiguration)

```
Farben (semantisch → Tailwind):
  primary       teal-600 / hover teal-700 / soft teal-50        (Aktionen, aktive Navigation)
  surface       white, page bg gray-50, border gray-200
  text          gray-900 / secondary gray-600 / muted gray-400
  status.yes    emerald-600 (soft emerald-50)     status.late/unclear amber-500 (amber-50)
  status.no     rose-600 (rose-50)                status.open gray-400 (gray-100)
  status.absent slate-500 (slate-100)             status.removed gray-700 durchgestrichen
  danger        rose-600      warning amber-500      info sky-600      success emerald-600
Kalender-Kategorien: Trainings sky-500 · Spiele teal-600 · Vereinstermine violet-500 · Geburtstage pink-500 ·
  Ereignisse gray-500 · Halle nicht verfügbar rose-500 (Ganztag)
Mannschaftsfarbe: teams.color als 4-px-Balken links an Spielkarten und als Punkt im Kalender
Typografie: system-ui Stack; Basis 16 px; Titel 20/24 px semibold; Karten-Titel 16 px semibold; Meta 12–13 px
Abstände: 4-px-Raster; Karten p-4, Abstand zwischen Karten 12 px; Seitenrand 16 px mobil, 24 px Desktop
Radius: Karten/Buttons rounded-xl; Badges rounded-full
Touch: min. 44 × 44 px für alle Aktionen; Rückmelde-Buttons volle Breite auf Mobil, dreigeteilt
Dark Mode: Phase B (Tokens sind so gewählt, dass `dark:`-Varianten später nachgezogen werden können)
```

### 6.4 Komponentenbibliothek (`src/components/ui/`)

`Button` (primary/secondary/ghost/danger, sizes sm/md/lg, loading) · `IconButton` · `Badge` (status-Varianten) ·
`Card` (+ `CardHeader`, `CardBody`, `CardFooter`) · `Tabs` · `Dialog` (Radix-basiert) · `Drawer` · `Toast` ·
`FormField` (Label, Hilfetext, Fehler) · `Input`, `Select`, `MultiSelect`, `DateInput`, `TimeInput`, `Checkbox`,
`Textarea`, `ColorInput`, `SortableList` (Drag & Drop für Ersatzreihenfolge) · `Table` (responsiv) ·
`EmptyState` · `ProgressBar` · `Avatar` (Initialen) · `PersonPicker` · `PageHeader` · `FilterBar` · `StatTile`.

Radix UI Primitives für Dialog/Popover/Tabs/Checkbox (barrierefrei, ungestylt); `@dnd-kit` für Sortierung;
`@fullcalendar/react` für Kalenderansichten.

### 6.5 Schlüsselbildschirme

**Spielkarte** (Dashboard, Meine Spiele, Spieltermine, Mein Verein):
Kopf: Datum · Uhrzeit · Badge HEIM/AUSWÄRTS · Mannschaftsbadge in Teamfarbe · Gegner · Liga.
Zeile Ort mit „Adresse anzeigen". Aufstellungsbalken „3/4" mit Avataren. Eigener Status als drei Buttons
(Zusage / Unsicher / Absage) + Bemerkung. Fahrer/Verpflegung-Toggles (wenn nicht ausgeblendet).
MF-Leiste: Spieler verwalten · Aufstellung teilen · Spielverlegung. Ersatzkette als Schrittleiste
(Name · Status · Frist), wenn aktiv.

**Dialog „Spieler verwalten"**: Kopf (Mannschaft, Gegner, Termin, Balken n/required). Abschnitte in der
Reihenfolge der Bestandsaufnahme: Aufstellung · Offene Spieler (+ Andere Spieler) · Abwesende · Manuell
entfernt · Absagen · Unklar · Spieltermin am gleichen Tag · Erklärung der Aktionen. Je Zeile Aktions-Icons
👤+ 👤− ⊖ ? ↺ 🗑 mit Tooltip-Text exakt wie in der Bestandsaufnahme.

**Dialog „Aufstellung teilen"**: Textblock (Format aus Bestandsaufnahme, ergänzt um Ankunftszeit und
Standard-Hinweis der Mannschaft), Button „In Zwischenablage kopieren", zweiter Button „Per E-Mail an
Aufstellung senden".

**Trainings-Karte**: Datum/Uhrzeit · Name · Ort · Trainer · Teilnehmer n(/max) mit Liste (außer Inkognito) ·
drei Buttons dabei/später/nicht · Gäste-Feld · Hinweis „Schlüssel: <Name>" oder Warnung.

**Benachrichtigungs-Matrix**: Tabelle Typ × (App, E-Mail) mit Checkboxen, darunter Vorlauf Spiele
(Stunden), Trainingsauswahl für Erinnerungen, Kopie-Adressen. Speichern-Button sticky unten.

**Glocke** (Kopfzeile): drei Zustände aktivieren (blau) / aktiv (grün) / blockiert (rot) mit Hilfetext für iOS.

---

## 7. Technische Architektur

### 7.1 Stack (bestätigt, ergänzt)

| Schicht | Wahl | Anmerkung |
|---|---|---|
| Frontend | React 18, TypeScript strict, Vite, Tailwind | aus Basis |
| Routing | `react-router-dom` v6 | Routen aus Abschnitt 2 |
| Datenzugriff | `@tanstack/react-query` + `supabase-js`; generierte DB-Typen (`supabase gen types`) in `src/lib/database.types.ts` | keine rohen `from()`-Aufrufe in Komponenten — nur in `features/*/api.ts` |
| Formulare | `react-hook-form` + `zod` | ein Muster für alle Formulare |
| UI-Primitives | Radix UI, `lucide-react`, `@dnd-kit`, `@fullcalendar/react`, `date-fns` + `date-fns-tz` | |
| PWA | `vite-plugin-pwa` (injectManifest), Web Push (VAPID) | |
| Backend | Supabase: Postgres + RLS, Auth (Magic Link, Passwort), Storage (Dateien [B]), Edge Functions (Deno), pg_cron + pg_net | EU-Region |
| E-Mail | Resend (API + als SMTP für Auth-Mails) | Free-Tier reicht für einen Verein |
| Tests | Vitest + Testing Library (Frontend), pgTAP (`supabase test db`) für RLS und Trigger | |
| CI/CD | GitHub Actions: Typecheck+Tests bei PR, Deploy Pages + Edge Functions bei `main` | |

### 7.2 Ordnerstruktur

```
src/
  app/            router.tsx, layout/ (Sidebar, Header, BottomBar), providers.tsx, guards.tsx (Rolle)
  components/ui/  Design-System-Primitives (6.4)
  features/
    auth/         login, magic link, session, register-by-code
    dashboard/    Übersicht
    members/      Mitglieder, Gruppen, Einladung, Excel [B]
    club/         Vereinsdaten, Ämter [B], Neuigkeiten [B], Dateien [B], Übersicht
    venues/       Orte, Schlüssel [B]
    teams/        Mannschaften, Kader, Sammelbearbeitung
    matches/      Spieltermine, Import, Karte, Spieler verwalten, Aufstellung teilen, Verlegung, Fahrdienst
    substitutes/  Ersatzkette (UI + Client-Trigger)
    trainings/    Trainings, Sessions, Ausfälle, Auto-Zusage
    events/       Vereinstermine
    polls/        Umfragen
    calendar/     Kalender, Abwesenheiten, ICS-Abo
    notifications/ Einstellungs-Matrix, Glocke, Push-Registrierung
    profile/      Mein Profil
    admin/        Sync-Protokoll, Benachrichtigungsprotokoll, Einstellungen
  lib/            supabaseClient, database.types, labels (Enum→Deutsch), dates, clubSettings, whatsappText, icsParser
supabase/
  migrations/     Baseline v2 + Folgemigrationen
  functions/      _shared/ (reine Logik) · sync-calendars · process-notifications · enqueue-reminders ·
                  substitute-engine · generate-training-sessions · invite-member · calendar-feed · action-link
  tests/          pgTAP
  seed.sql        lokale Entwicklungsdaten
```

Je Feature: `api.ts` (Queries/Mutations mit react-query), `types.ts`, `components/`, `hooks.ts`, `routes.tsx`.

### 7.3 Datenfluss-Regeln

- **Schreibzugriffe** laufen über supabase-js mit dem Nutzer-JWT; die Datenbank entscheidet (RLS + Trigger).
  Komplexe Aktionen mit Nebenwirkungen (Benachrichtigungen erzeugen) laufen als **RPC** (`SECURITY DEFINER`
  Postgres-Funktionen), nicht als mehrere Client-Statements: `rpc_set_match_response`, `rpc_manage_player`,
  `rpc_start_reschedule_poll`, `rpc_apply_reschedule`, `rpc_set_training_attendance`, `rpc_answer_action_token`.
- **Zeitgesteuertes** läuft in Edge Functions, angestoßen durch pg_cron über pg_net (Konfiguration in Schema
  `private`): `sync-calendars` täglich 04:00, `generate-training-sessions` täglich 03:00,
  `enqueue-reminders` alle 10 min, `substitute-engine` alle 10 min, `process-notifications` alle 5 min,
  `purge-deleted` täglich 02:00.
- **Benachrichtigungen** entstehen ausschließlich über die SQL-Funktion `enqueue_notification(profile_id, type,
  payload)`, die Matrix, Kanäle, Kopie-Adressen und Texte (Templates in SQL-Tabelle `notification_templates`)
  auflöst. Damit können Trigger und Edge Functions denselben Weg nutzen.
- **Antwort-Links**: `<app_url>/r/<token>?a=<answer>` → Frontend ruft `rpc_answer_action_token` (für `anon`
  erlaubt) → Bestätigungsseite. Tokens sind einmalig, laufen mit dem Ereignis ab.
- **Externe Daten**: nur ICS-Abruf in `sync-calendars` (serverseitig, kein CORS-Proxy mehr). Der
  clientseitige Proxy-Fallback des Basis-Projekts entfällt.

### 7.4 Was aus dem Basis-Repo übernommen wird

| Übernommen | Wohin | Änderung |
|---|---|---|
| `icsParser.ts` (parseIcs, Zeitzonen, extractMatchday) | `supabase/functions/_shared/ics.ts` + Re-Export in `src/lib` | unverändert, Tests mit |
| Home/Away-Erkennung | `_shared/homeAway.ts` | Alias-Liste statt fester Name |
| Sync-Logik (Versionierung, Sicherheitssperre) | `_shared/syncPlanner.ts` (rein) + Edge Function | in reine Planung + Anwendung getrennt |
| WhatsApp-/Aufstellungstext | `src/lib/lineupText.ts` | Format aus Bestandsaufnahme + Ankunftszeit + Hinweise |
| Aufstellungs-Sortierregel (yes > yes_sub > none > maybe > no, Rang) | `_shared/lineupOrder.ts` | `yes_sub` entfällt (ersetzt durch Ersatzbank-Positionen) |
| Namens-Utilities | `src/lib/names.ts` | |
| Vereinspasswort-Gate | entfällt | Magic Link ersetzt es; Registrierung per Code/QR deckt „Schutz vor Fremden" ab |

Alles andere (Komponenten, Tabs-App, Passwort-Gate, Client-Sync mit Proxies, Kader-HTML-Import) wird
nicht weitergeführt. Der HTML-Kader-Import entfällt, weil der TT-Planer ihn auch nicht hat und Ränge
über den Excel-Import/Profil gepflegt werden; er kann später als [B] zurückkommen.

---

## 8. Nicht-funktionale Festlegungen

- **Zeit**: alle Zeitstempel `timestamptz`; Anzeige in `Europe/Berlin`; Tagesgrenzen (Abwesenheiten,
  Feiertage) sind `date`.
- **Performance**: Listen paginiert (50), Dashboard-Queries über Views; erste Anzeige < 2 s auf 4G.
- **Barrierefreiheit**: Radix-Primitives, Fokus-Reihenfolge, Kontrast ≥ 4.5:1, Statusfarben immer mit Text/Icon.
- **Datenschutz**: Verarbeitungsverzeichnis und AV-Vertrag (Supabase, Resend) als Dokumente in `docs/datenschutz/`
  vor Go-live; Löschkonzept (Soft-Delete 30 Tage); Kontaktdaten-Sichtbarkeit opt-in; Geburtstag ausblendbar.
- **Betrieb**: Admin-Seite zeigt letzte Sync-Läufe, Benachrichtigungsfehler, Cron-Zustand; Fehler in
  Edge Functions landen in `sync_runs`/`notifications.error`, nie stumm.
- **Tests**: reine Logik ≥ 90 % Zeilen; jede RLS-Policy hat mindestens einen positiven und einen negativen
  pgTAP-Fall; jede Route hat einen Smoke-Test.
