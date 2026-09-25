# Datenbank

Referenz zum Schema. Verbindlich ist immer die Migration in `supabase/migrations/`;
dieses Dokument erklärt, warum etwas so aussieht.

Stand: Verein, Mitglieder, Ränge, Gruppen, Orte, Abwesenheiten, Mannschaften, Spiele,
Beteiligung, Benachrichtigungen (E-Mail und Push), Training, Vereinstermine, Umfragen,
Kalender, ICS-Abo, die Betriebssicht, die Schlüsselverwaltung, die Ämter, die Neuigkeiten und die
Nachrichten am Termin. Es fehlen noch die übrigen Stufe-B-Tabellen (Phase 9).

Die Baseline `20261001000000_schema_v2.sql` ist eingefroren; jede Änderung danach ist eine
eigene Migration.

## Aufbewahrung und Löschung

`run_retention()` läuft täglich um 2 Uhr (pg_cron-Job `retention`) und setzt die Fristen
aus `club_settings` durch: gelöschte Konten nach 30 Tagen endgültig, Benachrichtigungen
und Betriebsprotokolle nach einem Jahr, Abwesenheiten zwei Jahre nach Ende, abgelaufene
Aktions-Token nach 30 Tagen.

Das war lange eine offene Flanke: Die Baseline versprach im Kommentar „endgültig nach 30
Tagen", aber es gab keinen Job dafür — ein gelöschtes Mitglied blieb mit Name und
Geburtsdatum unbegrenzt stehen, nur unsichtbar. Die Begründung der Fristen steht in
`docs/datenschutz/loeschkonzept.md`.

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
| `quicklinks_json` | Links der Übersicht als JSON-Array `[{"label":…,"url":…}]` (Aufgabe 8.1) |
| `privacy_url`, `imprint_url` | Datenschutzhinweis und Impressum; verlinkt in Fußzeile und Registrierung (Aufgabe 10.1) |
| `retention_*_days` | Aufbewahrungsfristen, die `run_retention()` täglich durchsetzt (Aufgabe 10.1) |

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

### `absences`

Zeiträume, in denen jemand nicht kann. `comment_private` ist der Grund und geht niemanden
außer dem Mitglied etwas an — Mannschaftsführer und Trainer sehen über `v_absences` nur
den Zeitraum. Ab Phase 3 zieht die Aufstellungsplanung diese Zeiträume heran.

### `venues`

Orte mit Adresse. `max_games` ist die „maximale Anzahl gleichzeitiger Spieltermine" —
eine Grenze für die Terminplanung, **keine Tischbelegung**. Die gibt es im TT-Planer auch
nicht und wir bauen sie nicht.

### `teams`, `team_leaders`, `team_members`

Eine Mannschaft hat eine feste Größe (`size`) — so viele stehen je Spiel am Tisch. Wer
darüber hinaus dazugehört, ist Ersatz und hat einen `rank`: die Reihenfolge in der Auswahl
„Spieler anfragen" und in der Aufstellung. Ein Trigger verhindert mehr Stammspieler als
`size`, ein eindeutiger Teilindex doppelte Ersatzränge.

Wer zu einer Mannschaft gehört (Kader oder Führung), sieht ihre Spiele —
`can_see_match(uuid)` ist die eine Regel dafür, an der die Policies von `matches`,
`match_participations`, `match_volunteers`, den Terminumfragen und den Nachrichten am
Spiel hängen. Außerdem sieht ein Spiel, wer dafür angefragt ist, und der Admin.

### Anfragen und `match_offers`

Eine Zeile in `match_participations` heißt: **angefragt**. Ein neues Spiel hat keine; der
Mannschaftsführer legt sie mit `rpc_request_players(uuid[], uuid[])` an — für mehrere
Spiele auf einmal, wer schon eine Zeile hat, wird übersprungen. Zu- oder absagen kann nur,
wer eine Zeile hat. `rpc_withdraw_request` nimmt eine unbeantwortete Anfrage zurück.

`match_offers` hält „Ich hätte Zeit": Wer das Spiel sieht, aber nicht gefragt ist, meldet
sich mit `rpc_offer_match`; die Mannschaftsführung bekommt `match_offer`. Sobald die
Person eine Zeile in `match_participations` bekommt (angefragt oder aufgestellt), löscht
ein Trigger das Angebot. Lesen dürfen die Person selbst, die Mannschaftsführung und der
Admin.

### Nachrichten an die Mannschaftsführung

Seit alle Mannschaften auf „von Hand" stehen, meldet die Ersatzkette nichts mehr. Die
Mannschaftsführung erfährt deshalb auf zwei anderen Wegen, was sie tun muss
(Migration `leader_notifications`):

