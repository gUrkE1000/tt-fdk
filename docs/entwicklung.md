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

## 4. Konfiguration

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
