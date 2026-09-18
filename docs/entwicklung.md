# Entwicklungsumgebung

Wie du das Projekt lokal zum Laufen bringst und wie die Datenbank getestet wird.

## 1. Anwendung

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest
npm run build
npx tsc --noEmit # Typprüfung
```

`.env.example` nach `.env.local` kopieren und ausfüllen.

Die Anwendung wird unter der Wurzel ausgeliefert. Wer sie auf einem Unterpfad hostet
(GitHub Pages liefert ein Projekt unter `/<repo>/` aus), setzt beim Bauen
`VITE_BASE_PATH=/repo/` — Manifest, Service Worker und Symbole richten sich danach.

### App-Symbole und PWA

```bash
npm run make:icons   # public/icons/* aus scripts/icon.svg erzeugen (braucht sharp)
```

Die Symbole sind eingecheckt; das Skript läuft nur, wenn jemand `scripts/icon.svg` ändert.

`vite-plugin-pwa` läuft **nur bei `vite build`**. In der Entwicklung säße sonst ein Service
Worker vor jedem Neuladen und lieferte hartnäckig den Stand von vorhin. Wer die installierte
App prüfen will, nimmt `npm run build && npm run preview`.

Der Service Worker (`src/sw.ts`) speichert ausschließlich die Anwendung selbst zwischen.
Alles, was an Supabase geht, läuft ohne Zwischenspeicher direkt ins Netz — eine
zwischengespeicherte Teilnehmerliste von gestern sähe aus wie die Wahrheit.

## 2. Datenbank

Alles Datenbankseitige liegt in `supabase/`:

| Ordner | Inhalt |
|---|---|
| `supabase/migrations/` | Schema. Wird in alphabetischer Reihenfolge angewandt. |
| `supabase/tests/` | pgTAP-Tests, vor allem für RLS-Policies, Trigger und RPCs. |
| `supabase/seed.sql` | Beispieldaten für die lokale Entwicklung. Läuft nie gegen Produktion. |
| `supabase/functions/` | Edge Functions (Deno) und geteilte reine Logik unter `_shared/`. |

Es gibt zwei Wege, das lokal zu betreiben. **Beide nutzen dieselben Migrationen und dieselben
Tests** — du kannst also zwischen ihnen wechseln, ohne etwas anzupassen.

### Weg A: native PostgreSQL-Instanz (ohne Docker)

Das ist der Weg, den die Entwicklungsumgebung dieses Projekts nutzt, weil dort kein
Docker-Daemon läuft.

Einmalig installieren:

```bash
apt-get install -y postgresql-16 postgresql-contrib \
                   postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
```

Danach:

```bash
npm run db:reset   # Datenbank neu aufbauen: Kompatibilitätsschicht, Migrationen, Seed
npm run db:test    # pgTAP-Tests
npm run db:psql    # interaktive Konsole
npm run gen:types  # src/lib/database.types.ts neu erzeugen
```

`scripts/local-db.sh` startet den Cluster bei Bedarf selbst und sorgt dafür, dass sich der
Benutzer `postgres` per Passwort über TCP anmelden kann.

**Die Kompatibilitätsschicht** (`scripts/supabase-compat.sql`) bildet nach, was Supabase
mitbringt und unsere Migrationen voraussetzen:

- Rollen `anon`, `authenticated`, `service_role` (letztere mit `BYPASSRLS`, wie bei Supabase);
- Schema `auth` mit `auth.users` und `auth.jwt()` / `auth.uid()` / `auth.role()` / `auth.email()`;
- Extensions `pgcrypto` und `pgtap`;
- Testhilfen im Schema `tests`.

Sie ist **keine Migration** und läuft nie gegen das Supabase-Projekt — dort existiert das alles
bereits. `supabase/tests/000_compat.test.sql` prüft die Schicht selbst; schlägt dieser Test fehl,
sind alle anderen RLS-Tests wertlos, weil sie dann gegen eine falsche Nachbildung prüfen.

### Weg B: Supabase CLI (mit Docker)

Auf einem Rechner mit Docker:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

Dabei entfällt die Kompatibilitätsschicht, weil die echte Supabase-Umgebung läuft. Achte darauf,
dass `supabase/tests/000_compat.test.sql` dort trotzdem grün ist — die geprüften Eigenschaften
gelten in beiden Umgebungen.

## 3. pgTAP-Tests schreiben

Aufbau jeder Testdatei:

```sql
BEGIN;
SELECT plan(<Anzahl der Assertions>);

