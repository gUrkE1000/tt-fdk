# Einrichtung von null

Diese Anleitung führt von einem leeren Supabase-Konto zu einer laufenden Anwendung. Sie ist
für den Fall gedacht, dass niemand mehr da ist, der beim ersten Mal dabei war — also mit
allen Schritten, auch den offensichtlichen.

Der laufende Betrieb danach steht in [`betrieb.md`](betrieb.md), die Entwicklungsumgebung in
[`entwicklung.md`](entwicklung.md).

Rechne mit zwei bis drei Stunden, davon die Hälfte Wartezeit auf DNS-Einträge.

---

## Was gebraucht wird

| | Wofür | Kosten |
|---|---|---|
| Supabase-Projekt | Datenbank, Anmeldung, Edge Functions | kostenloser Tarif reicht für einen Verein |
| Resend-Konto | E-Mail-Versand | kostenlos bis 3.000 E-Mails im Monat |
| Eine Domain | Adresse der Anwendung und Absenderadresse | ~15 € im Jahr |
| Ein Ort zum Ausliefern | die gebauten Dateien | kostenlos |

Für die Datenbank gibt es keine Alternative im Baukasten: Row Level Security, Auth und
Edge Functions hängen an Supabase. Alles andere ist austauschbar.

---

## 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen. **Region Frankfurt** —
   die Daten von Vereinsmitgliedern sollen in der EU bleiben.
2. Das Datenbank-Passwort an einem sicheren Ort ablegen. Es lässt sich zurücksetzen, aber
   nicht anzeigen.
3. Unter *Project Settings → API* stehen drei Werte:
   - **Project URL** → später `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY` (darf öffentlich sein)
   - **service_role** → **niemals** ins Frontend, nur in die Secrets der Edge Functions

> Der `service_role`-Schlüssel umgeht jede Policy. Wer ihn hat, liest und ändert alle
> Mitgliederdaten. Er gehört nicht in eine Chat-Nachricht, nicht in ein Ticket und nicht
> in ein Repository.

## 2. Erweiterungen einschalten

Unter *Database → Extensions*:

- **pg_cron** — die zeitgesteuerten Jobs
- **pg_net** — damit die Jobs die Edge Functions aufrufen können

Ohne diese beiden läuft die Anwendung, aber nichts von selbst: keine Erinnerungen, kein
Kalenderabgleich, keine Trainingstermine. Die Migrationen merken das und melden es, statt
zu scheitern — sie überspringen dann nur das Einplanen der Jobs. Das ist Absicht, damit
dieselben Dateien auch gegen die Testdatenbank laufen, und es hat einen Preis: **Ein Lauf
ohne `pg_cron` sieht erfolgreich aus und hinterlässt null Jobs.**

> ⚠️ **`supabase db reset --linked` entfernt `pg_cron` wieder.**
>
> Der Reset baut die Datenbank neu auf — und Erweiterungen sind nichts, was Migrationen
> anlegen, sondern etwas, das am Projekt hängt. Daraus wird leicht eine Schleife:
>
> ```
> pg_cron einschalten  →  reset  →  pg_cron weg  →  Migrationen überspringen die Jobs
> ```
>
> Zweimal dasselbe zu tun hilft nicht. **Nach einem Reset werden die Jobs von Hand
> eingetragen**, statt noch einmal zurückzusetzen:
>
> ```sql
> DO $$
> BEGIN
>     PERFORM cron.unschedule(jobname) FROM cron.job;
>
>     PERFORM cron.schedule('retention',                  '0 2 * * *',    $job$ SELECT public.run_retention(); $job$);
>     PERFORM cron.schedule('generate-training-sessions', '0 3 * * *',    $job$ SELECT private.trigger_generate_training_sessions(); $job$);
>     PERFORM cron.schedule('sync-calendars',             '0 4 * * *',    $job$ SELECT private.trigger_sync_calendars(); $job$);
>     PERFORM cron.schedule('process-notifications',      '*/5 * * * *',  $job$ SELECT private.trigger_process_notifications(); $job$);
>     PERFORM cron.schedule('enqueue-reminders',          '*/10 * * * *', $job$ SELECT private.trigger_enqueue_reminders(); $job$);
>     PERFORM cron.schedule('substitute-engine',          '*/10 * * * *', $job$ SELECT private.trigger_substitute_engine(); $job$);
> END $$;
> ```
>
> Die Anweisung ist wiederholbar: Sie räumt vorhandene Jobs erst ab und legt sie dann neu
> an. Die Definitionen stehen identisch in den Migrationen `20261005000000_cron_sync.sql`,
> `…_cron_notifications.sql`, `…_reminder_tracking.sql`, `…_substitute_engine.sql`,
> `…_cron_sessions.sql` und `…_retention.sql` — wer dort etwas ändert, ändert es hier mit.

