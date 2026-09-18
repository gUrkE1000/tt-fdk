# Betrieb

Was nach dem Anlegen des Supabase-Projekts einmal eingerichtet werden muss, und woran man
erkennt, dass es läuft.

> Solange es kein Supabase-Projekt gibt, ist dieses Dokument eine Anleitung für später.
> Die Entwicklung läuft gegen die lokale Testdatenbank (siehe `docs/entwicklung.md`).

## 1. Secrets der Edge Functions

```bash
supabase secrets set APP_URL="https://verein.example.org"
supabase secrets set RESEND_API_KEY="re_..."
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase selbst
bereit. **Der `service_role`-Schlüssel gehört niemals ins Frontend** — er umgeht jede
Row-Level-Security-Policy.

`VAPID_PRIVATE_KEY` für Web Push kommt in Aufgabe 8.3 dazu.

Die Absenderadresse steht **nicht** in den Secrets, sondern in den Vereinsdaten
(`notification_sender_email`). Sie muss eine bei Resend verifizierte Domain sein, sonst
lehnt der Dienst ab und die Nachricht landet dauerhaft auf `failed`.

## 2. Nächtlicher Kalenderabgleich

Der Job liegt in der Datenbank (pg_cron) und ruft die Edge Function `sync-calendars` über
pg_net. Damit er etwas tut, braucht er zwei Werte im Schema `private`:

```sql
-- Basisadresse der Edge Functions, ohne Schrägstrich am Ende
UPDATE private.cron_config
   SET value = 'https://<projekt-id>.supabase.co/functions/v1'
 WHERE key = 'functions_base_url';

-- Ein zufälliges Geheimnis, mit dem sich der Job gegenüber der Function ausweist
UPDATE private.cron_config
   SET value = encode(gen_random_bytes(32), 'hex')
 WHERE key = 'cron_secret';
```

Das Secret liegt bewusst in der Datenbank und nicht in der Umgebung der Function: Der Job
muss es beim Aufruf mitschicken, die Function liest es zum Vergleich. Beide kommen an
dieselbe Tabelle, niemand sonst — `private` veröffentlicht PostgREST nicht.

Ist einer der beiden Werte leer, tut der Job nichts und schreibt einen Hinweis ins Log.
Das ist Absicht: ein Job, der jede Nacht ins Leere läuft, wäre schlimmer als keiner.

### Läuft er?

```sql
-- Der eingeplante Job
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'sync-calendars';

-- Die letzten Läufe der Anwendung
SELECT started_at, status, summary FROM public.sync_runs ORDER BY started_at DESC LIMIT 10;
```

`summary` enthält je Mannschaft, wie viele Spiele neu angelegt, verlegt, geändert oder
deaktiviert wurden.

### Fehlerbilder

| Was in `sync_runs` steht | Bedeutung | Was zu tun ist |
|---|---|---|
| `failed`, Meldung `HTTP 404` | Die Kalenderadresse der Mannschaft stimmt nicht mehr | Adresse im Mannschaftsdialog neu setzen |
| `failed`, Meldung „Kalender nicht erreichbar" | myTischtennis war nicht erreichbar | Abwarten, der nächste Lauf holt es nach |
| `warning`, Meldung „Sicherheitssperre" | Der Kalender lieferte null Termine, obwohl aktive Spiele vorhanden sind | **Nichts wurde geändert.** Kalenderadresse prüfen |
| Nur `pending`, nie abgeschlossen | Die Function ist mitten im Lauf abgebrochen | Logs der Function ansehen |

Die Sicherheitssperre ist der wichtigste Teil: Ein einziger Fehlabruf würde sonst sämtliche
Spiele deaktivieren und alle Rückmeldungen entwerten. Lieber ein veralteter Spielplan als
ein gelöschter.

## 3. Versand der Benachrichtigungen

Derselbe Mechanismus wie beim Kalenderabgleich: pg_cron ruft alle fünf Minuten
`process-notifications`. Die beiden Werte in `private.cron_config` gelten für beide Jobs,
es ist also nichts zusätzlich einzurichten.

### Läuft er?

```sql
SELECT status, count(*) FROM public.notifications GROUP BY status;

-- Was zuletzt nicht rausging und warum
SELECT created_at, type, channel, attempts, error
  FROM public.notifications
 WHERE status IN ('failed', 'skipped')
 ORDER BY created_at DESC LIMIT 20;
