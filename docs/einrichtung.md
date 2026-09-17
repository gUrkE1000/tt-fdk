# 🚀 Erst-Einrichtung & Installation (TTV Spielplaner)

Dieses Dokument beschreibt die detaillierten Installationsschritte, die Einrichtung der Datenbank in Supabase sowie die Automatisierung des Kalenderabgleichs, der Qualitätsprüfungen und des Deployments.

---

## 💻 1. Lokale Entwicklungseinrichtung

Um das Projekt lokal auf deinem Computer zu installieren und auszuführen, befolge diese Schritte:

### Voraussetzungen  
* **Node.js** (Version 18.x oder neuer empfohlen)  
* **npm** (wird automatisch mit Node.js installiert)  
* Ein GitHub-Konto (für Deployment und CI/CD Actions)  

### Schritte  
1. **Repository klonen:**  
   ```bash
   git clone https://github.com/DEIN_BENUTZERNAME/DEIN_REPOSITORY.git
   cd DEIN_REPOSITORY
   ```
2. **Abhängigkeiten installieren:**  
   ```bash
   npm install
   ```
3. **Lokale Umgebungsvariablen konfigurieren:**  
   Erstelle eine Datei namens `.env.local` im Stammverzeichnis deines Projekts und trage dort deine Supabase-Verbindungsinformationen ein:
   ```env
   VITE_SUPABASE_URL=https://deine-projekt-id.supabase.co
   VITE_SUPABASE_ANON_KEY=dein-public-anon-key
   VITE_SYNC_SECRET=ein-sicheres-passwort-fuer-den-sync
   ```