- **Absage:** Der Trigger `match_participations_notify_declined` schickt `match_declined`,
  wenn ein Spieler selbst absagt — in der App (`source = 'self'`) oder über den Link
  (`'link'`). Die Nachricht nennt die Bemerkung und den Stand der Zusagen gegen
  `required_players`. Keine Nachricht, wenn der Mannschaftsführer selbst jemanden auf
  Absage setzt, wenn schon abgesagt war, oder wenn das Spiel vorbei oder abgesagt ist.
- **Neue Spiele gesammelt:** `notify_match_created` legt `match_players_needed` mit
  zehn Minuten Verzögerung (`match_batch_delay()`) an. Kommt in der Zeit ein weiteres
  Spiel, wird die noch nicht verschickte Nachricht (`status = 'pending'`) gelöscht und mit
  allen Spielen neu angelegt; `match_batch_payload(uuid[])` baut Betreff, Liste und Link
  (ein Spiel: `/match/<id>`, mehrere: `/my-games`). Was der Versand schon beansprucht hat,
  bleibt unberührt.

### `matches`

`dtstart` und `dtend` sind **generierte Spalten** aus `*_override` und `*_external`. Der
Termin aus click-TT und eine bestätigte Verlegung stehen nebeneinander, statt sich zu
überschreiben — nur so bleibt erkennbar, ob der Verband inzwischen nachgezogen hat.

`version` zählt hoch, sobald ein Abgleich Termin oder Ort ändert. Alte Zusagen bleiben
stehen, gelten aber nicht mehr (`version_responded < version`). Niemand bleibt
stillschweigend eingeplant, nur weil er vor der Verlegung zugesagt hatte.

### `match_participations`

Je Person im Kader eine Zeile, angelegt vom Trigger `seed_match_participations`. **Direkt
beschreibbar ist die Tabelle für niemanden** — es gibt bewusst keine INSERT-, UPDATE- oder
DELETE-Policy. Jede Änderung geht durch eine RPC, die Rechte prüft, den Vorgang
protokolliert und die Aufstellung neu berechnet. Eine Policy allein könnte das nicht.

`lineup_position` gesetzt heißt: steht in der Aufstellung. Positionen über
`matches.required_players` hinaus sind die Ersatzbank.

### `match_volunteers`, `match_changes`, `sync_runs`

Fahrdienst und Verpflegung; das Prüfprotokoll aller RPC-Aufrufe (lesbar für Admin und
Mannschaftsführer); die Läufe des Kalenderabgleichs.

### `notification_templates`, `notification_preferences`, `notifications`

Benachrichtigungen folgen dem Ausgangspostfach-Muster: Auslöser schreiben Zeilen in
`notifications`, ein Hintergrundlauf verschickt sie. Drei Gründe:

1. Eine Datenbanktransaktion darf nicht auf einen E-Mail-Dienst warten.
2. Scheitert der Versand, liegt die Zeile noch da und wird erneut versucht.
3. Was verschickt wurde, lässt sich nachlesen. Bei „ich habe nie eine Mail bekommen" ist
   das der einzige Weg, die Frage zu beantworten.

Der Text wird **beim Einreihen** gerendert, nicht beim Versand: die Vorlage kann sich
ändern, die verschickte Nachricht soll es nicht.

Eine fehlende Zeile in `notification_preferences` heißt „beide Kanäle an". Damit braucht
ein neues Mitglied keine fünfzehn Zeilen, und ein neuer Ereignistyp ist sofort für alle
aktiv. Vorlagen mit `in_matrix = false` sind Direkt-E-Mails: sie gehen immer raus, weil
sie eine Handlung mitteilen, die die Person betrifft.

### `push_subscriptions`

Ein Eintrag je Gerät, das die Glocke gedrückt hat: Endpunkt des Push-Dienstes und die
beiden Schlüssel, mit denen die Nachricht für dieses Gerät verschlüsselt wird. Ein Mitglied
kann mehrere haben — Handy, Tablet, Rechner.

Der Versandlauf löscht einen Eintrag, sobald der Push-Dienst ihn mit 404 oder 410 abweist:
Das Gerät kommt nicht wieder, und ein toter Endpunkt würde sonst bei jedem Lauf erneut
versucht. Eine Nachricht gilt als zugestellt, sobald **ein** Gerät sie angenommen hat.

### `v_training_statistics`

Wer war wie oft beim Training? Gezählt werden nur **vergangene, nicht abgesagte** Termine:
Ein künftiger Termin sagt nichts über Anwesenheit, und bei einem ausgefallenen stünde sonst
bei jedem eine Absage, die niemand zu verantworten hat.

„Nicht gemeldet" (`none`) bleibt von „abgesagt" (`no`) getrennt. Beides zusammenzuwerfen
wäre unfair gegenüber denen, die zuverlässig absagen, wenn sie nicht können.

Wer die Zahlen sieht, entscheidet `statistics_visibility` am Training —
`may_see_training_statistics()` prüft es, und die View filtert danach. Anwesenheit ist eine
Aussage über eine Person; eine Oberfläche, die sie nur nicht anzeigt, wäre keine Grenze.