```

### Fehlerbilder

| Was in `notifications` steht | Bedeutung | Was zu tun ist |
|---|---|---|
| `failed`, „Keine Absenderadresse" | `notification_sender_email` ist leer | In den Vereinsdaten eintragen |
| `failed`, `HTTP 403` von Resend | Die Absenderdomain ist nicht verifiziert | Domain bei Resend verifizieren |
| `skipped`, „keine E-Mail-Adresse" | Das Mitglied hat keine hinterlegt | Kein Fehler: Kinder haben oft keine |
| `skipped`, „Push … noch nicht eingerichtet" | Erwartet bis Aufgabe 8.3 | Nichts |
| Viele `pending` mit steigendem `attempts` | Resend antwortet nicht | Status von Resend prüfen; nach drei Versuchen steht `failed` |

Eine Zeile wird höchstens dreimal versucht, mit fünfzehn Minuten Abstand. Danach bleibt
sie als `failed` stehen — sichtbar, statt still verloren.

## 4. Erinnerungen

Ein dritter Job, alle zehn Minuten, mit vier Aufgaben:

1. **Erinnerung an ein Spiel**, je Person mit ihrem eigenen Vorlauf aus dem Profil.
2. **Erinnerung an einen Trainingstermin**, mit dem Vorlauf des *Trainings*
   (`reminder_hours`, Standard fünf Stunden). Die Asymmetrie ist Absicht: Wer dienstags um
   19 Uhr trainiert, entscheidet am Nachmittag, nicht einen Tag vorher.
3. **Erinnerung an einen Vereinstermin**, mit dem vereinsweiten Vorlauf
   (`event_reminder_hours`, Standard 24 Stunden), an die Zusagenden.
4. **Täglicher Sammelhinweis** auf alles, wozu noch eine Antwort fehlt — einer statt
   einer je Termin. Ab der in den Vereinsdaten eingestellten Uhrzeit
   (`open_reminder_time`), für Termine innerhalb von `open_reminder_days`.

Vier Merkposten verhindern Wiederholungen: `match_reminders` je Spiel, Person und
Fassung, `training_sessions.reminder_sent_at` und `club_events.reminder_sent_at` je
Termin, `open_reminder_log` je Person und Tag. Alle gehören dem Hintergrundlauf und sind für niemanden sonst sichtbar.

Bei einem **offenen Training** ist der Kreis der ganze Verein. Wem das zu viel ist,
schränkt unter „Mein Profil → Benachrichtigungen“ auf einzelne Trainings ein
(`training_reminder_filter`); keine Zeile dort heißt: alle.

```sql
-- Wer wurde zuletzt erinnert?
SELECT sent_at, match_id, profile_id FROM public.match_reminders
 ORDER BY sent_at DESC LIMIT 20;

-- Wer hat noch offene Rückmeldungen? (Spiele und Trainings)
SELECT kind, count(*) FROM public.v_open_participations GROUP BY kind;

-- Zu welchen Trainingsterminen wurde schon erinnert?
SELECT t.name, s.session_date, s.reminder_sent_at
  FROM public.training_sessions s
  JOIN public.trainings t ON t.id = s.training_id
 WHERE s.reminder_sent_at IS NOT NULL
 ORDER BY s.reminder_sent_at DESC LIMIT 20;
```

Wird ein Spiel verlegt, steigt seine Fassung — und es gibt zur neuen Fassung wieder eine
Erinnerung. Das ist gewollt: die alte Zusage gilt ja auch nicht mehr.

## 5. Ersatzkette

Ein vierter Job, alle zehn Minuten, für die Fristen. Wichtiger ist der sofortige Anstoß:
Ein Trigger auf `match_participations` ruft die Funktion, sobald jemand absagt. Wer
freitags absagt, soll nicht bis zum nächsten Zehnminutentakt warten.

```sql
-- Was läuft gerade?
SELECT sr.status, count(*) FROM public.substitute_requests sr GROUP BY sr.status;

-- Offene Anfragen mit Frist
SELECT full_name, status, expires_at FROM public.v_substitute_requests
 WHERE status = 'pending' ORDER BY expires_at;