4. **Entwicklungsserver starten:**  
   ```bash
   npm run dev
   ```
   Die Anwendung läuft nun unter [http://localhost:5173](http://localhost:5173).  
5. **Automatisierte Tests ausführen:**  
   ```bash
   npm test
   ```

---

## 🗄️ 2. Supabase-Datenbank-Setup

Die Anwendung verwendet Supabase als Backend. Um die Datenbanktabellen, Sicherheitsrichtlinien (RLS) und Helferfunktionen anzulegen:

1. Registriere dich kostenlos auf [supabase.com](https://supabase.com) und erstelle ein neues Projekt.  
2. Gehe in deinem Supabase-Dashboard zum Bereich **SQL Editor** (Symbol mit der Aufschrift `SQL` in der linken Navigationsleiste).  
3. Erstelle eine neue Abfrage ("New Query") und füge den gesamten Inhalt der Datei `supabase/migrations/20260808000000_init.sql` ein.  
4. Klicke oben rechts auf **Run**, um das Skript auszuführen.  
5. **E-Mail-Bestätigung deaktivieren (Wichtig für die Registrierung):**  
   Damit sich alle Benutzer ohne E-Mail-Bestätigung registrieren und sofort im Tool anmelden können, **muss** die E-Mail-Verifizierung deaktiviert werden:  
   * Navigiere im Supabase-Dashboard zu **Authentication** > **Providers** > **Email**.  
   * Deaktiviere die Option **"Confirm email"** (E-Mail bestätigen).  
   * Klicke unten auf **Save** (Speichern).  

### Besonderheiten des Migrationsskripts  
* **Idempotenz & Schema-Updates:** Das Skript verwendet `ADD COLUMN IF NOT EXISTS` und `CREATE TABLE IF NOT EXISTS`, um mehrfaches gefahrloses Ausführen zu ermöglichen.  
* **Postgres Transactional Enum Fix:** Beim Hinzufügen neuer Rolle-Werte (z. B. `'sportwart'` in `user_role`) führt das Skript ein explizites `COMMIT;` aus. Dies stellt sicher, dass PostgreSQL die neue Enum-Definition in einer eigenen Transaktion registriert und verhindert den Fehler `ERROR 55P04 (unsafe use of new enum value)`.  
* **Entkoppelte Profile:** Das Skript entfernt das native Foreign Key Constraint `profiles_id_fkey` zwischen `public.profiles` und `auth.users`, sodass Spielerprofile vorab ohne registrierten Benutzer angelegt werden können.  
* **PostgREST Dummy Filter Pattern:** Bei Blanket-Updates auf Tabellen (wie beim Zurücksetzen von Mannschaftszuordnungen) fügt das Skript bzw. der Frontend-Code stets eine Dummy-Bedingung wie `.neq('id', '00000000-0000-0000-0000-000000000000')` an, um PostgREST-Laufzeitfehler (`UPDATE requires a WHERE clause`) zu vermeiden.  

---

## ⚡ 3. Supabase Edge Function bereitstellen (`sync-calendars`)

Die Synchronisations-Engine, welche die ICS-Kalender direkt von myTischtennis.de herunterlädt, ist als **Supabase Edge Function** (`supabase/functions/sync-calendars/index.ts`) implementiert.

Du kannst die Funktion auf zwei Wegen bereitstellen:

### Weg A: Automatisch über GitHub Actions (Empfohlen 🚀)
Die Bereitstellung geschieht vollautomatisch bei jedem Push auf den `main`-Branch über `.github/workflows/deploy-edge-functions.yml`:

1. Gehe in deinem GitHub-Repository auf **Settings > Secrets and variables > Actions**.  
2. Erstelle ein Secret namens **`SUPABASE_ACCESS_TOKEN`**: Generiere das Token in deinem Supabase-Konto unter [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).  
3. Erstelle ein Secret namens **`SUPABASE_PROJECT_ID`**: Deine Projekt-Referenz-ID (z. B. `abcde12345`).  
4. Hinterlege die Umgebungsvariablen für die Edge-Function im Supabase-Dashboard unter **Settings > Edge Functions**:  
   * `SUPABASE_URL` = `https://DEINE_PROJEKT_REFERENZ_ID.supabase.co`  
   * `SUPABASE_SERVICE_ROLE_KEY` = (Dein geheimer `service_role`-Schlüssel)  
   * `SYNC_SECRET` = (Dein langes Synchronisations-Passwort)  

### Weg B: Manuell über die Supabase CLI  
```bash
supabase login
supabase link --project-ref DEINE_PROJEKT_REFERENZ_ID
supabase secrets set SUPABASE_URL="https://DEINE_PROJEKT_REFERENZ_ID.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="DEIN_SERVICE_ROLE_KEY"
supabase secrets set SYNC_SECRET="DEIN_VITE_SYNC_SECRET"
supabase functions deploy sync-calendars
```

---

## 🛠️ 4. GitHub-Secrets für Frontend & Hosting einrichten

Unter **Settings > Secrets and variables > Actions** in deinem GitHub-Repository benötigst du folgende Secrets:

* **`VITE_SUPABASE_URL`:** Deine Supabase API URL.  
* **`VITE_SUPABASE_ANON_KEY`:** Dein öffentlicher Supabase Anon-Schlüssel.  
* **`VITE_SYNC_SECRET`:** Synchronisations-Passwort für die Edge Function.  

---

## 🤖 5. GitHub Actions Workflows im Überblick

Das Repository verfügt über automatisierte GitHub Workflows in `.github/workflows/`:

1. **`deploy.yml`:** Baut und deployt das Frontend auf GitHub Pages bei Pushes auf den `main`-Branch.  
2. **`run-tests.yml`:** Führt den Vitest-Testsuite (`npm test`) bei Pushes und Pull Requests auf `main` oder `master` aus.  
3. **`code-quality.yml`:** Prüft die TypeScript-Kompilierung (`npx tsc --noEmit`) und führt Unit-Tests aus.  
4. **`sync-calendars.yml`:** Täglicher Cronjob (04:00 UTC), der die Supabase Edge Function `sync-calendars` aufruft. Er sendet die Header `Authorization: Bearer <VITE_SUPABASE_ANON_KEY>`, `apikey: <VITE_SUPABASE_ANON_KEY>` und `x-sync-secret: <VITE_SYNC_SECRET>`, um Kong/Supabase API-Gateway-Sicherheitsprüfungen zu bestehen.  
5. **`auto-version-badges.yml`:** Erstellt automatisch Versions-Tags und Badges bei Commits auf `main`/`master`.  
6. **`deploy-edge-functions.yml`:** Veröffentlicht Supabase Edge Functions automatisch.  