> **„Success. No rows returned" ist kein Erfolg.** Bei
> `SELECT … FROM cron.job` heißt es: null Jobs. Sechs Zeilen sind das Ziel; die Meldung
> „keine Zeilen" bedeutet, dass nichts eingeplant ist.

## 3. Schema einspielen

```bash
npx supabase link --project-ref <projekt-id>
npx supabase db push
```

`db push` spielt `supabase/migrations/` in alphabetischer Reihenfolge ein. Die Dateien sind
so geschrieben, dass ein zweiter Lauf nichts kaputt macht.

**Die Seed-Daten bleiben draußen.** `supabase/seed.sql` enthält erfundene Mitglieder für die
Entwicklung; in der Produktionsdatenbank hätten sie nichts verloren. `db push` fasst die
Datei nicht an.

> ⚠️ **`supabase db reset --linked` schon.**
>
> Der Befehl leert die verknüpfte Datenbank, spielt alle Migrationen ein — und danach
> kommentarlos `seed.sql`. Man greift zu ihm, wenn eine Produktionsdatenbank aufgeräumt
> werden soll, und bekommt als Ergebnis erfundene Mitglieder, einen „TTC Musterstadt" in
> den Vereinsdaten und Testkonten in `auth.users`. Also genau dort Testdaten, wo gerade
> aufgeräumt werden sollte.
>
> Seit dem 18.09.2026 bricht `seed.sql` in diesem Fall mit einer Fehlermeldung ab, statt
> zu laufen — erkennbar an der Rolle `supabase_storage_admin`, die es nur in einem
> gehosteten Projekt gibt. Der Reset selbst läuft trotzdem durch; nur die Testdaten
> bleiben weg.
>
> Wer **absichtlich** zurücksetzen will:
> ```bash
> mv supabase/seed.sql supabase/seed.sql.aus
> npx supabase db reset --linked
> mv supabase/seed.sql.aus supabase/seed.sql
> ```

## 4. Resend einrichten