-- Assertions …

SELECT * FROM finish();
ROLLBACK;
```

Zwei Regeln, die sonst Zeit kosten:

1. **Die Zahl in `plan(n)` muss exakt der Anzahl der Assertions entsprechen.** Stimmt sie nicht,
   meldet pg_prove „Bad plan" und die Datei gilt als fehlgeschlagen, auch wenn jede einzelne
   Assertion grün ist.
2. **Hilfsaufrufe gehören in einen `DO`-Block**, nicht in ein `SELECT`. Ein `SELECT
   tests.login_as(…)` liefert eine Ergebniszeile, die der TAP-Parser als zusätzlichen Test
   zählt. Richtig:

   ```sql
   DO $$ BEGIN PERFORM tests.login_as('…'); END $$;
   ```

Verfügbare Testhilfen:

| Funktion | Wirkung |
|---|---|
| `tests.create_auth_user(id, email, meta)` | legt einen Auth-Benutzer an; der Trigger `on_auth_user_created` verknüpft daraufhin das Profil |
| `tests.login_as(uuid)` | setzt die JWT-Claims und wechselt in die Rolle `authenticated` |
| `tests.logout()` | anonymer Zugriff, Rolle `anon` |
| `tests.as_service_role()` | Sicht der Edge Functions, umgeht RLS |

Alle drei wirken nur bis zum Ende der Transaktion — also bis zum `ROLLBACK` am Dateiende.

Jede RLS-Policy braucht mindestens einen positiven und einen negativen Fall: einmal „darf",
einmal `throws_ok` oder „sieht 0 Zeilen". Eine Policy, die nur positiv getestet ist, ist nicht
getestet.

## 4. Edge Functions

Alles, wofür der `service_role`-Schlüssel nötig ist, läuft als Edge Function — nie im
Browser. Der Schlüssel darf das Backend nicht verlassen: wer ihn hat, liest und schreibt
die gesamte Datenbank an jeder Policy vorbei.

| Funktion | Zweck | Prüft |
|---|---|---|
| `invite-member` | `auth.admin.inviteUserByEmail` für ein angelegtes Profil | JWT des Aufrufers muss zu einem aktiven Admin gehören |
| `sync-calendars` | Spielplan aus myTischtennis abgleichen | Cron-Secret **oder** JWT eines Admins bzw. Mannschaftsführers |
| `process-notifications` | Fällige Nachrichten verschicken — E-Mail über Resend, Push über VAPID | Cron-Secret **oder** JWT eines Admins |
| `enqueue-reminders` | Erinnerungen an Spiele und offene Rückmeldungen einreihen | Cron-Secret **oder** JWT eines Admins |
| `substitute-engine` | Ersatzkette weiterrücken, Fristen auswerten | Cron-Secret **oder** JWT eines Admins bzw. Mannschaftsführers |
| `generate-training-sessions` | Trainingstermine acht Wochen im Voraus anlegen und pflegen | Cron-Secret **oder** JWT eines Admins bzw. Trainers |
| `calendar-feed` | ICS-Abo eines Mitglieds (nur zugesagte Termine) | den Abo-Token aus `calendar_tokens` — bewusst ohne Anmeldung |

Jede Funktion prüft die Rechte des Aufrufers **selbst**, bevor sie den Admin-Client
benutzt. Der Ablauf ist immer derselbe: mit dem Anon-Schlüssel und dem `Authorization`-
Header des Aufrufers einen Client bauen (für den gilt dann RLS), damit Rolle und Status
lesen, und erst danach den `service_role`-Client für die eigentliche Aktion.

Setzen der Secrets nach dem Anlegen des Supabase-Projekts:

```bash
supabase secrets set APP_URL="https://verein.example.org"
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set VAPID_PUBLIC_KEY="B..."     # npx web-push generate-vapid-keys
supabase secrets set VAPID_PRIVATE_KEY="..."
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase
selbst bereit.

