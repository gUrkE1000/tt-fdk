# Betrieb

Was nach dem Anlegen des Supabase-Projekts einmal eingerichtet werden muss, und woran man
erkennt, dass es läuft.

> Solange es kein Supabase-Projekt gibt, ist dieses Dokument eine Anleitung für später.
> Die Entwicklung läuft gegen die lokale Testdatenbank (siehe `docs/entwicklung.md`).

## 1. Secrets der Edge Functions

```bash
supabase secrets set APP_URL="https://verein.example.org"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase selbst
bereit. **Der `service_role`-Schlüssel gehört niemals ins Frontend** — er umgeht jede
Row-Level-Security-Policy.

Weitere Secrets kommen später dazu: `RESEND_API_KEY` (Aufgabe 4.2) und
`VAPID_PRIVATE_KEY` (Aufgabe 8.3).

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

## 3. Ersten Administrator anlegen

Die Anwendung legt niemanden automatisch an. Nach dem ersten Deployment:

```sql
INSERT INTO public.profiles (first_name, last_name, email, role, status)
VALUES ('Vorname', 'Nachname', 'admin@example.org', 'admin', 'unconfirmed');
```

Danach meldet sich diese Adresse per E-Mail-Link an; `handle_new_user()` verknüpft das
vorhandene Profil und setzt es auf `active`.

## 4. Sicherung

Supabase sichert die Datenbank selbst. Zusätzlich empfiehlt sich ein wöchentlicher
`pg_dump` in ein privates Artefakt (kommt in Aufgabe 10.x).