1. Auf [resend.com](https://resend.com) ein Konto anlegen.
2. Die eigene Domain hinzufügen und die genannten DNS-Einträge setzen (SPF, DKIM, DMARC).
   Das dauert je nach Anbieter Minuten bis Stunden.
3. Warten, bis die Domain als *verified* gilt. Vorher lehnt Resend jeden Versand ab, und
   jede Nachricht landet auf `failed`.
4. Einen API-Schlüssel erzeugen.

Eine Absenderadresse wie `planer@verein.example.org` genügt; ein Postfach dahinter braucht
es nicht, solange niemand auf die Benachrichtigungen antwortet.

## 5. VAPID-Schlüsselpaar erzeugen

Für Web Push (Aufgabe 8.3):

```bash
npx web-push generate-vapid-keys
```

Das Paar wird **einmal** erzeugt und danach nie geändert. Ein neuer Schlüssel macht jede
bestehende Anmeldung wertlos — alle Mitglieder müssten die Glocke erneut drücken, und
niemand würde ihnen sagen, warum plötzlich nichts mehr kommt.

## 6. Secrets setzen

```bash
npx supabase secrets set APP_URL="https://verein.example.org"
npx supabase secrets set RESEND_API_KEY="re_..."
npx supabase secrets set VAPID_PUBLIC_KEY="B..."
npx supabase secrets set VAPID_PRIVATE_KEY="..."
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase den
Functions selbst bereit.

## 7. Edge Functions ausliefern

```bash
npx supabase functions deploy
```

Sieben Funktionen: `invite-member`, `sync-calendars`, `process-notifications`,
`enqueue-reminders`, `substitute-engine`, `generate-training-sessions`, `calendar-feed`.

`calendar-feed` und die fünf Cron-Functions müssen **ohne Supabase-JWT** erreichbar sein:
Ein Kalenderprogramm hat nur den Abo-Token in der Adresse, und `pg_cron` ruft über `pg_net`
nur mit dem Cron-Secret. Das steht fest in **`supabase/config.toml`** (im Repository,
`verify_jwt = false` je Function); `supabase functions deploy` liest die Datei bei jedem
Ausrollen. Nichts davon muss mehr im Dashboard geklickt werden — und ein Klick dort würde
beim nächsten Ausrollen ohnehin zurückgesetzt.

Offen sind die Functions damit nicht: Jede prüft den Aufrufer selbst
(`supabase/functions/_shared/http.ts`) — das Cron-Secret über die Datenbankfunktion
`verify_cron_secret()` oder das JWT eines Benutzers samt Rolle und Status.

## 8. Cron-Konfiguration eintragen

Die Jobs brauchen zwei Werte in der Datenbank (*SQL Editor*):

```sql
UPDATE private.cron_config
   SET value = 'https://<projekt-id>.supabase.co/functions/v1'
 WHERE key = 'functions_base_url';

UPDATE private.cron_config
   SET value = encode(gen_random_bytes(32), 'hex')
 WHERE key = 'cron_secret';
```

Das Secret liegt bewusst in der Datenbank statt in der Umgebung: Der Job schickt es beim
Aufruf mit, die Function prüft es über `verify_cron_secret()` — eine Funktion, die nur
`service_role` aufrufen darf und nur wahr oder falsch zurückgibt. Das Schema `private`
selbst veröffentlicht PostgREST nicht.

Optional lässt sich derselbe Wert zusätzlich als Function-Secret setzen
(`npx supabase secrets set CRON_SECRET=<derselbe Wert>`). Dann vergleichen die Functions
direkt, ohne Datenbankanfrage. Zwei Stellen heißt aber auch: Beim Wechsel beide ändern.

Ob die Aufrufe ankommen, zeigt nach ein paar Minuten:

```sql
SELECT status_code, left(content::text, 120), created
  FROM net._http_response ORDER BY created DESC LIMIT 10;
```

Stehen dort `401`, stimmt das Secret nicht oder `supabase/config.toml` wurde nicht mit
ausgerollt.

Prüfen:

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Es sollten **sechs** Jobs dastehen:

| Job | Läuft | Wofür |
|---|---|---|
| `retention` | `0 2 * * *` | Löschfristen (Aufgabe 10.1) |
| `generate-training-sessions` | `0 3 * * *` | Trainingstermine |
| `sync-calendars` | `0 4 * * *` | Kalenderabgleich |
| `process-notifications` | `*/5 * * * *` | Versandlauf |
| `enqueue-reminders` | `*/10 * * * *` | Erinnerungen |
| `substitute-engine` | `*/10 * * * *` | Ersatzkette |

Stehen dort null Jobs, ist `pg_cron` nicht eingeschaltet — zurück zu Schritt 2.

## 9. Anwendung bauen und ausliefern

`.env.local` (oder die Secrets der CI):

```
VITE_SUPABASE_URL=https://<projekt-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public>
VITE_APP_URL=https://verein.example.org
VITE_VAPID_PUBLIC_KEY=<öffentlicher VAPID-Schlüssel>
```

```bash
npm ci
npm run build       # Ergebnis in dist/
```

Zwei Dinge muss der Ort, an dem `dist/` liegt, können:

1. **Alle Pfade auf `index.html` umleiten.** Die Anwendung ist eine Single-Page-App; ohne
   diese Regel führt ein Lesezeichen auf `/trainings` zu einem 404.
2. **HTTPS.** Ohne sie gibt es keinen Service Worker, kein Push und keine Installation.

Wird die Anwendung unter einem Unterpfad ausgeliefert, muss `VITE_BASE_PATH` beim Bauen
gesetzt sein (`VITE_BASE_PATH=/repo/`), sonst suchen Manifest und Service Worker an der
falschen Stelle.

## 10. Anmeldung konfigurieren

In Supabase unter *Authentication → URL Configuration*:

- **Site URL**: `https://verein.example.org`
- **Redirect URLs**: dieselbe Adresse, zusätzlich `http://localhost:5173` für die Entwicklung

Unter *Authentication → Providers* genügt **Email**. Die Anwendung meldet mit Magic Link an
und setzt dabei `shouldCreateUser: false`: Wer kein Profil hat, bekommt keinen Link. Neue
Mitglieder kommen über eine Einladung oder den Vereinscode herein.

Unter *Authentication → Providers → Email* **müssen** eingeschaltet sein:

- **Confirm email** — sonst wäre jede Registrierung sofort ein angemeldetes Konto, ohne
  Nachweis, dass die Adresse dem gehört, der sie eingibt.
- **Secure email change** — eine neue Adresse muss von der alten *und* der neuen bestätigt
  werden. `profiles.email` zieht nach der Bestätigung automatisch nach.

Empfohlen unter *Authentication → Attack Protection*: **Captcha** (hCaptcha oder Turnstile)
für die Registrierung. Der Vereinscode hat zwar zwölf zufällige Zeichen und ist nicht zu
erraten, aber wer ihn kennt, kann beliebig viele Anträge stellen.

Ein vorhandenes Mitgliedsprofil übernimmt ein neues Konto **nur**, wenn es per Einladung
entstanden ist oder die Adresse bestätigt ist. Wer sich mit der Adresse eines angelegten
Mitglieds selbst registriert, wird abgewiesen — sonst könnte jemand das Profil an ein Konto
binden, dessen Passwort er kennt.

## 11. Ersten Administrator anlegen

Die Anwendung legt niemanden automatisch an — es gibt keine Hintertür, und das ist Absicht.
Der erste Administrator braucht deshalb **zwei** Einträge, in dieser Reihenfolge.

### Warum zwei

Ein Mitglied besteht aus zwei Hälften:

| | |
|---|---|
| `auth.users` | das Anmeldekonto — gehört Supabase Auth |
| `public.profiles` | Name, Rolle, Mannschaft — gehört der Anwendung |

Verbunden werden sie vom Trigger `handle_new_user()`, der beim **Anlegen eines
Anmeldekontos** feuert: Findet er ein Profil mit derselben E-Mail-Adresse, das noch nicht
verknüpft ist, übernimmt er es und setzt es auf `active`.

Bei allen späteren Mitgliedern erledigt das die Edge Function `invite-member`. **Beim
ersten Administrator gibt es niemanden, der einlädt** — und die Anmeldeseite hilft nicht
weiter: Sie fordert den Link mit `shouldCreateUser: false` an, legt also bewusst kein Konto
an. Sonst könnte sich jede beliebige Adresse eines verschaffen.

Wer nur das Profil anlegt und sich dann anmelden will, bekommt deshalb
**„Diese E-Mail-Adresse ist im Verein nicht bekannt"** — obwohl das Profil sichtbar in der
Tabelle steht. Die Meldung stimmt aus Sicht von Supabase Auth, das `public.profiles` gar
nicht kennt.

### 11.1 Profil anlegen — SQL-Editor

```sql
INSERT INTO public.profiles (first_name, last_name, email, role, status)
VALUES ('Vorname', 'Nachname', 'admin@verein.example.org', 'admin', 'unconfirmed');
```

### 11.2 Anmeldekonto anlegen — Dashboard

*Authentication → Users → **Add user** → Create new user*

- **Email**: exakt dieselbe Adresse wie in 11.1
- **Password**: eines vergeben
- **Auto Confirm User**: **anhaken** — Pflicht. `handle_new_user()` übernimmt ein
  vorhandenes Profil nur für ein bestätigtes oder eingeladenes Konto. Ohne Haken bricht
  das Anlegen mit „Für diese E-Mail-Adresse gibt es bereits ein Mitgliedsprofil" ab.

  Alternativ *Add user → **Send invitation***: Dann setzt Supabase `invited_at`, und das
  Profil wird genauso übernommen.

⚠️ **Die Reihenfolge ist nicht beliebig.** Existiert beim Anlegen des Kontos noch kein
passendes Profil, greift der zweite Zweig des Triggers: Selbstregistrierung, und die
verlangt den Vereinscode. Ohne ihn bricht das Anlegen mit einer Fehlermeldung ab.

### 11.3 Prüfen

```sql
SELECT email, role, status, auth_linked_at FROM public.profiles;
```

`status` muss auf **`active`** stehen und `auth_linked_at` einen Zeitstempel tragen. Dann
hat der Trigger die beiden Hälften verbunden, und die Anmeldung funktioniert — mit dem
vergebenen Passwort und ab jetzt auch mit dem E-Mail-Link.

## 12. Vereinsdaten ausfüllen

Angemeldet als Administrator, unter **Verein**:

- Reiter **Daten**: Name, Kurzname, Schreibweisen (für die Heim/Auswärts-Erkennung beim
  Kalenderimport), Bundesland (steuert die Feiertage), Standardort, Vereinscode.
- Reiter **Betrieb → Einstellungen**: Absendername und -adresse, **Adresse der Anwendung**
  (ohne sie führt kein Link aus einer Benachrichtigung irgendwohin), Vorlauf der
  Erinnerungen, Quicklinks der Übersicht.

## 13. Feiertage prüfen

Die Migration bringt die gesetzlichen Feiertage 2026–2028 für alle sechzehn Länder mit.
**Die Schulferien fehlen noch** — sie lassen sich nicht rechnen, sie müssen von einer
Schnittstelle kommen:

```bash
npm run import:holidays          # erzeugt eine neue Migration
```

Das ist nur nötig, sobald ein Training „Schulferien überspringen“ nutzt.

## 14. Probelauf

Der Reihe nach, jeweils mit Blick auf **Verein → Betrieb**:

| Schritt | Erwartung |
|---|---|
| Ein zweites Mitglied anlegen und einladen | Es bekommt eine E-Mail; unter *Benachrichtigungen* steht die Zeile auf `sent` |
| Eine Mannschaft anlegen, dann **Spieltermine → Spiele importieren** mit der ICS-Adresse | Unter *Kalenderabgleich* erscheint ein Lauf mit „n neu“ |
| Ein Training anlegen | Nach kurzer Zeit stehen Termine für die nächsten acht Wochen darin |
| Auf dem Handy die Glocke drücken | Die Glocke wird grün |
| Am nächsten Morgen | Unter *Jobs* steht bei allen ein Lauf der vergangenen Nacht |

Erst wenn diese fünf Punkte stimmen, ist die Einrichtung fertig. Alles, was danach nicht
läuft, steht mit Fehlerbild und Abhilfe in [`betrieb.md`](betrieb.md).

Die Anwendung ist jetzt leer. Wie die Daten aus dem TT-Planer hineinkommen, steht in
[`migration.md`](migration.md); was danach vier Wochen lang zu prüfen ist, in
[`parallelbetrieb.md`](parallelbetrieb.md).