## 5. Konfiguration

`scripts/local-db.sh` liest diese Umgebungsvariablen:

| Variable | Default |
|---|---|
| `PGHOST` | `127.0.0.1` |
| `PGPORT` | `5432` |
| `PGUSER` | `postgres` |
| `PGPASSWORD` | `postgres` |
| `DB_NAME` | `vereinsplaner` |

In der CI zeigen sie auf den `postgres:16`-Service-Container; lokal auf den Cluster der
Distribution. Das Passwort `postgres` ist bewusst trivial — die Instanz ist ausschließlich
lokal erreichbar und enthält nur Testdaten.

## 6. Abhängigkeiten und `npm audit`

`npm audit` gehört zu jeder Änderung an `package.json`. Der Befund ist aber nicht
gleichbedeutend mit einem Problem — was zählt, ist, ob der gemeldete Code in dieser
Anwendung überhaupt erreichbar ist.

Die Regel hier:

1. **Produktivabhängigkeit** (`npm audit --omit=dev`) → **beheben**, auch wenn der Umstieg
   wehtut. Was ausgeliefert wird, läuft im Browser eines Mitglieds.
2. **Entwicklungsabhängigkeit** → bewerten. Eine Lücke im Testrunner erreicht niemanden
   außer den Entwickler. Bei nächster Gelegenheit mitziehen, nicht um Mitternacht.
3. **Nicht erreichbar** → mit Begründung hier festhalten, nicht stillschweigend übergehen.
   Ein unbegründet ignorierter Befund ist beim nächsten Mal nicht mehr von einem
   übersehenen zu unterscheiden.

### Entscheidungen, die dokumentiert bleiben

**`xlsx` wird nicht benutzt** — GHSA-4r6h-8v6p-xvw6 (Prototype Pollution im
Tabellenblatt-Parser) ist auf npm bis heute nicht behoben, und betroffen ist genau der
Code, der eine hochgeladene Datei liest. Der Excel-Import (Aufgabe 9.5) nutzt deshalb
`exceljs`.

**`react-router-dom` läuft auf 7.x** — GHSA-wrjc-x8rr-h8h6 (Open Redirect über einen
Backslash in `<Link>` und `useNavigate`) betraf 6.x und wird dort nicht mehr behoben. Der
Umstieg von 6.30 auf 7.18 kostete nichts: Die hier benutzten Bestandteile (`Link`,
`NavLink`, `Navigate`, `Outlet`, `Route`, `Routes`, `RouterProvider`,
`createBrowserRouter`, `useLocation`, `useNavigate`, `useParams`, `useSearchParams`) sind
unverändert, und die Zukunftsschalter, vor denen 6.x in der Konsole warnte, sind in 7.x
die Voreinstellung.

**`uuid` unter `exceljs` bleibt, wie es ist** — GHSA-w5hq-g745-h8pq beschreibt eine
fehlende Bereichsprüfung in den Versionen 3, 5 und 6, **wenn ein `buf`-Argument übergeben
wird**. `exceljs` ruft `uuidv4()` an zwei Stellen ohne jedes Argument auf
(`lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`). Der Weg dorthin existiert nicht.
`npm audit fix --force` würde `exceljs` auf 3.4.0 zurückstufen — eine Hauptversion
zurück, um eine Lücke zu schließen, die nicht erreichbar ist.

**Die Befunde zu `vitest` und `esbuild`** betreffen den Entwicklungsserver und werden mit
dem nächsten Vitest-Sprung mitgenommen.