### `object_messages`

Ein kurzer Faden an genau einem Spiel, Trainingstermin oder Vereinstermin. **Kein Chat:**
keine Unterhaltung zwischen zwei Personen, keine Kanäle, keine ungelesen-Zähler über alles
hinweg. Der Chat des TT-Planers ist gestrichen und bleibt es.

Wer eine Nachricht sehen darf, entscheidet **nicht** diese Tabelle, sondern die
Sichtbarkeit des Termins — `can_see_message_object()` fragt genau die Funktionen, die es
dafür schon gibt. Eine eigene Regel wäre eine zweite Wahrheit, die irgendwann von der
ersten abweicht.

`object_id` hat bewusst **keinen** Fremdschlüssel, weil das Ziel drei Tabellen sein kann.
Aufgeräumt wird per Trigger beim Löschen des Termins: Verwaiste Nachrichten wären
unsichtbar und blieben trotzdem gespeichert, und das sind personenbezogene Daten.

Benachrichtigt werden die **Beteiligten** (Kader, Zusagen), nicht alle, die den Termin
sehen dürfen — und der Verfasser nicht, der weiß es.

### `news`

Das schwarze Brett. `published_at` ist bewusst von `created_at` getrennt: Eine Neuigkeit
lässt sich vordatieren oder nachträglich korrigieren, ohne an eine andere Stelle zu
rutschen. Vor diesem Zeitpunkt sieht sie nur, wer sie anlegen darf — das erzwingt die
SELECT-Policy, nicht die Oberfläche.

`author_id` setzt ein Trigger aus `auth.uid()`, damit niemand im Namen eines anderen
schreibt. Ist keine Sitzung da (Datenübernahme, Aufgabe 10.2), bleibt der mitgegebene
Verfasser stehen, statt anonym zu werden.

**Es geht keine Benachrichtigung raus** — wie im TT-Planer. Eine Neuigkeit ist eine
Mitteilung an alle, keine Aufforderung an einen Einzelnen; alles, was den Posteingang
erreicht, soll eine Handlung verlangen.

### `club_roles`, `club_role_members`

Ämter — Jugendwart, Kassier, Pressewart. **Nicht zu verwechseln mit `profiles.role`:**
die Benutzerrolle steuert, was jemand darf, und ist fest vorgegeben; ein Amt ist ein frei
benannter Posten und schaltet **keine einzige Berechtigung** frei.

Im TT-Planer geben Ämter genau zwei Rechte (Inventar, Bekleidung). Beide Module sind hier
gestrichen, also bleibt vom Amt das, was es eigentlich ist: eine Auskunft darüber, wen man
bei welchem Anliegen anspricht.

Ein Amt kann mehrere Inhaber haben und ein Mitglied mehrere Ämter — beides ist im Verein
normal. `duties` ist ein Textfeld-Array, damit die Tätigkeiten einzeln bleiben und sich
einzeln anzeigen lassen.

### `keys`, `key_handovers`

Hallenschlüssel und ihr Weg. Der aktuelle Inhaber steht als Spalte an `keys`, das
Protokoll daneben in `key_handovers` — die Spalte ist die Antwort, das Protokoll die
Begründung. Läge die Antwort nur im Protokoll, hinge sie an einer Sortierung, und zwei
Übergaben in derselben Sekunde hätten den Schlüssel an die falsche Person gegeben.

Geschrieben wird `holder_id` ausschließlich von `rpc_hand_over_key`. Wer weitergeben
darf, sagt `may_hand_over_key()`: der aktuelle Inhaber (außer bei `no_forwarding`), der
Verantwortliche und der Administrator. Die letzten beiden immer — sonst wäre ein
Schlüssel bei einem ausgetretenen Mitglied für immer verloren.

