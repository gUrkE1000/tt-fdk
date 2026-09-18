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
zu scheitern.

## 3. Schema einspielen

```bash
npx supabase link --project-ref <projekt-id>
npx supabase db push
```

`db push` spielt `supabase/migrations/` in alphabetischer Reihenfolge ein. Die Dateien sind
so geschrieben, dass ein zweiter Lauf nichts kaputt macht.

**Die Seed-Daten bleiben draußen.** `supabase/seed.sql` enthält erfundene Mitglieder für die
Entwicklung; in der Produktionsdatenbank hätten sie nichts verloren.

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

`calendar-feed` muss **ohne Anmeldung** erreichbar sein — ein Kalenderprogramm kann sich
nicht anmelden, es hat nur den Abo-Token in der Adresse. Trag das dauerhaft in
`supabase/config.toml` ein, die `supabase link` beim ersten Mal anlegt:

```toml
[functions.calendar-feed]
verify_jwt = false
```

Ohne diesen Eintrag ist es ein Klick im Dashboard (*Edge Functions → calendar-feed → Verify
JWT: aus*), der nach jedem Ausrollen wieder fällig wird — und wenn er fehlt, scheitert das
Kalenderabo mit einer Meldung, die auf nichts hindeutet.

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
Aufruf mit, die Function liest es zum Vergleich. Beide kommen an dieselbe Tabelle,
niemand sonst — das Schema `private` veröffentlicht PostgREST nicht.

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

## 11. Ersten Administrator anlegen

Die Anwendung legt niemanden automatisch an — es gibt keine Hintertür, und das ist Absicht.
Im SQL-Editor:

```sql
INSERT INTO public.profiles (first_name, last_name, email, role, status)
VALUES ('Vorname', 'Nachname', 'admin@verein.example.org', 'admin', 'unconfirmed');
```

Danach auf der Anmeldeseite diese Adresse eingeben. Der Trigger `handle_new_user()`
verknüpft beim ersten Login das vorhandene Profil und setzt es auf `active`.

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