```

Läuft die Kette leer, bekommt die Mannschaftsführung eine Nachricht
(`substitute_chain_exhausted`). Der TT-Planer hat das nicht — dort erfährt niemand, dass
alle abgesagt haben.

## 6. Trainingstermine

Ein fünfter Job, täglich um 03:00 UTC, schiebt das Fenster von acht Wochen weiter.
Daneben stößt ein Trigger den Lauf sofort an, sobald sich etwas ändert, was den
Terminplan betrifft: ein Training (Wochentag, Uhrzeit, Rhythmus, Ort, Aktiv-Schalter,
Feiertagsschalter), ein Ausfall oder eine Dauerzusage. Ein geänderter Beschreibungstext
löst bewusst nichts aus.

**Gelöscht wird nie.** An einem Termin hängen Rückmeldungen; ein Termin, den es nicht
mehr geben soll, wird abgesagt — mit Grund. Der Job nimmt nur die Absagen zurück, die er
selbst aus einem Ausfall-Zeitraum gesetzt hat (erkennbar an `cancellation_id`). Was ein
Trainer von Hand abgesagt hat, bleibt abgesagt.

```sql
-- Wie weit ist geplant?
SELECT t.name, count(*) AS termine, max(s.session_date) AS bis
  FROM public.training_sessions s
  JOIN public.trainings t ON t.id = s.training_id
 WHERE s.session_date >= CURRENT_DATE
 GROUP BY t.name ORDER BY t.name;

-- Was fällt demnächst aus und warum?
SELECT t.name, s.session_date, s.cancel_reason
  FROM public.training_sessions s
  JOIN public.trainings t ON t.id = s.training_id
 WHERE s.cancelled AND s.session_date >= CURRENT_DATE
 ORDER BY s.session_date;
```

| Auffälligkeit | Bedeutung | Was zu tun ist |
|---|---|---|
| Keine Termine über den heutigen Tag hinaus | Der Job läuft nicht | `functions_base_url` und `cron_secret` prüfen (Abschnitt 2) |
| Termine an Feiertagen | Die Jahre in `holidays` sind abgelaufen | Abschnitt 7 ausführen |
| Termine in den Schulferien | Schulferien fehlen in `holidays`, oder das Training hat den Schalter nicht | Abschnitt 7; sonst Trainingsdialog |
| Termine zur alten Uhrzeit nach einer Änderung | Der Sofort-Anstoß kam nicht durch | Einmal von Hand anstoßen: `SELECT private.trigger_generate_training_sessions();` |

## 7. Feiertage und Schulferien nachladen

**Einmal im Jahr, im Herbst.** Die Trainingsplanung überspringt Feiertage und Schulferien
nur, solange sie welche kennt — sind die Jahre abgelaufen, plant sie stillschweigend
Training an Karfreitag.

```bash
npm run import:holidays          # aktuelles Jahr und die zwei folgenden
npm run import:holidays -- 2029 2031
```

Das Skript schreibt eine neue Datei nach `supabase/migrations/` und lädt dazu:

- **gesetzliche Feiertage** von `https://feiertage-api.de/api/?jahr=YYYY`,
- **Schulferien** von `https://ferien-api.de/api/v1/holidays/<BL>/<YYYY>`, für alle
  sechzehn Bundesländer.

Die erzeugte Datei einchecken und wie jede Migration ausrollen. `ON CONFLICT DO NOTHING`
macht sie folgenlos wiederholbar; ein zweiter Lauf über dieselben Jahre legt nichts doppelt an.

**Wenn eine der Schnittstellen nicht antwortet:** Die gesetzlichen Feiertage rechnet das
Skript dann selbst — sie ergeben sich aus dem Osterdatum und aus Landesrecht, nicht aus
einer Datenbank. `npm run import:holidays -- --offline` erzwingt das ohne jeden Netzzugriff.
Schulferien lassen sich nicht rechnen; fehlen sie, steht das im Kopf der erzeugten Datei
und der Lauf ist später mit Netzzugang zu wiederholen. Betroffen sind nur Trainings mit
„Schulferien überspringen".

Was in der Datenbank steht:

```sql
SELECT kind, min(start_date), max(start_date), count(*)
  FROM public.holidays GROUP BY kind;
```

## 8. Ersten Administrator anlegen

Die Anwendung legt niemanden automatisch an. Nach dem ersten Deployment:

```sql
INSERT INTO public.profiles (first_name, last_name, email, role, status)
VALUES ('Vorname', 'Nachname', 'admin@example.org', 'admin', 'unconfirmed');
```

Danach meldet sich diese Adresse per E-Mail-Link an; `handle_new_user()` verknüpft das
vorhandene Profil und setzt es auf `active`.

## 9. Sicherung

Supabase sichert die Datenbank selbst. Zusätzlich empfiehlt sich ein wöchentlicher
`pg_dump` in ein privates Artefakt (kommt in Aufgabe 10.x).