`v_session_keys` beantwortet die Frage der Trainingskarte („kommt jemand mit Schlüssel?").
Wie `v_session_counts` bewusst **ohne** `security_invoker`: Die Antwort muss stimmen, auch
wenn die Teilnehmerliste verborgen ist. Der **Name** hängt dagegen an
`may_see_session_roster` — sonst verriete der Hinweis bei einem inkognito geführten
Training genau das, was Inkognito verbergen soll.

### `action_tokens`

Macht den Link in einer E-Mail ohne Anmeldung nutzbar. Einmalschlüssel mit Verfallsdatum,
gültig für genau eine Handlung an genau einem Objekt. **Für niemanden lesbar** — wer den
Token hat, hat ihn aus der eigenen E-Mail; ihn abfragen zu können hieße, fremde Antworten
abgeben zu können.

### `match_reminders`, `open_reminder_log`

Das Gedächtnis des Erinnerungslaufs, der alle zehn Minuten läuft. Ohne sie ginge
dieselbe Erinnerung sechsmal pro Stunde raus. Getrennt vom Postfach, weil eine
verschickte Nachricht irgendwann aufgeräumt wird, der Merkposten aber bleiben muss.

Die Fassung gehört in den Schlüssel von `match_reminders`: Wird ein Spiel verlegt, ist
die alte Erinnerung überholt und es gibt zur neuen Fassung wieder eine.

### `substitute_requests`

Die Ersatzkette. `match_version` gehört zum eindeutigen Schlüssel: Wird ein Spiel verlegt,
sind alle laufenden Anfragen hinfällig — man hat ja für einen anderen Termin zugesagt —
und die Kette beginnt für die neue Fassung von vorn. Jede Person wird je Fassung
höchstens einmal gefragt.

Wer als Nächstes gefragt wird, entscheidet nicht die Datenbank, sondern
`_shared/substituteEngine.ts` als reine Funktion. Hier stehen nur die Tabellen und die
Handgriffe, die der Mannschaftsführer selbst macht.

### `reschedule_polls`, `reschedule_votes`

Terminumfragen für Spielverlegungen: bis zu drei Vorschläge, je Person und Option eine
Stimme. Getrennte Zeilen statt einer mit drei Feldern, weil die Zahl der Optionen offen ist.

### `trainings`, `training_trainers`, `training_members`

Ein `trainings`-Eintrag ist eine **Regel**, kein Termin: Wochentag, Uhrzeit, Rhythmus und
ein Startdatum als Anker („zweiwöchentlich ab dem 1. September"). Wer leitet, steht in
`training_trainers`, wer eingeladen ist, in `training_members`.

Drei Schalter entscheiden über die Sichtbarkeit und werden deshalb in der RLS geprüft,
nicht in der Oberfläche:

- `is_open` — jedes aktive Mitglied darf kommen; nur solche Trainings sehen auch Gäste.
- `trainer_invites_only` — niemand trägt sich selbst ein.
- `is_incognito` — Teilnehmer sehen weder die Namen der anderen noch deren Zahl.

`training_statistics_groups` begrenzt die Anwesenheitsstatistik, wenn
`statistics_visibility = 'groups'` steht. `training_reminder_filter` hält fest, zu welchen
Trainings ein Mitglied erinnert werden will — keine Zeile heißt: zu allen.

### `training_sessions`, `training_cancellations`

Die einzelnen Termine werden materialisiert: ein Job (Aufgabe 6.3) legt sie bis acht Wochen
im Voraus an. Nur so kann eine Teilnahme an einem Termin hängen, und nur so bleibt sie
erhalten, wenn sich die Regel ändert. Bestehende Zeilen werden nie gelöscht, nur
aktualisiert.

Ein Ausfall löscht ebenfalls nichts. `training_cancellations` beschreibt einen Zeitraum —
entweder für ein Training oder für eine ganze Halle, nie für beides (Bedingung in der
Tabelle) — und die betroffenen Sessions werden `cancelled` markiert. Sie behalten Grund und
Herkunft, damit jeder sieht, was aus seinem Termin geworden ist.

### `training_attendance`, `training_auto_attendance`

`training_attendance` hat wie `match_participations` **keine Schreib-Policy**. Jede Änderung
geht durch `rpc_set_training_attendance`, weil vier Dinge zusammen geprüft werden müssen:
Zuordnung (oder `is_open`), Teilnehmergrenze inklusive Gästen, Anmeldeschluss (Sessionbeginn)
und ob der Termin überhaupt stattfindet. Trainer und Admin dürfen für andere melden und auch
nachtragen, wenn der Termin schon lief — sonst ließe sich die Anwesenheit nie korrigieren.

`training_auto_attendance` hält die automatische Zusage bis zu einem Datum (Aufgabe 6.7).

### `holidays`

Gesetzliche Feiertage und Schulferien je Bundesland, aus öffentlichen Quellen importiert
(Aufgabe 6.2). Der eindeutige Index über `(bundesland, kind, name, start_date)` macht den
jährlichen Import wiederholbar, ohne die Tabelle zu verdoppeln.

### `club_events`, `event_participations`

Clubmeisterschaft, Sommerfest, Jahreshauptversammlung. Zwei Dinge unterscheiden sie vom
Spieltermin: eine **Anmeldefrist** (`participate_until`) und **Gäste**. Wer zum Sommerfest
zwei Leute mitbringt, belegt drei Plätze — die Teilnehmergrenze zählt sie deshalb mit.

`event_participations` hat wie die anderen Beteiligungstabellen **keine Schreib-Policy**.
Jede Antwort geht durch `apply_event_answer`, das Frist, Grenze und Zeitpunkt zusammen
prüft. Die Funktion wirft keine Ausnahme, sondern liefert einen Status: „Die Anmeldefrist
ist vorbei" ist eine Antwort, die man dem Mitglied zeigen will, kein Fehler.

`description_html` ist einfacher Rich-Text. Er wird **beim Anzeigen** bereinigt
(`src/lib/richText.ts`, Positivliste) — nicht nur beim Speichern: Was in der Datenbank
steht, kann auch jemand direkt über die API geschrieben haben.

### `polls`, `poll_targets`, `poll_options`, `poll_votes`

Adressiert wird über Zielzeilen: **keine** Zeile in `poll_targets` heißt „ganzer Verein";
Mannschaften und Gruppen lassen sich mischen. Eine Zeile je Stimme statt eines Felds je
Person — bei `max_answers > 1` gibt jemand mehrere Stimmen ab, und Listen in Spalten
lassen sich nicht auszählen.

`hide_results` ist eine Rechtefrage, keine Anzeigeoption: Wer die Ergebnisse nicht sehen
soll, kann sie auch nicht abfragen. Das entscheidet `may_see_poll_results()`.

Geschrieben wird nur über `rpc_vote_poll`: Ob die Umfrage läuft, ob die Person gemeint
ist und ob sie nicht mehr Kreuze macht als erlaubt — eine Policy sieht immer nur eine
Zeile und könnte die dritte Frage gar nicht beantworten. Eine neue Stimme **ersetzt** die
alte; wer umentscheidet, soll nicht erst abwählen müssen.

Die Terminumfrage zur Spielverlegung (Aufgabe 5.5) läuft bewusst **nicht** hierüber:
Dort geht es um „wann kannst du", nicht um „was willst du", und daran hängt eine
Verlegung.

`polls.announced_at` und `news.announced_at` (Migration `20261101000001`) merken sich,
dass eine Umfrage bzw. Neuigkeit schon gemeldet wurde. Gemeldet wird über
`rpc_announce_poll` / `rpc_announce_news` — kein Trigger beim Einfügen, weil eine Umfrage
in drei Schritten entsteht (erst danach steht die Zielgruppe fest) und weil beim
Abschreiben alter Neuigkeiten niemand zwanzig E-Mails auslösen soll. Der Dialog hat
dafür das Häkchen „Mitglieder benachrichtigen". Eine vordatierte Neuigkeit wird zum
Veröffentlichungstermin gemeldet (`scheduled_for`).

### `v_my_open_polls`

Umfragen, die noch laufen, an den Angemeldeten gerichtet sind (`is_poll_target`) und in
denen seine Stimme fehlt. `security_invoker`: Die Policy auf `poll_votes` gibt die eigene
Stimme immer heraus, auch bei verborgenen Ergebnissen. Zusammen mit
`v_open_participations` die Grundlage für „Offen für dich".

### `calendar_tokens`

Der Abo-Link je Mitglied. Er ist ein **Dauerausweis**: Wer ihn hat, liest die zugesagten
Termine, denn ein Kalenderprogramm kann sich nicht anmelden. Die Tabelle hat deshalb
**keine einzige Policy** — herausgegeben wird der Token nur an den Eigentümer, über
`rpc_my_calendar_token()`. `rpc_reset_calendar_token()` macht den alten wertlos.

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

### `v_absences`

Abwesenheiten mit maskiertem Grund: `comment_private` erscheint nur in den eigenen Zeilen.
Gleiches Muster und gleiche Begründung wie beim Verzeichnis.

### `v_my_notification_preferences`

Für jeden abwählbaren Ereignistyp die geltende Einstellung des Angemeldeten — auch dann,
wenn dazu keine Zeile existiert. Die Regel „fehlende Zeile heißt an" bleibt damit in der
Datenbank, statt in der Oberfläche wiederholt zu werden.

### `v_open_participations`

Wer hat zu welchem Termin noch nicht geantwortet? Grundlage des täglichen
Sammelhinweises. „Offen" heißt: keine Antwort — oder eine Antwort zu einer Fassung, die
inzwischen überholt ist.

### `v_reschedule_results`

Je Terminvorschlag, wie viele können und wie viele nicht. Der Mannschaftsführer sieht
damit auf einen Blick, welcher Termin trägt.

### `v_open_participations` (erweitert)

Seit Aufgabe 6.6 stehen dort auch Trainingstermine ohne Antwort — allerdings nur für
**zugeordnete** Mitglieder. Ein offenes Training verpflichtet niemanden; wer dort nie
zusagt, soll deswegen nicht jeden Abend eine E-Mail bekommen. Die Erinnerung *vor* dem
Termin geht dagegen an alle, so steht es im Zielbild.

### `v_session_participants`, `v_session_counts`

Wer kommt zu einem Trainingstermin? `v_session_participants` liefert die Namen (und seit
`20261101000001` die Bemerkung aus `training_attendance.comment`) und nutzt
`security_invoker = true`: die Policy auf `training_attendance` entscheidet, wer wen sieht —
bei einem inkognito geführten Training also nur Trainer und Admin.

`v_session_counts` ist die einzige View im Projekt **ohne** `security_invoker`, und zwar mit
Absicht: ein Zähler soll die volle Zahl nennen, nicht nur die Zahl der sichtbaren Zeilen.
Sonst stünde bei Inkognito „1 Teilnehmer" — nämlich man selbst. Wer die Zahl überhaupt sehen
darf, entscheidet stattdessen die `WHERE`-Bedingung der View über
`may_see_session_roster()`.

### `v_my_upcoming`

Eine Zeile je Termin, an dem ein Mitglied beteiligt ist, mit dem eigenen Status:
Spiele, Trainings, Vereinstermine. Grundlage für „Meine Termine", den ICS-Feed und später
das Dashboard — damit alle drei dieselbe Antwort bekommen und nicht jede für sich rechnet.

### `v_calendar_items`

Alles, was im Vereinskalender steht, in einer View: Trainingstermine, Spiele,
Vereinstermine, Geburtstage und gesperrte Hallen. `security_invoker`, damit jeder Teil
weiterhin der RLS seiner Tabelle folgt — ein Gast sieht hier genau das, was er auch sonst
sieht.

Die Regeln, was auftaucht (`hide_in_calendar`, `exclude_calendar`, `hide_birthday`),
stehen hier und nicht im Browser. Geburtstage werden gerechnet: der nächste Jahrestag ab
heute, statt einer Datenzeile je Jahr.

### `v_match_lineup_status`

Je Beteiligungszeile genau ein Wort: `lineup`, `open`, `declined`, `unclear`, `absent`
oder `removed` — die sechs Abschnitte des Dialogs „Spieler verwalten". Die Einstufung
gehört in die Datenbank, damit Oberfläche, Benachrichtigungen und Ersatzkette dieselbe
Antwort bekommen und nicht jede für sich rechnet.

## Funktionen

| Funktion | Zweck |
|---|---|
| `set_updated_at()` | Trigger, hält `updated_at` aktuell |
| `current_member_role()` | Rolle des angemeldeten Mitglieds. Heißt bewusst nicht `current_role()` — das ist in SQL bereits ein Schlüsselwort |
| `is_active_member()`, `is_admin()`, `is_organizer_or_admin()` | Rechteprüfungen für die Policies |
| `protect_profile_columns()` | Trigger: `role`, `status`, `qttr`, `member_number`, `no_games` darf nur ein Admin ändern; `deleted_at` darf man setzen, aber nicht zurücknehmen |
| `can_see_absences()` | Wer außer dem Mitglied selbst Abwesenheiten sehen darf |
| `rpc_delete_my_account()` | Soft-Delete des eigenen Kontos; verweigert beim letzten Admin |
| `rpc_activate_member(uuid)` | Schaltet ein wartendes Mitglied frei (nur Admin) |
| `rpc_update_qttr_bulk(jsonb)` | QTTR-Werte einer ganzen Liste in einem Aufruf (nur Admin) |
| `leads_team(uuid)`, `leads_match(uuid)` | Führt der Angemeldete diese Mannschaft bzw. die zu diesem Spiel? |
| `check_team_member_limits()` | Trigger: nicht mehr Stammspieler als `teams.size` |
| `belongs_to_team(uuid)`, `can_see_match(uuid)` | Gehört der Angemeldete zur Mannschaft? Darf er das Spiel sehen? |
| `rpc_request_players(uuid[], uuid[])` | Spieler für ein oder mehrere Spiele anfragen (Mannschaftsführung/Admin) |
| `rpc_withdraw_request(uuid, uuid)` | Unbeantwortete Anfrage zurücknehmen |
| `rpc_offer_match(uuid, text)`, `rpc_withdraw_offer(uuid, uuid)` | „Ich hätte Zeit" melden, zurückziehen oder (Mannschaftsführung) verwerfen |
| `recompute_lineup(uuid)` | Berechnet die Aufstellung neu (siehe unten) |
| `rpc_set_match_response(uuid, response, text)` | Eigene Zu- oder Absage, nur für Angefragte; prüft den Meldeschluss |
| `rpc_set_training_attendance(uuid, status, int, uuid, text)` | Trainingsrückmeldung; die Bemerkung (letzter Parameter) bleibt bei `NULL` unverändert |
| `apply_training_answer(uuid, uuid, text)` | Trainingsrückmeldung über den Antwort-Link (`training_response`); Statuswerte statt Fehler: `cancelled`, `started`, `not_assigned`, `full` |
| `rpc_announce_poll(uuid)`, `rpc_announce_news(uuid)` | Neue Umfrage bzw. Neuigkeit melden (nur Veranstalter/Admin, je einmal) |
| `rpc_manage_player(uuid, uuid, text)` | `add`, `remove`, `decline`, `reset` durch den Mannschaftsführer |
| `rpc_set_lineup(uuid, jsonb)` | Aufstellung von Hand; sperrt die Automatik |
| `rpc_unlock_lineup(uuid)` | Zurück zur Automatik |
| `render_template(text, jsonb)` | Füllt `{{platzhalter}}`; unbekannte verschwinden, statt in der E-Mail zu landen |
| `enqueue_notification(uuid, text, jsonb, bool, timestamptz)` | Die einzige Stelle, an der Benachrichtigungen entstehen |
| `rpc_answer_action_token(uuid, text)` | Antwort über den Link aus der E-Mail, ohne Anmeldung |
| `apply_substitute_answer(uuid, uuid, text)` | Antwort auf eine Ersatzanfrage; nimmt die Person als Parameter, weil der Link keine Anmeldung hat |
| `enqueue_substitute_request(...)`, `notify_chain_exhausted(uuid)` | Was der Hintergrundlauf der Ersatzkette ausführt |
| `rpc_start_reschedule_poll(uuid, timestamptz[])` | Terminumfrage mit bis zu drei Vorschlägen |
| `rpc_vote_reschedule(uuid, int, bool)` | „kann" oder „kann nicht" zu einem Vorschlag |
| `rpc_apply_reschedule(uuid, int)` | Setzt `dtstart_override` und erhöht die Fassung |
| `trains(uuid)`, `trains_session(uuid)` | Leitet der Angemeldete dieses Training bzw. das zu diesem Termin? |
| `can_see_training(uuid)` | Darf er es überhaupt sehen? Gäste nur offene oder zugeordnete |
| `may_see_training_roster(uuid)`, `may_see_session_roster(uuid)` | Darf er sehen, wer dazugehört und wer kommt? Genau hier wirkt „Inkognito" |
| `may_join_training(uuid)` | Darf er sich selbst eintragen? (offen und nicht `trainer_invites_only`) |
| `rpc_set_training_attendance(uuid, status, int, uuid)` | Der einzige Weg in `training_attendance`; prüft Zuordnung, Grenze und Anmeldeschluss |
| `training_payload(uuid)`, `training_audience(uuid)` | Werte für die Vorlage und der Empfängerkreis eines Trainings |
| `enqueue_training_reminder(uuid, uuid)` | Was der Erinnerungslauf je Termin und Person ausführt |
| `notify_training_cancelled(uuid, date, date, text, bool)` | Meldet einen Ausfall — einmal für den ganzen Zeitraum, nicht je Tag |
| `check_trainers_cancelled()` | Trigger: sagen alle Trainer ab, sagt sich der Termin selbst ab |
| `event_payload(uuid)` | Werte für die Vorlage eines Vereinstermins, samt Antwortlink |
| `apply_event_answer(uuid, uuid, text, int, source)` | Zu- oder Absage; prüft Anmeldefrist, Teilnehmergrenze und Zeitpunkt |
| `rpc_set_event_participation(uuid, status, int)` | Dasselbe für den Angemeldeten |
| `enqueue_event_reminder(uuid, uuid)` | Was der Erinnerungslauf je Termin und Zusagendem ausführt |
| `is_poll_target(uuid)`, `may_see_poll_results(uuid)` | Ist der Angemeldete gemeint, und darf er die Auszählung sehen? |
| `rpc_vote_poll(uuid[])`, `rpc_retract_poll_vote(uuid)` | Abstimmen und die eigene Stimme zurückziehen |
| `is_playing_member()` | Aktives Mitglied, das kein Gast ist — die Grenze des Spielbetriebs |
| `rpc_my_calendar_token()`, `rpc_reset_calendar_token()` | Den eigenen Abo-Link holen oder neu erzeugen |
| `handle_new_user()` | Trigger auf `auth.users`: verknüpft oder legt an (siehe unten) |
| `get_public_club_info()` | Vereinsname für den Anmeldebildschirm, ohne Anmeldung |
| `rpc_validate_registration_code(text)` | prüft den Vereinscode, gibt nur wahr/falsch zurück |

Alle Rechte-Helfer sind `SECURITY DEFINER` mit festem `search_path`. Ohne `DEFINER` liefe
die `profiles`-Policy in eine Rekursion, weil sie `profiles` liest, um `profiles` zu prüfen.

## Wie die Aufstellung entsteht

`recompute_lineup(match_id)` nummeriert alle, die zugesagt haben und nicht vom
Mannschaftsführer herausgenommen wurden:

1. Stammspieler nach ihrem Rang in der Altersklasse der Mannschaft, dann nach Namen
2. Ersatzspieler nach ihrem Ersatzrang
3. alle übrigen Zusagen nach Namen

Die beiden Kriterien werden bewusst **nicht** gemischt: Ersatzspieler ordnen sich nach
ihrem Ersatzrang, nicht nach ihrem Vereinsrang. Sonst wäre die Reihenfolge, auf die sich
die Ersatzkette verlässt, an dieser Stelle eine andere.

Positionen über `required_players` hinaus sind die Ersatzbank. Sobald der
Mannschaftsführer die Aufstellung selbst setzt, steht `lineup_locked` und die Automatik
fasst das Spiel nicht mehr an — sonst würde sie seine Entscheidung beim nächsten Anlass
überschreiben. `rpc_unlock_lineup` gibt es wieder frei.

Bei `lineup_mode = 'open'` rechnet die Automatik gar nicht; dort stellt der
Mannschaftsführer immer selbst auf.

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
| `v_cron_status` | nur Admin (View prüft selbst) | — (View) |
| `object_messages` | wer den Termin sieht | wer den Termin sieht; ändern/löschen nur die eigene (Admin jede) |
| `news` | aktive Mitglieder ab `published_at` | Admin, Organisator |
| `club_roles`, `club_role_members` | aktive Mitglieder | Admin |
| `keys` | aktive Mitglieder | Admin (Inhaber nur über `rpc_hand_over_key`) |
| `key_handovers` | aktive Mitglieder | niemand direkt |
| `profiles` | eigene Zeile immer; Admin alles, auch Gelöschte; sonst aktive Mitglieder. Ein Gast sieht nur Admins und Trainer | eigene Zeile oder Admin; Spaltenschutz per Trigger |
| `absences` | eigene Zeilen; Admin, Trainer und Mannschaftsführer die Zeiträume aller | eigene Zeilen oder Admin |
| `member_rankings` | aktive Mitglieder | Admin |
| `groups`, `group_members` | aktive Mitglieder | Admin |
| `venues` | aktive Mitglieder | Admin |
| `teams`, `team_leaders` | aktive Mitglieder **außer Gästen** | Admin |
| `team_members` | aktive Mitglieder | Admin oder Mannschaftsführer der Mannschaft |
| `matches` | aktive Mitglieder **außer Gästen** | Anlegen/Ändern: Admin oder Mannschaftsführer; Löschen: Admin |
| `match_participations` | aktive Mitglieder | **niemand direkt** — nur über die RPCs |
| `match_volunteers` | aktive Mitglieder | eigene Zeile, Mannschaftsführer oder Admin |
| `match_changes` | Admin und Mannschaftsführer | niemand direkt |
| `sync_runs` | Admin und Mannschaftsführer | niemand direkt |
| `notification_templates` | aktive Mitglieder | niemand über die API |
| `notification_preferences` | eigene Zeilen | eigene Zeilen |
| `notifications` | eigene Zeilen; Admin alles | **niemand direkt** — nur `enqueue_notification` |
| `push_subscriptions` | eigene Zeilen | eigene Zeilen |
| `action_tokens` | **niemand** | niemand |
| `substitute_requests` | der Gefragte, Mannschaftsführung, Admin | niemand direkt — nur über die RPCs |
| `reschedule_polls`, `reschedule_votes` | aktive Mitglieder | niemand direkt |
| `holidays` | alle Angemeldeten | Admin (und der Import als `service_role`) |
| `trainings` | aktive Mitglieder; Gäste nur offene oder zugeordnete | Anlegen: Admin oder Trainer; Ändern/Löschen: Admin oder Trainer *dieses* Trainings |
| `training_trainers` | wer das Training sieht — auch bei Inkognito | Admin oder Trainer des Trainings |
| `training_members` | eigene Zeile; sonst nur, wenn das Training nicht inkognito läuft | Admin, Trainer, oder man selbst bei einem offenen Training |
| `training_sessions` | wer das Training sieht | **niemand direkt** — nur der Erzeugungs-Job |
| `training_attendance` | eigene Zeile; fremde nur, wenn nicht inkognito | **niemand direkt** — nur `rpc_set_training_attendance` |
| `training_cancellations` | aktive Mitglieder | Admin; ein Trainer nur für sein eigenes Training, nie für eine ganze Halle |
| `training_auto_attendance`, `training_reminder_filter` | eigene Zeilen | eigene Zeilen |
| `club_events` | aktive Mitglieder, auch Gäste | Organisator und Admin |
| `event_participations` | aktive Mitglieder | **niemand direkt** — nur `rpc_set_event_participation` oder der Link |
| `polls`, `poll_targets`, `poll_options` | wer gemeint ist, dazu Organisator und Admin | Organisator und Admin |
| `poll_votes` | eigene Stimme immer; fremde nur bei offenen Ergebnissen | **niemand direkt** — nur `rpc_vote_poll` |
| `calendar_tokens` | **niemand** | niemand — nur über die beiden RPCs |

`service_role` (Edge Functions) umgeht RLS — das ist gewollt und der Grund, warum der
`service_role`-Schlüssel niemals ins Frontend gehört.

**Warum der Admin auch gelöschte Profile sieht:** PostgreSQL prüft beim UPDATE nicht nur
die UPDATE-Policy, sondern auch die SELECT-Policy gegen die *neue* Zeile. Solange die
SELECT-Policy für fremde Zeilen `deleted_at IS NULL` verlangte, scheiterte jedes
Soft-Delete durch den Admin an „new row violates row-level security policy". Er muss die
Zeile ohnehin sehen können, sonst ließe sich eine versehentliche Löschung nie rückgängig
machen.

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
