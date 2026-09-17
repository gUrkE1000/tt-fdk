# Umsetzungsplan: Vom übernommenen Stand zur Vereinslösung

Stand: 17.09.2026 · Basis: Repo-Stand nach Merge von `dgaida/tt_hsv_planner` @ `f8ec2a5`

Dieses Dokument ist die einzige Quelle für die Umsetzung. Es ist für einen ausführenden Agenten
geschrieben, der **keine eigenen Architekturentscheidungen trifft**, sondern Aufgabe für Aufgabe
abarbeitet. Jede Aufgabe beschreibt den exakten Endzustand und den Weg dorthin. Wenn eine
Aufgabe eine Entscheidung offenlässt, ist das ein Fehler im Plan — dann stoppen und nachfragen,
nicht raten.

---

## Teil A — Regeln für den ausführenden Agenten

Diese Regeln gelten für **jede** Aufgabe. Sie werden in den Aufgaben nicht wiederholt.

### A.1 Arbeitsablauf pro Aufgabe

1. Aufgabe vollständig lesen, inklusive "Endzustand", "Verifikation" und "Nicht tun".
2. Alle unter "Dateien" genannten Dateien **vollständig lesen**, bevor die erste Zeile geändert
   wird. Auch die Testdateien.
3. Prüfen, ob die Voraussetzungen (vorherige Aufgaben) erfüllt sind: `git log --oneline -20`
   und die genannten Dateien/Spalten existieren.
4. Umsetzen. Nur die Dateien anfassen, die in der Aufgabe genannt sind, plus neue Dateien, die
   die Aufgabe explizit vorsieht. Muss eine weitere Datei geändert werden, ist das in einem
   Satz im Commit zu begründen.
5. Verifikation exakt so ausführen, wie in der Aufgabe beschrieben. Alle drei Grundprüfungen
   müssen grün sein:
   ```bash
   npx tsc --noEmit
   npm test
   npm run build
   ```
   `npm run lint` **nicht** verwenden — ESLint ist im Projekt nicht installiert, das Skript
   schlägt fehl.
6. Einen Commit pro Aufgabe. Commit-Titel wie in der Aufgabe vorgegeben. Im Body in 2–5 Zeilen:
   was geändert wurde und wie es verifiziert wurde.
7. Nach dem Commit den Abschnitt "Status" am Ende dieses Dokuments aktualisieren (Aufgabe als
   erledigt markieren, Datum, Commit-Hash).

### A.2 Unverrückbare Konventionen

| Thema | Regel |
|---|---|
| Sprache | UI-Texte, Kommentare in neuen Dateien, Commit-Messages: Deutsch. Bezeichner im Code: Englisch, wie im Bestand (`team_number`, `availabilities`). |
| Datenbank-Migrationen | `supabase/migrations/20260808000000_init.sql` wird **nie** geändert. Jede Schemaänderung ist eine neue Datei `supabase/migrations/YYYYMMDDHHMMSS_<slug>.sql` (UTC-Zeitstempel, slug in snake_case). Jede Migration ist **idempotent**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` vor `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, `INSERT … ON CONFLICT DO NOTHING`. Kein `COMMIT;` in Migrationsdateien. |
| Row Level Security | Bleibt auf allen Tabellen aktiviert. Neue Tabellen: sofort `ENABLE ROW LEVEL SECURITY` und Policies in derselben Migration. |
| Typen | Neue Funktionen bekommen explizite TypeScript-Typen. `any` nur dort, wo der Bestand es bereits erzwingt (z. B. Supabase-Rohdaten in Komponenten). |
| Geteilte Logik für Edge Functions | Reine Logik ohne Laufzeit-Abhängigkeiten liegt in `supabase/functions/_shared/<name>.ts` und wird von Frontend (`import … from '../../supabase/functions/_shared/<name>'`) **und** Edge Functions (`import … from '../_shared/<name>.ts'`) importiert. Kein Deno-spezifischer Import in `_shared`. |
| Tests | Jede neue Datei in `src/lib/` oder `_shared/` bekommt eine Testdatei `tests/<name>.test.ts`. Komponentenänderungen erweitern die bestehende Testdatei. Mock-Muster für Supabase: siehe `tests/AdminDashboard.test.tsx` (`vi.mock('../src/lib/supabaseClient', …)` mit `from: vi.fn()`). |
| Einstellungen | Vereinsweite Einstellungen liegen in `club_settings` (Key/Value, beides `TEXT`). Zugriff im Frontend **ausschließlich** über `src/lib/clubSettings.ts` (entsteht in Aufgabe 1.1). Keine direkten `from('club_settings')`-Aufrufe in Komponenten. |
| Fremde Dienste | Keine neuen externen Dienste ohne Nennung im Plan. Erlaubt: Supabase, Resend (E-Mail), GitHub Actions, Web Push (VAPID, kein Drittanbieter). |
| Was nicht angefasst wird | `docs/upstream-README.md`, `NOTICE.md`, `REQUIREMENTS.md` (Upstream-Dokument, bleibt als Referenz), `.github/workflows/auto-version-badges.yml` (wird in 0.6 gelöscht, sonst nicht angefasst). |

### A.3 Definition of Done (gilt für jede Aufgabe)

- [ ] Alle Punkte unter "Endzustand" der Aufgabe sind erfüllt und einzeln geprüft.
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` sind grün.
- [ ] Neue Logik hat Tests; bestehende Tests wurden angepasst, nicht gelöscht oder übersprungen
      (`it.skip`, `describe.skip`, `xit` sind verboten).
- [ ] Dokumentation aktualisiert, wenn die Aufgabe es verlangt.
- [ ] Ein Commit mit dem vorgegebenen Titel.
- [ ] Status-Tabelle am Dokumentende aktualisiert.

### A.4 Wenn etwas nicht passt

- Eine genannte Datei/Zeile existiert nicht mehr an der beschriebenen Stelle → per `grep` die
  aktuelle Stelle suchen; die Beschreibung des Verhaltens gilt, nicht die Zeilennummer.
- Ein Test schlägt fehl, der nichts mit der Aufgabe zu tun hat → **nicht** anfassen, sondern
  im Commit-Body nennen und in der Status-Tabelle als "Blocker" eintragen.
- Etwas ist unklar → Aufgabe nicht beginnen. In der Status-Tabelle unter "Fragen" eintragen.

---

## Teil B — Zielarchitektur (Referenz, keine Aufgabe)

Damit alle Aufgaben in dieselbe Richtung laufen. Details entstehen in den Aufgaben.

```
┌──────────────────────────── Browser (PWA) ────────────────────────────┐
│ React/Vite/Tailwind · Service Worker (Phase 5) · Web-Push-Empfang      │
│ Login: Magic Link per E-Mail (Phase 2) · Vereinspasswort-Gate bleibt   │
└───────────────┬──────────────────────────────────────┬────────────────┘
                │ supabase-js (anon key + JWT)          │ functions.invoke
┌───────────────▼──────────────────────────────────────▼────────────────┐
│ Supabase (EU-Region)                                                   │
│  Postgres + RLS (rollenbasiert, Phase 2)                               │
│  Tabellen Bestand: club_settings, profiles, teams, team_players,       │
│    matches, availabilities, absences, sync_runs, match_changes         │
│  Tabellen neu:  notifications (Outbox), match_reminders,               │
│    substitute_requests, push_subscriptions                             │
│  pg_cron + pg_net: ruft Edge Functions zeitgesteuert (Phase 3)         │
│  Edge Functions:                                                       │
│    sync-calendars      (Bestand, wird abgesichert)                     │
│    process-notifications (Phase 3: Outbox → E-Mail/Push)               │
│    enqueue-reminders   (Phase 3: Erinnerungen in Outbox schreiben)     │
│    substitute-engine   (Phase 4: Ersatzkette)                          │
│    invite-member       (Phase 3: Einladung per Magic Link)             │
└───────────────┬──────────────────────────────────────┬────────────────┘
                │ fetch ICS (webcal)                    │ HTTPS
        myTischtennis / click-TT                 Resend (E-Mail) · Web Push
```

**Datenfluss Erinnerung (Phase 3):** pg_cron (alle 10 min) → `enqueue-reminders` prüft
`matches` gegen `reminder_offsets_hours` → schreibt je Spieler ohne Rückmeldung eine Zeile in
`notifications` (idempotent über `match_reminders`) → pg_cron → `process-notifications` sendet
alles mit `sent_at IS NULL` per E-Mail und/oder Push und setzt `sent_at`.

**Datenfluss Ersatzkette (Phase 4):** Absage eines Stammspielers → Client ruft
`substitute-engine` für das Spiel auf (zusätzlich pg_cron alle 10 min für Timeouts) → Engine
berechnet über reine Funktion `planSubstituteStep()` den nächsten Schritt → schreibt
`substitute_requests` + `notifications` → Spieler antwortet über Link/App → seine
`availabilities`-Zeile ist die Antwort → Engine wertet beim nächsten Lauf aus.

---

## Teil C — Phase 0: Lokal lauffähig machen

Ziel der Phase: Ein Entwickler (oder der Agent) kann das Projekt auf einem Rechner klonen,
gegen eine eigene Supabase-Instanz starten, sich einloggen und Tests ausführen.
Nach dieser Phase existiert **noch keine** Vereins-Anpassung — nur der Betrieb des Bestands.

### Aufgabe 0.1 — Repository lokal einrichten

**Ziel:** Projekt läuft lokal im Dev-Modus mit Platzhalter-Backend, Tests grün.

**Voraussetzungen:** Node.js ≥ 20 (`node -v`), npm ≥ 10, Git. Optional Docker (für 0.3).

**Dateien:** keine Änderungen; nur Prüfung.

**Endzustand:**
- `npm install` läuft ohne Fehler durch (Warnungen zu `npm audit` sind zulässig).
- `npm test` meldet `Test Files 18 passed`, `Tests 87 passed` (oder mehr, nie weniger).
- `npx tsc --noEmit` ohne Ausgabe.
- `npm run build` erzeugt `dist/` mit `index.html` und `assets/`.
- `npm run dev` startet auf `http://localhost:5173` und zeigt den Passwort-Gate-Screen
  ("Spielbereitschafts-Planer … Vereinspasswort"). Login funktioniert noch **nicht**, weil
  kein Backend konfiguriert ist — das ist erwartet.

**Vorgehen:**
```bash
git clone https://github.com/gUrkE1000/tt-fdk.git
cd tt-fdk
git checkout claude/tt-planer-alternative-bc8mku   # bis der Branch nach main gemerged ist
npm install
npx tsc --noEmit && npm test && npm run build
npm run dev
```

**Verifikation:** Die vier Befehle oben liefern die genannten Ergebnisse. Browser zeigt den
Gate-Screen. Dev-Server mit `Ctrl+C` beenden.

**Nicht tun:** `npm audit fix --force` ausführen. Keine Dependency-Updates.

**Commit:** keiner (keine Änderung).

---

### Aufgabe 0.2 — Supabase-Projekt anlegen und Baseline-Schema einspielen (manuell, Mensch)

Diese Aufgabe erledigt ein Mensch im Browser. Der Agent kann sie nicht ausführen, aber prüfen.

**Ziel:** Ein Supabase-Projekt in der EU mit dem Baseline-Schema.

**Endzustand:**
- Supabase-Projekt existiert, Region `eu-central-1` (Frankfurt) oder `eu-west-*`. Nicht US.
- Im SQL-Editor wurde `supabase/migrations/20260808000000_init.sql` **komplett** ausgeführt.
  Erwartetes Ergebnis: "Success. No rows returned" oder Meldungen über eingefügte Zeilen.
- Unter Authentication → Providers → Email ist "Confirm email" **deaktiviert** (wird in
  Phase 2 wieder aktiviert; bis dahin folgt das Projekt der Upstream-Doku).
- Die drei Werte sind notiert: Project URL, `anon` public key, `service_role` key
  (letzterer geheim, nie ins Repo).
- In der Tabelle `teams` stehen drei Seed-Mannschaften, in `profiles` drei Seed-Spieler.

**Vorgehen:** [docs/einrichtung.md](einrichtung.md) Abschnitt 2 befolgen. Zusätzlich:
Settings → General → Region prüfen.

**Verifikation (durch den Agenten, sobald `.env.local` aus 0.4 existiert):**
```bash
# Ersetze URL/KEY durch die Werte aus .env.local
curl -s "$VITE_SUPABASE_URL/rest/v1/teams?select=name" -H "apikey: $VITE_SUPABASE_ANON_KEY"
# Erwartet: [{"name":"Erwachsene I"},{"name":"Erwachsene II"},{"name":"Erwachsene III"}]
```

**Commit:** keiner.

---

### Aufgabe 0.3 — Supabase CLI und lokale Datenbank (optional, empfohlen für Phase 2)

**Ziel:** Migrationen können lokal gegen eine Docker-Postgres getestet werden, bevor sie
das echte Projekt berühren. Ab Phase 2 (RLS-Tests mit pgTAP) ist das Pflicht.

**Voraussetzungen:** Docker Desktop läuft (`docker ps` funktioniert).

**Dateien:** neu `supabase/config.toml` (generiert), neu `supabase/seed.sql`, Änderung
`.gitignore`.

**Endzustand:**
- `supabase/config.toml` existiert (durch `supabase init` erzeugt) und ist eingecheckt.
- `.gitignore` enthält zusätzlich die Zeilen `supabase/.branches`, `supabase/.temp`.
- `supabase/seed.sql` existiert und ist zunächst **leer bis auf einen Kommentar**
  (`-- Lokale Seed-Daten. Wird in Aufgabe 1.6 gefüllt.`).
- `supabase start` startet die lokale Instanz; `supabase db reset` wendet alle Migrationen an
  und endet ohne Fehler.
- `docs/einrichtung.md` hat einen neuen Abschnitt "1b. Lokale Supabase-Instanz (Docker)" mit
  den Befehlen unten.

**Vorgehen:**
```bash
npm install --save-dev supabase        # CLI als Dev-Dependency, Version pinnen
npx supabase init                      # erzeugt supabase/config.toml; Fragen mit Enter/N bestätigen
npx supabase start                     # lädt Docker-Images, dauert beim ersten Mal einige Minuten
npx supabase db reset                  # wendet supabase/migrations/* und seed.sql an
```
Ausgabe von `supabase start` enthält `API URL`, `anon key`, `service_role key` der lokalen
Instanz. Diese Werte gehören in `.env.local`, wenn lokal entwickelt wird (siehe 0.4).

**Bekanntes Risiko:** `20260808000000_init.sql` enthält in Zeile ~21 ein `COMMIT;`. Falls
`supabase db reset` daran scheitert (Meldung enthält `COMMIT` oder `no transaction`), gilt
diese einmalige Ausnahme von Regel A.2: Die Datei wird an der `COMMIT;`-Zeile in zwei Dateien
geteilt — `20260808000000_init_enums.sql` (alles davor, ohne das `COMMIT;`) und
`20260808000001_init.sql` (alles danach). Inhalt sonst byteweise unverändert. Das ist im
Commit-Body zu nennen. Das echte Supabase-Projekt (0.2) ist davon nicht betroffen, weil dort
bereits alles eingespielt ist.

**Verifikation:**
```bash
npx supabase db reset 2>&1 | tail -5     # endet mit "Finished supabase db reset"
npx supabase status                      # zeigt laufende Dienste
```

**Commit:** `Supabase CLI und lokale Instanz einrichten`

---

### Aufgabe 0.4 — Umgebungsvariablen und erster Login

**Ziel:** Die App läuft lokal gegen das Supabase-Projekt (Cloud aus 0.2 oder lokal aus 0.3).

**Dateien:** `.env.local` (lokal, **nicht** einchecken; steht in `.gitignore`).

**Endzustand:**
- `.env.local` enthält `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SYNC_SECRET`
  (letzteres ein frei gewählter String ≥ 24 Zeichen).
- `npm run dev` → Gate-Screen → Passwort `Tischtennis2026` (Seed-Default) → Login-Screen
  mit Tab "Direkt-Auswahl" → Dropdown zeigt "Max M (1600 TTR)", "Mia M (1500 TTR)",
  "Hans M (1000 TTR)".
- Auswahl "Max M" → App zeigt Tabs "🏅 Erwachsene I/II/III", "Gesamtübersicht",
  "Mein Kalender", "Anleitung". Rolle im Header: "Spieler" (passwortlos = immer Spieler).

**Vorgehen:** `cp .env.example .env.local`, Werte eintragen, `npm run dev`.

**Verifikation:** Der beschriebene Klickpfad funktioniert. In der Browser-Konsole keine roten
Fehler außer ggf. CORS-Warnungen des Kalender-Syncs (die Seed-Webcal-URLs sind Platzhalter).

**Commit:** keiner.

---

### Aufgabe 0.5 — Edge Function deployen und Cron-Sync scharf schalten (Cloud-Projekt)

**Ziel:** Der tägliche Kalender-Sync läuft serverseitig.

**Voraussetzungen:** 0.2, 0.4. Supabase-CLI aus 0.3 (auch ohne Docker nutzbar für `login`,
`link`, `functions deploy`).

**Dateien:** keine Repo-Änderung. GitHub-Secrets werden gesetzt.

**Endzustand:**
- Edge Function `sync-calendars` ist im Cloud-Projekt deployed (Dashboard → Edge Functions).
- Function-Secrets gesetzt: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`
  (identisch mit `VITE_SYNC_SECRET`).
- GitHub Repository-Secrets gesetzt: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_SYNC_SECRET`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`.
- Ein manueller Aufruf des Workflows `Daily Webcal Sync` (Actions → workflow_dispatch) endet
  grün und in der Tabelle `sync_runs` erscheint eine neue Zeile mit `status` = `success`
  oder `warning` (warning ist bei Platzhalter-URLs erwartet).

**Vorgehen:** [docs/einrichtung.md](einrichtung.md) Abschnitt 3 Weg B und Abschnitt 4.

**Verifikation:** `sync_runs` im Table Editor prüfen; Admin-Dashboard in der App zeigt den Lauf
unter "Synchronisationsberichte".

**Commit:** keiner.

---

### Aufgabe 0.6 — Geerbte Workflows bereinigen

**Ziel:** Nur Workflows, die für dieses Repo sinnvoll sind und nicht auf Upstream zeigen.

**Dateien:** löschen `.github/workflows/auto-version-badges.yml`; ändern
`.github/workflows/deploy.yml`, `README.md`, `docs/einrichtung.md`.

**Endzustand:**
- `auto-version-badges.yml` existiert nicht mehr (nutzte `dgaida/auto-version-action` und
  schrieb Badges auf das Upstream-Repo).
- `deploy.yml`: Tippfehler `node-size: 20` → `node-version: 20` korrigiert. Sonst unverändert.
- README-Abschnitt "Vor dem ersten Deploy": der Punkt zu `auto-version-badges.yml` ist entfernt.
- `docs/einrichtung.md` Abschnitt 5: Punkt 5 (`auto-version-badges.yml`) entfernt, Punkte
  neu nummeriert.

**Verifikation:** `ls .github/workflows` zeigt 5 Dateien. `grep -rn "auto-version" . --exclude-dir=node_modules --exclude-dir=.git` liefert nur Treffer in `NOTICE.md`/`docs/funktionsvergleich.md`/`docs/umsetzungsplan.md` (Dokumentation), nicht in Workflows oder README.

**Commit:** `Geerbte Workflows bereinigen`

---

## Teil D — Phase 1: Vereinsspezifika parametrisieren

Ziel der Phase: Kein Vereinsname, keine Verbandskennung, keine Kadergröße und keine Demodaten
mehr im Code. Alles kommt aus `club_settings` bzw. `teams`.

### Aufgabe 1.1 — Zentrales Settings-Modul und neue Settings-Keys

**Ziel:** Ein typsicheres Modul, über das das Frontend alle Vereinseinstellungen liest und
schreibt, plus die Migration, die die neuen Keys mit Defaults anlegt.

**Dateien:** neu `src/lib/clubSettings.ts`, neu `tests/clubSettings.test.ts`, neu
`supabase/migrations/<ts>_club_settings_keys.sql`.

**Endzustand — Migration:**
```sql
INSERT INTO public.club_settings (key, value) VALUES
  ('club_name', 'Mein Tischtennisverein'),
  ('club_short_name', 'MTTV'),
  ('club_aliases', ''),                 -- kommagetrennt, kleingeschrieben, für Heim/Auswärts-Erkennung
  ('club_nr', ''),                      -- click-TT Vereinsnummer
  ('verband', 'WTTV'),                  -- click-TT Verbandskürzel im URL-Pfad
  ('club_slug', ''),                    -- URL-Segment des Vereins auf myTischtennis, z. B. Heiligenhauser_SV
  ('default_lineup_size', '4'),         -- Stammspieler je Spiel; pro Mannschaft überschreibbar (Aufgabe 1.4)
  ('registered_teams_count', '3')       -- existiert ggf. schon; ON CONFLICT DO NOTHING
ON CONFLICT (key) DO NOTHING;
```
Der Seed-Wert `club_nr` `'21707'` aus dem Bestand darf **nicht** als Default übernommen werden
(gehört dem Upstream-Verein).

**Endzustand — `src/lib/clubSettings.ts`:**
```ts
export const CLUB_SETTING_KEYS = [
  'club_name', 'club_short_name', 'club_aliases', 'club_nr', 'verband',
  'club_slug', 'default_lineup_size', 'registered_teams_count',
] as const;
export type ClubSettingKey = typeof CLUB_SETTING_KEYS[number];

export interface ClubSettings {
  clubName: string;
  clubShortName: string;
  clubAliases: string[];        // bereits gesplittet, getrimmt, kleingeschrieben, leere entfernt
  clubNr: string;
  verband: string;
  clubSlug: string;
  defaultLineupSize: number;    // parseInt, Fallback 4
  registeredTeamsCount: number; // parseInt, Fallback 3
}

export const DEFAULT_CLUB_SETTINGS: ClubSettings = { /* Werte wie in der Migration */ };

/** Reine Funktion: Key/Value-Zeilen → ClubSettings. Unbekannte Keys ignorieren, fehlende Keys mit Defaults füllen. */
export function parseClubSettings(rows: { key: string; value: string }[]): ClubSettings;

/** Liest alle Keys aus club_settings. Bei Fehler: DEFAULT_CLUB_SETTINGS zurückgeben und console.warn. */
export async function loadClubSettings(supabase: SupabaseClient): Promise<ClubSettings>;

/** Upsert eines einzelnen Keys (onConflict: 'key'). Wirft bei Fehler. */
export async function saveClubSetting(supabase: SupabaseClient, key: ClubSettingKey, value: string): Promise<void>;

/** Wandelt ClubSettings-Felder für die Home/Away-Erkennung in eine Alias-Liste: clubAliases ∪ {clubName, clubShortName}, alles kleingeschrieben, ohne Duplikate/Leerstrings. */
export function buildClubAliasList(settings: ClubSettings): string[];
```
Der Supabase-Client wird als Parameter übergeben (nicht importiert), damit die Funktionen
mit dem bestehenden Mock-Muster testbar sind.

**Endzustand — Tests (`tests/clubSettings.test.ts`), mindestens:**
- `parseClubSettings([])` liefert `DEFAULT_CLUB_SETTINGS`.
- `parseClubSettings([{key:'club_aliases', value:' TTC Beispiel, Beispiel '}])` →
  `clubAliases` = `['ttc beispiel','beispiel']`.
- `parseClubSettings([{key:'default_lineup_size', value:'abc'}])` → `defaultLineupSize` = 4.
- `buildClubAliasList` enthält `clubName` und `clubShortName` kleingeschrieben und keine
  Duplikate.
- `loadClubSettings` mit einem Mock, dessen `select` einen Fehler liefert → Defaults, kein
  Throw.

**Vorgehen:** Migration schreiben → Modul schreiben → Tests schreiben → `npm test`.
Migration lokal (`npx supabase db reset`) oder im SQL-Editor des Cloud-Projekts ausführen.

**Verifikation:** Grundprüfungen. `SELECT key FROM club_settings ORDER BY key;` zeigt die
8 neuen Keys plus `club_password_hash` (und ggf. bereits vorhandene).

**Nicht tun:** Bestehende Komponenten anfassen — das ist 1.2/1.3.

**Commit:** `Zentrales Modul und Keys fuer Vereinseinstellungen`

---

### Aufgabe 1.2 — Heim/Auswärts-Erkennung ohne hart verdrahteten Vereinsnamen

**Ziel:** `determineHomeAway` erkennt den eigenen Verein über eine übergebene Alias-Liste;
Client-Sync und Edge Function lesen die Liste aus `club_settings`.

**Dateien:** `src/lib/icsParser.ts`, `src/lib/syncEngine.ts`,
`supabase/functions/sync-calendars/index.ts`, `tests/icsParser.test.ts`,
`tests/realCalendarSync.test.ts`, `tests/syncEngine.test.ts`,
`tests/syncCalendarsFunction.test.ts`; neu `supabase/functions/_shared/homeAway.ts`,
neu `tests/homeAway.test.ts`.

**Endzustand — `supabase/functions/_shared/homeAway.ts`:**
```ts
export interface HomeAwayInfo { isHome: boolean; opponent: string; }

/**
 * Erkennt anhand des ICS-SUMMARY ("A vs B"), ob unser Verein Heimmannschaft ist.
 * clubAliases: kleingeschriebene Namensbestandteile des eigenen Vereins.
 * teamName/teamShortName: wie bisher zusätzlich als Treffer gewertet.
 * Verhalten bei Mehrdeutigkeit (beide oder keine Seite erkannt): isHome = true, opponent = rechte Seite. (Bestandsverhalten, unverändert)
 */
export function determineHomeAway(summary: string, teamName: string, teamShortName: string, clubAliases: string[]): HomeAwayInfo;
```
Die Implementierung ist die bisherige aus `icsParser.ts`, wobei der Block
`lower.includes('heiligenhaus') || lower.includes('heiligenhauser')` ersetzt wird durch
`clubAliases.some(alias => alias && lower.includes(alias))`.

**Endzustand — `src/lib/icsParser.ts`:** exportiert `determineHomeAway` und `HomeAwayInfo`
per Re-Export aus `_shared/homeAway` (`export { determineHomeAway } from '../../supabase/functions/_shared/homeAway'; export type { HomeAwayInfo } …`). Die alte Implementierung ist entfernt. Kein String `heiligenhaus` mehr in `src/`.

**Endzustand — `src/lib/syncEngine.ts`:** `syncTeamCalendar(supabase, teamId)` lädt vor der
Verarbeitung `loadClubSettings(supabase)` und übergibt `buildClubAliasList(settings)` an
`determineHomeAway`. Signatur von `syncTeamCalendar` bleibt unverändert.

**Endzustand — Edge Function:** Die lokale Kopie von `determineHomeAway` in
`sync-calendars/index.ts` ist gelöscht; stattdessen `import { determineHomeAway } from '../_shared/homeAway.ts';`. Vor der Team-Schleife liest die Function
`SELECT key, value FROM club_settings WHERE key IN ('club_name','club_short_name','club_aliases')`
und baut die Alias-Liste (gleiche Logik wie `buildClubAliasList`, inline in der Function,
da `clubSettings.ts` supabase-js aus `src` importiert und nicht in Deno laufen soll).

**Endzustand — Tests:**
- `tests/homeAway.test.ts`: (a) Alias trifft linke Seite → isHome true, opponent rechts;
  (b) Alias trifft rechte Seite → isHome false; (c) kein Alias, teamName trifft → wie bisher;
  (d) leere Alias-Liste und kein Treffer → isHome true (Bestandsverhalten);
  (e) Alias-Vergleich ist case-insensitive.
- Bestehende Tests, die `determineHomeAway(summary, teamName, shortName)` mit 3 Argumenten
  aufrufen, bekommen als 4. Argument `['heiligenhaus', 'heiligenhauser']` — damit bleiben
  die Erwartungen der Upstream-Tests (die reale Kalenderdaten des Upstream-Vereins nutzen)
  gültig, ohne dass der Name im Produktivcode steht.
- `tests/syncEngine.test.ts`: Mock um `club_settings` erweitern (Tabelle `club_settings` →
  `select` → resolves `{ data: [{key:'club_aliases', value:'heiligenhaus'}], error: null }`).

**Verifikation:** Grundprüfungen. `grep -rni heiligenhaus src/ supabase/functions/` liefert
**keinen** Treffer. `grep -rni heiligenhaus tests/` liefert Treffer (erlaubt).

**Nicht tun:** `parseIcs`/`extractMatchday` verschieben — das ist bewusst nicht Teil dieser
Aufgabe (Duplikat in der Edge Function bleibt vorerst).

**Commit:** `Heim/Auswaerts-Erkennung ueber konfigurierbare Vereins-Aliase`

---

### Aufgabe 1.3 — Kader-Import ohne feste Verbands-URL

**Ziel:** Die URL für den HTML-Kader-Import entsteht aus `verband`, `club_nr`, `club_slug`,
Saison und Runde. Fehlende Werte führen zu einer verständlichen Fehlermeldung statt zu einer
falschen URL.

**Dateien:** `src/components/SportwartView.tsx`, `tests/SportwartView.test.tsx`; neu
`src/lib/rosterUrl.ts`, neu `tests/rosterUrl.test.ts`.

**Endzustand — `src/lib/rosterUrl.ts`:**
```ts
export interface RosterUrlParams { verband: string; clubNr: string; clubSlug: string; season: string; round: 'vr' | 'rr'; }
/** Baut https://www.mytischtennis.de/click-tt/<verband>/<season>/verein/<clubNr>/<clubSlug>/meldungendetails/E/<round>
 *  Wirft Error('Vereinsnummer fehlt in den Einstellungen') / ('Vereins-URL-Kürzel fehlt …') / ('Verband fehlt …') bei leeren Werten. */
export function buildRosterUrl(p: RosterUrlParams): string;
/** Aktuelle Saison im myTischtennis-Format, z. B. '26--27' für 2026/27. Saisonwechsel: ab 1. Juli zählt das neue Jahr. */
export function currentSeasonSlug(now?: Date): string;
```

**Endzustand — `SportwartView.tsx`:**
- `handleDownloadRoster` lädt `loadClubSettings(supabase)` und ruft `buildRosterUrl(...)`.
  Der Default-String `'21707'` und der Pfad `Heiligenhauser_SV` existieren nicht mehr.
- `scrapedSeason` wird mit `currentSeasonSlug()` initialisiert statt mit `'26--27'`.
- Fehlermeldung aus `buildRosterUrl` wird per `alert` angezeigt (Bestandsmuster).
- Der bisherige `try { … club_nr … } catch` in `handleDownloadRoster` ist durch den Aufruf
  von `loadClubSettings` ersetzt. Die Settings-Zeilen zu `registered_teams_count`
  (Zeilen ~508 und ~537) nutzen `loadClubSettings`/`saveClubSetting`.

**Tests:** `rosterUrl.test.ts`: korrekte URL für vollständige Parameter; je ein Throw pro
fehlendem Pflichtwert; `currentSeasonSlug(new Date('2026-09-17'))` = `'26--27'`,
`currentSeasonSlug(new Date('2026-03-01'))` = `'25--26'`. `SportwartView.test.tsx`: Mock für
`club_settings` ergänzen; ein Test, dass bei leerer `club_nr` ein `alert` mit
"Vereinsnummer fehlt" erscheint und **kein** `fetch` ausgelöst wird.

**Verifikation:** Grundprüfungen. `grep -n "21707\|Heiligenhauser_SV" src/` ohne Treffer.

**Commit:** `Kader-Import-URL aus Vereinseinstellungen aufbauen`

---

### Aufgabe 1.4 — Mannschaftsnummer und Kadergröße als Spalten in `teams`

**Ziel:** Die Mannschaftsnummer ist eine explizite Spalte, nicht der Index der alphabetisch
sortierten Teamliste. Die Kadergröße ist pro Mannschaft konfigurierbar.

**Hintergrund (für das Verständnis, nicht ändern ohne Auftrag):** Der Bestand leitet die
Nummer über `[...activeTeams].sort(byName)` und `findIndex + 1` ab
(`TeamTabView.getLineupForMatch`, `TeamTabView.resolveRsvpConflicts`, `App.loadProfileAndTeams`,
`SportwartView` Mapping `teams[sp.teamNumber - 1]`, `GesamtUebersichtView` ~Zeile 200).
Das funktioniert nur, solange die Namen "Erwachsene I/II/III" heißen.

**Dateien:** neu `supabase/migrations/<ts>_teams_number_and_lineup_size.sql`; neu
`src/lib/teamUtils.ts`; neu `tests/teamUtils.test.ts`; ändern `src/App.tsx`,
`src/components/TeamTabView.tsx`, `src/components/SportwartView.tsx`,
`src/components/GesamtUebersichtView.tsx`, `src/components/AdminDashboard.tsx`,
`tests/App.test.tsx`, `tests/TeamTabView.test.tsx`, `tests/SportwartView.test.tsx`,
`tests/GesamtUebersichtView.test.tsx`, `tests/AdminDashboard.test.tsx`, `docs/datenbank.md`.

**Endzustand — Migration:**
```sql
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_number INTEGER;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS lineup_size INTEGER NOT NULL DEFAULT 4;
-- Backfill: bestehende Teams nach Name sortiert durchnummerieren (einmalig, nur wo NULL)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn FROM public.teams WHERE team_number IS NULL
)
UPDATE public.teams t SET team_number = n.rn FROM numbered n WHERE t.id = n.id;
CREATE UNIQUE INDEX IF NOT EXISTS teams_team_number_unique ON public.teams(team_number);
ALTER TABLE public.teams ADD CONSTRAINT teams_lineup_size_check CHECK (lineup_size BETWEEN 2 AND 8);
```
(Constraint-Name vorher mit `DROP CONSTRAINT IF EXISTS` absichern.)

**Endzustand — `src/lib/teamUtils.ts`:**
```ts
export interface TeamLike { id: string; name: string; team_number: number | null; lineup_size?: number | null; }
export function getTeamByNumber<T extends TeamLike>(teams: T[], teamNumber: number | null | undefined): T | undefined;
export function getTeamNumberById(teams: TeamLike[], teamId: string): number | null;
export function getLineupSize(team: TeamLike | undefined, defaultSize: number): number; // team.lineup_size ?? defaultSize
```

**Endzustand — Komponenten:** Jede Stelle, die bisher `sort(byName)` + Index nutzt, verwendet
`getTeamNumberById` bzw. `getTeamByNumber`. Konkret:
- `App.tsx`: Default-Tab = `getTeamByNumber(activeTeams, prof.team_number)?.id`, Fallback
  erstes Team.
- `TeamTabView.tsx`: `getLineupForMatch` → `teamIndex = getTeamNumberById(activeTeams, teamId)`;
  `resolveRsvpConflicts` → `homeTeamId = getTeamByNumber(sortedTeams, profile.team_number)?.id`.
- `SportwartView.tsx`: `teams[sp.teamNumber - 1]` → `getTeamByNumber(teams, sp.teamNumber)`
  (zwei Stellen: automatischer und manueller Import) sowie die Stelle um Zeile ~620.
- `GesamtUebersichtView.tsx` ~Zeile 200: `teamIdx` → `getTeamNumberById`.
- `AdminDashboard.tsx`: Team-Formular (anlegen/bearbeiten) hat zwei neue Felder
  "Mannschaftsnummer" (number, Pflicht) und "Stammspieler je Spiel" (number, Default 4, 2–8).
  Beide werden gespeichert.
- Teams werden überall nach `team_number` sortiert (`.order('team_number')`), nicht mehr nach
  `name`.

**Endzustand — `lineup_size` wird in dieser Aufgabe nur gespeichert, noch nicht verwendet.**
Die Verwendung ist Aufgabe 1.5.

**Tests:** `teamUtils.test.ts` für alle drei Funktionen inkl. `null`-Fällen. Komponententests:
Mock-Teams bekommen `team_number` und `lineup_size`; bestehende Erwartungen bleiben erfüllt.

**Verifikation:** Grundprüfungen. `grep -rn "findIndex((t) => t.id" src/` ohne Treffer.
`grep -rn "sort((a, b) => a.name.localeCompare(b.name))" src/` ohne Treffer in Team-Kontext.
Manuell: Team "Erwachsene II" in "Jugend" umbenennen → Aufstellung von Team 2 bleibt korrekt.

**Commit:** `Mannschaftsnummer und Kadergroesse als Spalten in teams`

---

### Aufgabe 1.5 — Kadergröße überall aus `lineup_size` ableiten

**Ziel:** Keine festen `4`/`5` mehr in Aufstellung, Warnungen und WhatsApp-Text.

**Dateien:** `src/components/TeamTabView.tsx`, `src/components/TeamMatrixView.tsx`,
`src/components/GesamtUebersichtView.tsx`, `src/lib/whatsappUtils.ts`,
`tests/whatsappUtils.test.ts`, `tests/TeamTabView.test.tsx`, `tests/GesamtUebersichtView.test.tsx`,
`docs/nutzung.md`, `docs/architektur.md`.

**Endzustand:**
- `generateWhatsAppMessage(match, matchAvailabilities, allProfiles, teamPlayers, allMatches, allTeams, lineupSize = 4)`: neuer letzter Parameter mit Default 4 (Rückwärtskompatibilität der Tests). Alle `4` in der Funktion (`>= 4`, `slice(0, 4)`, `4 - yesAvails.length`, `length > 4`, `[4]`) durch `lineupSize` ersetzt.
- `TeamTabView.getLineupForMatch`: `position_number <= 4` → `<= lineupSize`;
  `slice(0, 5)` → `slice(0, lineupSize + 1)`; Warnschwelle `countJa < 4` → `< lineupSize`;
  Beschriftung `"Aufstellung (Stamm 1-4 / Ersatz)"` → `` `Aufstellung (Stamm 1-${lineupSize} / Ersatz)` ``.
  `lineupSize` kommt aus `getLineupSize(currentTeam, settings.defaultLineupSize)`; die
  Settings werden einmal beim Laden per `loadClubSettings` geholt.
- `GesamtUebersichtView`: Warnung "< 4 Zusagen" (FA-1.5.4) nutzt `lineup_size` des jeweiligen
  Teams.
- `TeamMatrixView`: WhatsApp-Aufruf übergibt `lineupSize`.
- `docs/nutzung.md` und `docs/architektur.md`: "4 Stamm + 1 Ersatz" → "n Stamm + 1 Ersatz
  (n = Kadergröße der Mannschaft, Standard 4)".

**Tests:** `whatsappUtils.test.ts`: neuer Fall `lineupSize = 6` mit 6 Zusagen → Text nennt
6 Namen; mit 5 Zusagen → "fehlt uns noch 1 Spieler". Bestehende Tests unverändert grün.

**Verifikation:** Grundprüfungen. `grep -n "slice(0, 5)\|< 4\|>= 4" src/components/TeamTabView.tsx src/lib/whatsappUtils.ts` ohne Treffer.

**Commit:** `Kadergroesse aus Mannschaftseinstellung statt fester 4`

---

### Aufgabe 1.6 — Demodaten entfernen, Seed für lokale Entwicklung, Vereinspasswort

**Ziel:** Das Cloud-Projekt enthält keine Upstream-Seed-Daten mehr; lokale Entwicklung hat
eigene Seeds; das Default-Passwort ist ersetzt.

**Dateien:** neu `supabase/migrations/<ts>_remove_upstream_seed.sql`, ändern
`supabase/seed.sql`, `docs/einrichtung.md`, `README.md`.

**Endzustand — Migration (idempotent):**
```sql
DELETE FROM public.team_players WHERE player_id IN ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000003');
DELETE FROM public.profiles WHERE id IN (…dieselben drei…);
DELETE FROM public.teams WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333')
  AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.team_id = public.teams.id);
```
Teams werden nur gelöscht, wenn keine Spiele daran hängen (Schutz, falls jemand die
Seed-Teams bereits mit echten Webcal-URLs weiterverwendet hat).

**Endzustand — `supabase/seed.sql`:** legt für lokale Entwicklung an: 2 Teams
(`team_number` 1 und 2, `lineup_size` 4, `webcal_url` = eine gültige Test-URL oder
`https://example.invalid/kalender.ics`), 10 Profile mit `team_number`/`position_number`
(1.1–1.6, 2.1–2.4), Rollen: 1.1 = `club_admin`, 2.1 = `team_manager`, 1.2 = `sportwart`,
Rest `player`. Alle Namen sind erkennbar fiktiv ("Test Spieler01" …). `club_settings`:
`club_name` = `'Testverein'`, `club_aliases` = `'testverein'`.

**Endzustand — Vereinspasswort:** `docs/einrichtung.md` bekommt einen Unterabschnitt
"Vereinspasswort setzen" mit dem SQL
```sql
UPDATE public.club_settings SET value = crypt('NEUES_PASSWORT', gen_salt('bf', 8)), updated_at = NOW() WHERE key = 'club_password_hash';
```
und dem Hinweis, dass der Mensch das nach 0.2 sofort ausführt. README-Checkliste "Vor dem
ersten Deploy" bekommt den Punkt "Vereinspasswort geändert".

**Verifikation:** Lokal `npx supabase db reset` → App zeigt die 10 Seed-Spieler. Cloud:
Migration ausführen → `SELECT count(*) FROM profiles WHERE name IN ('Max Mustermann','Mia Musterfrau','Hans Meier')` = 0.

**Commit:** `Upstream-Demodaten entfernen und lokale Seeds anlegen`

---

### Aufgabe 1.7 — Vereinsname in der Oberfläche

**Ziel:** Kein "TTV Spielplaner" / "Tischtennis Spielbereitschaft" mehr; überall der
konfigurierte Vereinsname.

**Dateien:** `index.html`, `src/App.tsx`, `src/components/PasswordGate.tsx`,
`src/components/AuthScreen.tsx`, `tests/App.test.tsx`, `tests/PasswordGate.test.tsx`,
`tests/AuthScreen.test.tsx`.

**Endzustand:**
- `index.html` `<title>` = `Spielplaner` (neutral; der Vereinsname ist erst nach dem Laden
  bekannt). `document.title` wird in `App.tsx` nach `loadClubSettings` auf
  `` `${clubShortName} Spielplaner` `` gesetzt.
- Header in `App.tsx`: `<h1>` zeigt `clubName`, Untertitel bleibt "Spielbereitschaft".
- `AuthScreen` `<h2>` und `PasswordGate` `<h1>` zeigen `clubName` bzw. bis zum Laden den
  Text "Spielplaner". `PasswordGate` liegt **vor** dem Login; `club_settings` ist per RLS
  (ab Phase 2) für Anonyme nur eingeschränkt lesbar — deshalb liest `PasswordGate` den Namen
  über die neue RPC `get_public_club_name()` (SECURITY DEFINER, gibt nur `club_name` zurück).
  Diese RPC wird in dieser Aufgabe per Migration `<ts>_rpc_public_club_name.sql` angelegt.
- Footer: `© <Jahr> <clubName> — Spielbereitschafts-Planer`.
- `localStorage`-Keys mit Präfix `ttv_` bleiben unverändert (Umbenennung würde alle Nutzer
  ausloggen; nicht nötig).

**Tests:** Mocks liefern `club_name` = `'Testverein'`; Assertions auf `getByText('Testverein')`
in den drei Komponenten.

**Verifikation:** Grundprüfungen. `grep -rn "TTV Spielplaner\|Tischtennis Spielbereitschaft" src/ index.html` ohne Treffer.

**Commit:** `Vereinsname aus Einstellungen in der Oberflaeche`

---

## Teil E — Phase 2: Identität und Zugriffsschutz

Ziel der Phase: Jeder Schreibzugriff ist an eine verifizierte Identität gebunden, und die
Datenbank erzwingt die Rollen — nicht das Frontend. Reihenfolge ist zwingend:
erst E-Mail-Identität (2.1), dann Magic Link (2.2), dann RLS (2.3). RLS vor Magic Link würde
den passwortlosen Login sofort brechen.

### Aufgabe 2.1 — E-Mail-Adresse im Profil und Verknüpfung per E-Mail

**Ziel:** `profiles.email` existiert, ist eindeutig, wird vom Sportwart gepflegt und dient
der automatischen Verknüpfung bei der ersten Anmeldung.

**Dateien:** neu `supabase/migrations/<ts>_profiles_email.sql`, ändern
`src/components/SportwartView.tsx`, `tests/SportwartView.test.tsx`, `docs/datenbank.md`.

**Endzustand — Migration:**
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (LOWER(email)) WHERE email IS NOT NULL;
-- handle_new_user(): zuerst nach E-Mail (LOWER/TRIM) verknüpfen, erst dann nach Name wie bisher.
--   Beim Verknüpfen: profiles.email = new.email setzen, falls NULL.
--   Neu angelegtes Profil (kein Treffer): email = new.email.
CREATE OR REPLACE FUNCTION public.handle_new_user() … (vollständige Funktion neu definieren, Lineup-Remapping unverändert übernehmen)
```
Der bestehende Funktionskörper wird kopiert und nur der Suchblock erweitert:
```sql
SELECT id INTO existing_profile_id FROM public.profiles
 WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email)) AND id NOT IN (SELECT id FROM auth.users) LIMIT 1;
IF existing_profile_id IS NULL THEN
  SELECT id INTO existing_profile_id FROM public.profiles
   WHERE LOWER(TRIM(name)) = LOWER(TRIM(default_name)) AND id NOT IN (SELECT id FROM auth.users) LIMIT 1;
END IF;
```

**Endzustand — SportwartView:** Spielerformular hat ein Feld "E-Mail" (type email, optional).
Spielerliste zeigt hinter dem Namen ein Symbol ✉️ wenn E-Mail vorhanden, sonst nichts.
Import (HTML) lässt bestehende E-Mails unangetastet (Update setzt `email` nicht).

**Tests:** SportwartView: Anlegen eines Spielers mit E-Mail ruft `insert` mit `email` auf;
Update ohne E-Mail-Änderung enthält `email` nicht im Payload des Imports.

**Verifikation:** Grundprüfungen. SQL: zwei Profile mit gleicher E-Mail in unterschiedlicher
Schreibweise anlegen → zweiter Insert scheitert mit unique violation.

**Commit:** `E-Mail-Adresse im Spielerprofil und Verknuepfung per E-Mail`

---

### Aufgabe 2.2 — Magic-Link-Login als Standard, Namensauswahl entfernen

**Ziel:** Anmeldung per E-Mail-Link. Jeder Nutzer hat danach eine Supabase-Session
(`auth.uid()`), auf die RLS aufsetzen kann.

**Dateien:** `src/components/AuthScreen.tsx`, `src/App.tsx`, `tests/AuthScreen.test.tsx`,
`tests/App.test.tsx`, `docs/nutzung.md`, `docs/einrichtung.md`, `README.md`.

**Endzustand — AuthScreen:**
- Drei Tabs → zwei Tabs: "Mit E-Mail-Link" (Standard, vorausgewählt) und "Mit Passwort".
  Tab "Direkt-Auswahl" und Tab "Registrieren" sind entfernt (Registrierung passiert implizit
  beim ersten Magic-Link-Login; Supabase legt den Auth-User an, der Trigger verknüpft das Profil).
- Tab "Mit E-Mail-Link": ein Feld E-Mail, Button "Link senden". Aufruf:
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname, shouldCreateUser: true } })`.
  Danach Text: "Wir haben dir einen Anmeldelink an <email> geschickt. Öffne ihn auf diesem
  Gerät." Fehler werden wie bisher in der roten Box angezeigt.
- Unbekannte E-Mail (kein Profil mit dieser Adresse **und** kein Namens-Treffer möglich):
  Der Trigger legt ein neues `player`-Profil mit dem E-Mail-Localpart als Namen an
  (Bestandsverhalten). Das ist akzeptiert; der Sportwart sieht neue Profile in seiner Liste.

**Endzustand — App.tsx:**
- Beim Start: `supabase.auth.getSession()`; existiert eine Session → `loadProfileAndTeams(session.user.id)`.
  `supabase.auth.onAuthStateChange` setzt/entfernt Session (Magic-Link-Rückkehr landet hier).
- `localStorage`-Keys `ttv_login_method` und `ttv_selected_player_id` werden **nicht mehr
  gesetzt** und beim Start einmalig entfernt (Aufräumen alter Clients).
- Rolle = `prof.role` (keine Herabstufung auf `player` mehr, weil jede Session verifiziert ist).
- Logout ruft `supabase.auth.signOut()` und setzt State zurück.
- Der URL-Bypass `?pw=` für das Vereinspasswort bleibt.

**Endzustand — Doku:** `docs/nutzung.md` Abschnitt 1 und A.1/B.1/C.1/D.1 beschreiben den
Magic-Link-Login; Hinweise auf "passwortlos = nur Spielerrechte" sind entfernt.
`docs/einrichtung.md` Abschnitt 2 Punkt 5: "Confirm email" darf jetzt **aktiviert** sein;
zusätzlich Authentication → URL Configuration → Site URL und Redirect URLs auf die
Deploy-URL (GitHub Pages) und `http://localhost:5173` setzen.

**Tests:** AuthScreen: (a) Tab "Mit E-Mail-Link" ist initial aktiv; (b) Submit ruft
`supabase.auth.signInWithOtp` mit der eingegebenen E-Mail; (c) danach erscheint der Text
"Anmeldelink"; (d) es gibt kein Element mit Text "Direkt-Auswahl". App: Mock von
`auth.getSession` liefert eine Session → `profiles.select` wird mit dieser ID aufgerufen.
Der Mock von `supabase` braucht `auth: { getSession, onAuthStateChange, signOut, signInWithOtp, signInWithPassword }`.

**Verifikation:** Grundprüfungen. Manuell gegen das Cloud-Projekt: E-Mail eines Seed-Profils
eingeben → Mail kommt (Supabase-Default-SMTP, max. ~3/Stunde im Free-Tier — für Tests
reicht das; produktiv wird in 3.2 Resend als SMTP hinterlegt) → Link öffnen → eingeloggt mit
richtiger Rolle im Header.

**Nicht tun:** Passwort-Login entfernen (bleibt als Alternative). RLS anfassen (2.3).

**Commit:** `Magic-Link-Login als Standardanmeldung`

---

### Aufgabe 2.3 — Row Level Security scharf stellen

**Ziel:** Die Datenbank erzwingt: Lesen nur eingeloggt; Schreiben nur, was die Rolle erlaubt;
Spieler nur eigene Rückmeldungen und Abwesenheiten; Rollen/Positionen nur Sportwart/Admin.

**Dateien:** neu `supabase/migrations/<ts>_rls_hardening.sql`; neu
`supabase/tests/rls.test.sql` (pgTAP); ändern `docs/architektur.md`, `docs/datenbank.md`,
`README.md` (Baustellen-Hinweis entfernen); Komponenten nur, wo unter "Frontend-Folgen" genannt.

**Endzustand — Hilfsfunktionen (SECURITY DEFINER, `STABLE`):**
```sql
public.current_role_name() RETURNS public.user_role   -- Rolle des eingeloggten Nutzers, NULL wenn kein Profil
public.is_sportwart_or_admin() RETURNS BOOLEAN         -- role IN ('sportwart','club_admin')
public.is_manager_or_admin() RETURNS BOOLEAN           -- bleibt (team_manager, sportwart, club_admin)
public.is_club_admin() RETURNS BOOLEAN                 -- bleibt
public.manages_team_number(n INTEGER) RETURNS BOOLEAN  -- team_manager mit profiles.team_number = n, oder sportwart/admin
public.can_edit_availability_of(player UUID) RETURNS BOOLEAN
   -- auth.uid() = player OR is_sportwart_or_admin() OR (current_role_name()='team_manager' AND (SELECT team_number FROM profiles WHERE id=player) = (SELECT team_number FROM profiles WHERE id=auth.uid()))
```

**Endzustand — Policies (alle alten `Allow anyone …`-Policies werden per `DROP POLICY IF EXISTS` entfernt):**

| Tabelle | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `club_settings` | `auth.uid() IS NOT NULL AND key <> 'club_password_hash'` | `is_club_admin()` | `is_club_admin()` | `is_club_admin()` |
| `profiles` | `auth.uid() IS NOT NULL` | `is_sportwart_or_admin()` | `auth.uid() = id OR is_sportwart_or_admin()` | `is_sportwart_or_admin()` |
| `teams` | `auth.uid() IS NOT NULL` | `is_club_admin()` | `is_club_admin()` | `is_club_admin()` |
| `team_players` | `auth.uid() IS NOT NULL` | `is_manager_or_admin()` | `is_manager_or_admin()` | `is_manager_or_admin()` |
| `matches` | `auth.uid() IS NOT NULL` | `is_manager_or_admin()` | `is_manager_or_admin()` | `is_club_admin()` |
| `availabilities` | `auth.uid() IS NOT NULL` | `can_edit_availability_of(player_id)` | `can_edit_availability_of(player_id)` | `can_edit_availability_of(player_id)` |
| `absences` | `auth.uid() IS NOT NULL` | `auth.uid() = player_id OR is_manager_or_admin()` | dito | dito |
| `sync_runs` | `auth.uid() IS NOT NULL` | `is_manager_or_admin()` | `is_manager_or_admin()` | `is_club_admin()` |
| `match_changes` | `auth.uid() IS NOT NULL` | `is_manager_or_admin()` | `is_manager_or_admin()` | `is_club_admin()` |

`WITH CHECK` ist jeweils identisch zu `USING`. Edge Functions nutzen den `service_role`-Key
und umgehen RLS — das ist gewollt.

**Endzustand — Spaltenschutz auf `profiles`:** Ein `BEFORE UPDATE`-Trigger
`protect_privileged_profile_columns()` wirft `RAISE EXCEPTION 'Nur Sportwart oder Admin dürfen Rolle, Mannschaft, Position oder TTR ändern'`,
wenn sich `role`, `team_number`, `position_number` oder `ttr_points` ändern und
`NOT is_sportwart_or_admin()`. `last_login_at`, `name`, `email` darf jeder für sich ändern.
Der Trigger ignoriert Aufrufe ohne `auth.uid()` (Service Role / Migrationen).

**Endzustand — RPCs:** `verify_club_password(text)` und `get_public_club_name()` bleiben
für Anonyme aufrufbar (`GRANT EXECUTE … TO anon, authenticated`). Alle anderen Funktionen:
`REVOKE EXECUTE FROM anon`.

**Endzustand — Frontend-Folgen (prüfen und ggf. anpassen):**
- `AuthScreen` lädt keine Profilliste mehr (seit 2.2 entfernt) — nichts zu tun.
- `PasswordGate` nutzt `get_public_club_name()` (seit 1.7) — nichts zu tun.
- `SportwartView`-Import setzt `team_number`/`position_number` per Update auf alle Profile —
  erlaubt, weil Sportwart. `.neq('id', '0000…')`-Blanket-Update bleibt.
- `TeamTabView.handleUpdatePlayerResponse` (Manager setzt RSVP fremder Spieler): durch
  `can_edit_availability_of` gedeckt; Fehlermeldung der DB wird per `alert` angezeigt.
- Client-Sync in `syncEngine.ts` schreibt `matches` — nur Manager/Admin dürfen ihn auslösen
  (ist im UI bereits so).

**Endzustand — pgTAP-Tests (`supabase/tests/rls.test.sql`), mindestens diese Fälle:**
Testaufbau: drei Auth-User simulieren via
`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub":"<uuid>"}';`
für Spieler P (team 2), Mannschaftsführer M (team 2), Sportwart S.
1. Anonym (`SET LOCAL ROLE anon`): `SELECT count(*) FROM profiles` = 0 Zeilen sichtbar.
2. P sieht `profiles`, `matches`, `availabilities` (count > 0).
3. P kann eigene `availabilities` einfügen; Insert mit `player_id` = M schlägt fehl
   (`throws_ok`).
4. M kann `availabilities` für P einfügen (gleiches Team); für einen Spieler aus Team 1 nicht.
5. P `UPDATE profiles SET name=…` eigenes Profil: ok. `UPDATE profiles SET role='club_admin'`
   eigenes Profil: `throws_ok` mit der Trigger-Meldung.
6. S kann `profiles.role` ändern.
7. P `INSERT INTO teams` schlägt fehl; Admin ok.
8. P `SELECT value FROM club_settings WHERE key='club_password_hash'` liefert 0 Zeilen; S ebenfalls 0; `verify_club_password('…')` funktioniert weiterhin als anon.

Ausführung: `npx supabase test db` (benötigt 0.3). Die Datei beginnt mit
`BEGIN; SELECT plan(N);` und endet mit `SELECT * FROM finish(); ROLLBACK;`.

**Vorgehen:**
1. Migration schreiben (Funktionen → Policies → Trigger → Grants).
2. pgTAP-Datei schreiben.
3. `npx supabase db reset && npx supabase test db` bis grün.
4. App lokal durchklicken: als Spieler RSVP setzen, als Manager fremdes RSVP setzen, als
   Spieler versuchen, im Sportwart-Tab etwas zu ändern (Tab ist nicht sichtbar; direkter
   API-Call per curl mit Spieler-JWT muss 401/403 bzw. leere Antwort liefern).
5. Migration im Cloud-Projekt ausführen.
6. `README.md`: in der Checkliste den Satz zur offenen RLS entfernen;
   `docs/funktionsvergleich.md` Teil 4 Zeile 1 als erledigt markieren (Zusatz "erledigt in
   Aufgabe 2.3").

**Verifikation:** Grundprüfungen + `npx supabase test db` grün + der curl-Test aus Schritt 4.

**Nicht tun:** Policies mit `USING (true)` für irgendeine Tabelle belassen. `service_role`
im Frontend verwenden.

**Commit:** `Row Level Security rollenbasiert scharf stellen`

---

### Aufgabe 2.4 — Edge Function `sync-calendars` absichern und Client-Fallback einhegen

**Ziel:** Die Function prüft JWTs korrekt; der Browser-Sync über fremde CORS-Proxies ist nur
noch aktiv, wenn ein Admin ihn bewusst einschaltet.

**Dateien:** `supabase/functions/sync-calendars/index.ts`, `src/lib/syncEngine.ts`,
`src/components/AdminDashboard.tsx`, `src/components/TeamTabView.tsx`,
`src/lib/clubSettings.ts` (neuer Key), neue Migration `<ts>_setting_allow_client_sync.sql`,
Tests der genannten Dateien.

**Endzustand — Edge Function:**
- Der Block `createClient(supabaseUrl, token)` (Bug: Token als API-Key übergeben) wird ersetzt
  durch `createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })` und anschließend `auth.getUser()`.
- Zulässig sind `club_admin`, `sportwart`, `team_manager` (statt nur `club_admin`), weil
  `TeamTabView.handleRefresh` von Managern ausgelöst wird.
- Optionaler Body `{ teamId?: string }`: wenn gesetzt, wird nur dieses Team synchronisiert.
- Neuer Function-Secret `SUPABASE_ANON_KEY` ist in `docs/einrichtung.md` Abschnitt 3 ergänzt.

**Endzustand — Frontend:**
- Neuer Settings-Key `allow_client_sync` (Default `'false'`), im Admin-Dashboard als Checkbox
  "Browser-Fallback für Kalender-Sync erlauben (nutzt fremde Proxy-Dienste)".
- `TeamTabView.handleRefresh`: ruft `supabase.functions.invoke('sync-calendars', { body: { teamId } })`.
  Nur wenn das fehlschlägt **und** `allow_client_sync` = true, fällt es auf
  `syncTeamCalendar` zurück; sonst Fehlermeldung "Server-Sync nicht erreichbar. Bitte Admin
  informieren."
- `AdminDashboard.handleManualSync`: gleiche Regel.

**Tests:** `syncCalendarsFunction.test.ts` — Autorisierungslogik ist in eine reine Funktion
`isRoleAllowedToSync(role)` in `_shared/syncAuth.ts` ausgelagert und getestet.
`TeamTabView.test.tsx`: bei `allow_client_sync=false` und fehlgeschlagenem `invoke` wird
`syncTeamCalendar` **nicht** aufgerufen.

**Verifikation:** Grundprüfungen. Cloud: Function neu deployen, Sync im Admin-Dashboard
auslösen → `sync_runs` bekommt eine Zeile.

**Commit:** `sync-calendars absichern und Client-Fallback nur auf Wunsch`

---

## Teil F — Phase 3: Aktive Kommunikation

Ziel der Phase: Das System spricht Mitglieder von sich aus an — Erinnerungen an fehlende
Rückmeldungen, Info an Mannschaftsführer bei Absagen, Mail an die Mannschaft, Einladungen.

### Aufgabe 3.1 — Outbox-Tabelle `notifications` und Benachrichtigungs-Einstellungen

**Ziel:** Ein einheitlicher Ablageort für alles, was versendet werden soll, unabhängig vom
Kanal.

**Dateien:** neu `supabase/migrations/<ts>_notifications.sql`; neu
`supabase/functions/_shared/notificationTypes.ts`; neu `tests/notificationTypes.test.ts`;
`src/lib/clubSettings.ts` (Keys); `docs/datenbank.md`.

**Endzustand — Migration:**
```sql
CREATE TYPE public.notification_channel AS ENUM ('email', 'push');           -- via DO $$ IF NOT EXISTS
CREATE TYPE public.notification_status  AS ENUM ('pending', 'sent', 'failed', 'skipped');
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  type TEXT NOT NULL,                 -- 'rsvp_reminder' | 'captain_decline_info' | 'team_mail' | 'substitute_request' | 'substitute_chain_exhausted' | 'invite' | 'admin_new_member'
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,            -- Klartext; HTML wird beim Versand aus Klartext erzeugt (Zeilenumbrüche → <br>)
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,   -- z. B. { match_id, request_id, action_url }
  status public.notification_status NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ, error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_pending_idx ON public.notifications (scheduled_for) WHERE status = 'pending';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push  BOOLEAN NOT NULL DEFAULT true;
-- RLS: SELECT eigene Zeilen (profile_id = auth.uid()) oder is_club_admin(); INSERT/UPDATE/DELETE: is_manager_or_admin() (Service Role für Functions)
INSERT INTO public.club_settings (key, value) VALUES
  ('reminder_offsets_hours', '168,48'),   -- 7 Tage und 2 Tage vor dem Spiel
  ('notification_sender_name', 'Spielplaner'),
  ('notification_sender_email', '')        -- verifizierte Absenderadresse bei Resend
ON CONFLICT (key) DO NOTHING;
```
`notify_email`/`notify_push` gehören zu den Spalten, die der Nutzer selbst ändern darf
(Trigger aus 2.3 lässt sie durch — prüfen, ggf. Trigger-Liste ist nur die vier geschützten
Spalten, also ok).

**Endzustand — `_shared/notificationTypes.ts`:** TypeScript-Typen `NotificationType`
(Union der Strings oben), `NotificationRow`, und die reine Funktion
`renderNotification(type, payload, ctx): { subject: string; bodyText: string }` mit den
deutschen Vorlagen je Typ (Platzhalter: Spielername, Gegner, Datum/Zeit, Heim/Auswärts,
Link). Diese Funktion ist der einzige Ort für Texte.

**Tests:** `renderNotification` für jeden Typ: Betreff nicht leer, Body enthält Gegner und
Datum, `action_url` erscheint im Body, wenn im Payload vorhanden.

**Verifikation:** Grundprüfungen; Migration lokal; pgTAP-Datei aus 2.3 um zwei Fälle
erweitern (Spieler sieht nur eigene notifications; Spieler kann keine einfügen).

**Commit:** `Outbox-Tabelle notifications und Vorlagen`

---

### Aufgabe 3.2 — E-Mail-Versand: Edge Function `process-notifications` + Resend

**Ziel:** Alles in `notifications` mit `status='pending'` und `channel='email'` wird versendet.

**Voraussetzungen (Mensch):** Resend-Konto, verifizierte Domain oder Absenderadresse,
API-Key als Function-Secret `RESEND_API_KEY`. Zusätzlich im Supabase-Dashboard unter
Authentication → SMTP Settings Resend als Custom SMTP eintragen (damit Magic Links nicht
am Free-Tier-Limit von Supabase hängen). Beides in `docs/einrichtung.md` dokumentieren
(neuer Abschnitt 6 "E-Mail-Versand").

**Dateien:** neu `supabase/functions/process-notifications/index.ts`; neu
`supabase/functions/_shared/emailHtml.ts` (+ Test); neu Migration `<ts>_pg_cron_notifications.sql`;
`docs/einrichtung.md`, `docs/architektur.md`.

**Endzustand — Function:**
- Auth: Header `x-sync-secret` = `SYNC_SECRET` (wie sync-calendars) **oder** eingeloggter Admin.
- Lädt max. 50 Zeilen `status='pending' AND scheduled_for <= now() AND channel='email'`,
  sortiert nach `scheduled_for`.
- Pro Zeile: Empfänger-E-Mail aus `profiles.email`; wenn leer oder `notify_email=false` →
  `status='skipped'`, `error='keine E-Mail / abgemeldet'`. Sonst POST an
  `https://api.resend.com/emails` mit `{ from: "<sender_name> <sender_email>", to, subject, text: body_text, html: renderEmailHtml(body_text) }`.
  Erfolg → `status='sent', sent_at=now()`. Fehler → `attempts+1`, `error=<msg>`, bei
  `attempts >= 3` → `status='failed'`, sonst `scheduled_for = now() + 15 min`.
- Push-Zeilen (`channel='push'`) werden in dieser Aufgabe **übersprungen** (kein Status-Wechsel);
  Aufgabe 5.2 ergänzt den Versand.
- Antwort: `{ processed, sent, skipped, failed }`.

**Endzustand — pg_cron:** Migration aktiviert `pg_cron` und `pg_net` (`CREATE EXTENSION IF NOT EXISTS`)
und legt einen Job an, der alle 10 Minuten `POST <SUPABASE_URL>/functions/v1/process-notifications`
mit Header `x-sync-secret` ruft. Da URL und Secret nicht in der Migration stehen dürfen,
liest der Job sie aus einer Tabelle `private.cron_config(key, value)` im Schema `private`
(nicht über PostgREST erreichbar). `docs/einrichtung.md` beschreibt das einmalige
`INSERT INTO private.cron_config VALUES ('functions_base_url', …), ('sync_secret', …)`.
Gleicher Mechanismus ersetzt in dieser Aufgabe auch den GitHub-Cron für `sync-calendars`
(Job täglich 04:00 UTC) — `.github/workflows/sync-calendars.yml` wird gelöscht.

**Tests:** `emailHtml.test.ts`: Zeilenumbrüche → `<br>`, HTML-Sonderzeichen escaped, Links
klickbar. Function-Logik zum Statuswechsel als reine Funktion `nextStateAfterSend(row, ok, err)`
in `_shared/notificationState.ts` mit Tests (sent / retry / failed nach 3 Versuchen / skipped).

**Verifikation:** Lokal: Zeile manuell in `notifications` einfügen, Function per curl mit
Secret aufrufen → Mail kommt an, Zeile ist `sent`. Cloud: Function deployen, cron-Job in
`cron.job` sichtbar, `cron.job_run_details` zeigt Läufe.

**Commit:** `E-Mail-Versand ueber Outbox und Resend`

---

### Aufgabe 3.3 — Erinnerungen an fehlende Rückmeldungen

**Ziel:** Spieler ohne Rückmeldung werden zu konfigurierten Zeitpunkten vor dem Spiel erinnert.

**Dateien:** neu `supabase/functions/enqueue-reminders/index.ts`; neu
`supabase/functions/_shared/reminderPlanner.ts` (+ Test); Migration
`<ts>_match_reminders.sql`; `src/components/AdminDashboard.tsx` (Feld für Offsets);
`src/components/AbsencesView.tsx` oder neuer Tab "Einstellungen" (siehe unten);
`docs/nutzung.md`.

**Endzustand — Migration:**
```sql
CREATE TABLE IF NOT EXISTS public.match_reminders (
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  offset_hours INTEGER NOT NULL,
  match_version INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (match_id, offset_hours, match_version)
);
-- RLS: SELECT is_manager_or_admin(); Schreiben nur Service Role (keine Policy für authenticated)
```
plus pg_cron-Job alle 10 Minuten für `enqueue-reminders`.

**Endzustand — `_shared/reminderPlanner.ts`:**
```ts
export interface ReminderCandidateMatch { id: string; team_id: string; dtstart: string; version: number; active: boolean; }
export interface ReminderPlanInput {
  now: Date; offsetsHours: number[];
  matches: ReminderCandidateMatch[];
  alreadySent: { match_id: string; offset_hours: number; match_version: number }[];
}
/** Liefert alle (match, offset)-Paare, für die jetzt erinnert werden muss:
 *  active, dtstart in der Zukunft, now >= dtstart - offset und now < dtstart - offset + 6h (Fangfenster, falls der Cron Läufe verpasst),
 *  und (match_id, offset, version) nicht in alreadySent. */
export function planReminders(input: ReminderPlanInput): { matchId: string; offsetHours: number; matchVersion: number }[];
/** Spieler, die für ein Spiel erinnert werden: Kader (team_players des Teams ∪ profiles mit team_number = team.team_number) minus Spieler mit availability für match.version minus Spieler mit Abwesenheit, die dtstart überdeckt. */
export function recipientsForMatch(args: { matchId: string; matchVersion: number; matchStart: string; teamNumber: number; teamPlayerIds: string[]; profiles: {id:string; team_number:number|null}[]; availabilities: {match_id:string; player_id:string; version_responded:number}[]; absences: {player_id:string; start_date:string; end_date:string}[] }): string[];
```

**Endzustand — Function:** liest Settings, aktive Spiele der nächsten 14 Tage,
`match_reminders`, ruft `planReminders`, je Treffer `recipientsForMatch`, schreibt je
Empfänger eine `notifications`-Zeile (`type='rsvp_reminder'`, `channel='email'` **und**
zusätzlich `channel='push'` — Push-Zeilen bleiben bis 5.2 liegen), danach eine Zeile in
`match_reminders`. Läuft idempotent: zweiter Aufruf in derselben Minute erzeugt nichts.

**Endzustand — UI:** Admin-Dashboard: Textfeld "Erinnerungen (Stunden vor Spiel,
kommagetrennt)" für `reminder_offsets_hours`. Neuer Tab "⚙️ Einstellungen" für jeden Nutzer
(`src/components/UserSettingsView.tsx`, Test dazu) mit zwei Checkboxen "E-Mail-Benachrichtigungen"
/ "Push-Benachrichtigungen" (schreibt `profiles.notify_email/notify_push` der eigenen Zeile)
und Anzeige der eigenen E-Mail. Tab-Button in `App.tsx` neben "Mein Kalender".

**Tests:** `reminderPlanner.test.ts`: (a) Spiel in 7 Tagen + 1 h, Offset 168 → kein Treffer;
Spiel in 7 Tagen − 1 h → Treffer; (b) bereits gesendet → kein Treffer; (c) neue Version
nach Verlegung → erneut Treffer; (d) `recipientsForMatch` schließt Antwortende und
Abwesende aus; (e) Fangfenster: now = dtstart − offset + 5 h → Treffer; + 7 h → keiner.

**Verifikation:** Lokal: Spiel mit dtstart = now + 47 h anlegen, Offsets `168,48`, Function
aufrufen → je Kaderspieler ohne Antwort eine `notifications`-Zeile; zweiter Aufruf → keine
neue Zeile. Danach `process-notifications` → Mails.

**Commit:** `Erinnerungen an fehlende Rueckmeldungen`

---

### Aufgabe 3.4 — Mannschaftsführer pro Mannschaft und Info bei Absage

**Ziel:** Jede Mannschaft hat benannte Mannschaftsführer; sagt ein Stammspieler ab, werden
sie sofort benachrichtigt.

**Dateien:** Migration `<ts>_team_captains_and_decline_trigger.sql`;
`src/components/AdminDashboard.tsx` (Zuordnung); `_shared/notificationTypes.ts` (Typ
existiert); `docs/nutzung.md`; Tests.

**Endzustand — Migration:**
```sql
CREATE TABLE IF NOT EXISTS public.team_captains (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (team_id, profile_id)
);   -- RLS: SELECT authenticated; Schreiben is_club_admin()
-- Backfill: alle profiles mit role='team_manager' und team_number → team_captains des Teams mit dieser team_number
-- Trigger AFTER INSERT OR UPDATE ON availabilities:
--   wenn NEW.response = 'no' AND (OLD ist NULL oder OLD.response <> 'no') AND NEW.version_responded = (SELECT version FROM matches WHERE id = NEW.match_id)
--   AND Spieler ist Stammspieler des Teams des Spiels (profiles.team_number = teams.team_number AND position_number <= teams.lineup_size)
--   → INSERT INTO notifications (profile_id = jeder team_captain außer dem Absagenden selbst, channel 'email' und 'push', type 'captain_decline_info', subject/body über eine SQL-Funktion render_captain_decline_info(...) mit denselben Texten wie _shared/notificationTypes.ts)
```
Der Trigger läuft als `SECURITY DEFINER`, damit Spieler (die keine notifications einfügen
dürfen) ihn auslösen können.

`manages_team_number()` aus 2.3 wird erweitert: zusätzlich `true`, wenn `auth.uid()` in
`team_captains` für ein Team mit dieser Nummer steht. Damit ist die Rolle `team_manager`
plus Zuordnung die Quelle der Wahrheit, nicht mehr nur `profiles.team_number`.

**Endzustand — UI:** Admin-Dashboard je Team: Mehrfachauswahl "Mannschaftsführer" aus allen
Profilen mit Rolle `team_manager`, `sportwart`, `club_admin`.

**Tests:** pgTAP: Absage eines Stammspielers erzeugt genau eine E-Mail-Zeile je Captain;
Absage eines Ersatzspielers (position > lineup_size) erzeugt keine; erneutes Speichern von
`no` erzeugt keine zweite.

**Verifikation:** Lokal wie beschrieben; Cloud: Migration + Klicktest.

**Commit:** `Mannschaftsfuehrer je Mannschaft und Absage-Benachrichtigung`

---

### Aufgabe 3.5 — "Mail an die Mannschaft"

**Ziel:** Ein Klick versendet den erzeugten Aufstellungstext per E-Mail an alle Kaderspieler
des Spiels — die Alternative zum WhatsApp-Kopieren.

**Dateien:** `src/components/TeamMatrixView.tsx` (Button neben dem WhatsApp-Icon),
`tests/TeamMatrixView.test.tsx`, `docs/nutzung.md`.

**Endzustand:** Button "✉️ An Mannschaft senden" (nur `isManagerOrAdmin`). Klick →
`confirm('Aufstellungstext an N Spieler per E-Mail senden?')` → für jeden Kaderspieler des
Teams (`team_players` ∪ `team_number`-Treffer) mit `notify_email=true` eine
`notifications`-Zeile `type='team_mail'`, `subject` = `` `Aufstellung: ${Gegner} am ${Datum}` ``,
`body_text` = `generateWhatsAppMessage(...)`. Erfolgsmeldung mit Anzahl. Versand erledigt
der Cron aus 3.2 innerhalb von 10 Minuten.

**Tests:** Klick erzeugt `insert` auf `notifications` mit N Zeilen; ohne Bestätigung nichts.

**Commit:** `Aufstellung per E-Mail an die Mannschaft senden`

---

### Aufgabe 3.6 — Einladung neuer Mitglieder und Admin-Info bei Registrierung

**Ziel:** Der Sportwart lädt ein Mitglied mit einem Klick ein; Admins erfahren, wenn sich
jemand neu anmeldet, der noch keinem Profil zugeordnet war.

**Dateien:** neu `supabase/functions/invite-member/index.ts`; `src/components/SportwartView.tsx`;
Migration `<ts>_new_member_admin_notice.sql`; `docs/nutzung.md`, `docs/einrichtung.md`; Tests.

**Endzustand — Function `invite-member`:** Auth: eingeloggter Sportwart/Admin (JWT-Prüfung wie
in 2.4). Body `{ profileId }`. Liest `profiles.email`; ruft
`supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo })`. Supabase schickt die
Einladungs-Mail (Template im Dashboard, Text in `docs/einrichtung.md` vorgegeben). Antwort
`{ ok: true }` oder Fehler. Wenn bereits ein Auth-User mit dieser E-Mail existiert:
`{ ok: false, reason: 'already_registered' }` → UI zeigt "Ist bereits registriert".

**Endzustand — SportwartView:** Button "Einladen" neben Spielern mit E-Mail und ohne
Auth-Verknüpfung. Ob verknüpft: `profiles.id IN (SELECT id FROM auth.users)` ist im Frontend
nicht abfragbar → neue Spalte `profiles.auth_linked_at TIMESTAMPTZ`, die
`handle_new_user()` beim Verknüpfen/Anlegen setzt (Migration in dieser Aufgabe).

**Endzustand — Admin-Info:** `handle_new_user()` fügt am Ende für jeden `club_admin` eine
`notifications`-Zeile `type='admin_new_member'` ein, wenn **kein** bestehendes Profil
verknüpft wurde (also ein neues Profil entstand).

**Tests:** SportwartView: Button nur bei E-Mail vorhanden und `auth_linked_at` null;
Klick ruft `functions.invoke('invite-member', { body: { profileId } })`.

**Commit:** `Mitglieder einladen und Admins ueber neue Registrierungen informieren`

---

## Teil G — Phase 4: Ersatzspieler-Automatik

Ziel der Phase: Bei einer Absage fragt das System selbstständig Ersatzspieler an — der
Reihe nach mit Frist, oder alle gleichzeitig — und eskaliert an die Mannschaftsführer, wenn
niemand kann.

### Aufgabe 4.1 — Datenmodell der Ersatzkette

**Dateien:** Migration `<ts>_substitute_requests.sql`; `docs/datenbank.md`;
`src/components/AdminDashboard.tsx` (Modus je Team); `src/components/TeamMatrixView.tsx`
(Rangfolge pflegen); Tests.

**Endzustand — Migration:**
```sql
CREATE TYPE public.substitute_mode AS ENUM ('off', 'sequential', 'parallel');
CREATE TYPE public.substitute_request_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS substitute_mode public.substitute_mode NOT NULL DEFAULT 'off';
ALTER TABLE public.team_players ADD COLUMN IF NOT EXISTS substitute_rank INTEGER;   -- NULL = kein Ersatzkandidat; 1 = zuerst fragen
CREATE TABLE IF NOT EXISTS public.substitute_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  match_version INTEGER NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  status public.substitute_request_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  answered_at TIMESTAMPTZ,
  token UUID NOT NULL DEFAULT gen_random_uuid(),     -- für Antwort-Links ohne Login
  UNIQUE (match_id, match_version, profile_id)
);
-- RLS: SELECT eigene (profile_id = auth.uid()) oder is_manager_or_admin(); UPDATE eigene Zeile nur status/answered_at (Trigger-Schutz) oder Manager; INSERT/DELETE Manager
INSERT INTO public.club_settings VALUES ('substitute_timeout_hours', '24') ON CONFLICT DO NOTHING;
```

**Endzustand — UI:** Admin-Dashboard je Team: Auswahl "Ersatzspieler-Automatik: Aus /
Einzeln nach Reihenfolge / Alle gleichzeitig". Team-Matrix (Manager): in der Spielerliste
des Teams ein Zahlenfeld "Ersatz-Rang" je Spieler (leer = kein Kandidat); Speichern schreibt
`team_players.substitute_rank`. Spieler anderer Mannschaften können über die bestehende
"Spieler hinzufügen"-Funktion in `team_players` aufgenommen und dann gerankt werden.

**Tests:** AdminDashboard speichert `substitute_mode`; TeamMatrixView schreibt `substitute_rank`.

**Commit:** `Datenmodell fuer die Ersatzspieler-Kette`

---

### Aufgabe 4.2 — Reine Planungslogik `planSubstituteStep`

**Ziel:** Die gesamte Entscheidungslogik der Kette als testbare Funktion ohne I/O.

**Dateien:** neu `supabase/functions/_shared/substituteEngine.ts`; neu
`tests/substituteEngine.test.ts`.

**Endzustand — Schnittstelle:**
```ts
export type SubstituteMode = 'off' | 'sequential' | 'parallel';
export interface EngineMatch { id: string; version: number; dtstart: string; active: boolean; team_id: string; }
export interface EngineTeam { id: string; team_number: number; lineup_size: number; substitute_mode: SubstituteMode; }
export interface EngineAvailability { player_id: string; response: 'yes'|'no'|'maybe'|'yes_sub'; version_responded: number; }
export interface EngineCandidate { profile_id: string; rank: number; }         // aus team_players mit substitute_rank
export interface EngineRequest { id: string; profile_id: string; rank: number; status: 'pending'|'accepted'|'declined'|'expired'|'cancelled'; expires_at: string; match_version: number; }
export interface EngineAbsence { player_id: string; start_date: string; end_date: string; }
export interface EngineInput { now: Date; timeoutHours: number; match: EngineMatch; team: EngineTeam; stammIds: string[]; availabilities: EngineAvailability[]; candidates: EngineCandidate[]; requests: EngineRequest[]; absences: EngineAbsence[]; }
export type EngineAction =
  | { kind: 'expire'; requestId: string }
  | { kind: 'accept'; requestId: string }
  | { kind: 'decline'; requestId: string }
  | { kind: 'cancel'; requestId: string; reason: 'enough_players'|'match_inactive'|'version_changed' }
  | { kind: 'request'; profileId: string; rank: number; expiresAt: string }
  | { kind: 'exhausted' };
export function planSubstituteStep(input: EngineInput): EngineAction[];
```

**Endzustand — Regeln (in dieser Reihenfolge auswerten):**
1. `match.active = false` oder `dtstart < now` → alle `pending` → `cancel(match_inactive)`. Ende.
2. Requests mit `match_version < match.version` und `pending` → `cancel(version_changed)`.
3. Für jede `pending`-Anfrage: hat der Spieler eine Availability für `match.version`?
   `yes`/`yes_sub` → `accept`; `no` → `decline`; sonst wenn `expires_at <= now` → `expire`.
4. `needed = lineup_size − |Spieler mit yes für match.version|` (yes_sub zählt nicht).
   Wenn `needed <= 0`: alle noch `pending` → `cancel(enough_players)`. Ende.
5. `mode = 'off'` → Ende (nur die Aufräum-Aktionen oben).
6. Kandidaten = `candidates` sortiert nach `rank`, ohne: Stammspieler (`stammIds`), Spieler mit
   irgendeiner Availability für `match.version`, Spieler mit Request (jeder Status) für
   `match.version` — außer solchen, die in Schritt 3 gerade erst `expire`/`decline` bekamen,
   die sind ebenfalls ausgeschlossen —, Spieler mit Abwesenheit über `dtstart`.
7. Offene `pending` nach Schritt 3 (nicht abgelaufen) → `openCount`.
8. `sequential`: wenn `openCount = 0` und Kandidaten vorhanden → genau **ein** `request`
   (erster Kandidat, `expiresAt = now + timeoutHours`); wenn `openCount = 0` und keine
   Kandidaten → `exhausted`. Wenn `openCount > 0` → nichts.
9. `parallel`: `request` für **alle** Kandidaten, die noch keinen Request haben; wenn keine
   Kandidaten und `openCount = 0` → `exhausted`.
10. `exhausted` wird nur einmal je (match, version) erzeugt — der Aufrufer (4.3) speichert
    das über eine `notifications`-Zeile `substitute_chain_exhausted` und übergibt bei
    späteren Läufen `requests` inklusive; die Engine erzeugt `exhausted` nur, wenn es keine
    Requests für die Version gibt **oder** alle abgeschlossen sind und keine Kandidaten bleiben.
    Der Aufrufer prüft vor dem Schreiben, ob bereits eine solche Notification existiert.

**Tests (mindestens 12):** je Regel ein Fall, plus: sequentiell — Absage des Angefragten
löst beim nächsten Lauf sofort den nächsten Request aus; parallel — 3 Kandidaten → 3
Requests; Verlegung (Version+1) → alte pending cancelled, dann neue Kette; genügend Zusagen
nach Annahme → übrige cancelled; Abwesender wird übersprungen; `off` erzeugt keine Requests,
räumt aber auf.

**Commit:** `Planungslogik der Ersatzspieler-Kette`

---

### Aufgabe 4.3 — Edge Function `substitute-engine` und Auslöser

**Dateien:** neu `supabase/functions/substitute-engine/index.ts`; Migration
`<ts>_pg_cron_substitute_engine.sql`; `src/components/TeamTabView.tsx`,
`src/components/TeamMatrixView.tsx` (Aufruf nach Absage); Tests.

**Endzustand — Function:** Auth wie sync-calendars (Secret oder Manager-JWT). Body optional
`{ matchId }`; ohne Body: alle aktiven Spiele der nächsten 21 Tage in Teams mit
`substitute_mode <> 'off'` **plus** alle Spiele mit `pending`-Requests (zum Aufräumen).
Je Spiel: Daten laden, `planSubstituteStep`, Aktionen anwenden:
- `request` → `substitute_requests` einfügen + `notifications` (`type='substitute_request'`,
  Kanäle email+push, `payload.action_url` = `<app_url>/?sub=<token>&a=yes` und `…&a=no`
  als zwei Links im Text; `app_url` aus `club_settings.app_url`, neuer Key, im Admin-Dashboard
  pflegbar).
- `expire`/`accept`/`decline`/`cancel` → Statusupdate, `answered_at`.
- `exhausted` → wenn noch keine `substitute_chain_exhausted`-Notification für (match, version)
  existiert: je Captain eine.
- Alle Aktionen auch in `match_changes` mit `change_type='substitute_<kind>'` protokollieren
  (nutzt die bestehende Tabelle; Spalte `change_type` ist TEXT).

**Endzustand — Auslöser:** (a) pg_cron alle 10 Minuten ohne Body. (b) `TeamTabView.handleVote`
und `TeamMatrixView` rufen nach dem Speichern einer Antwort `no` **oder** `yes`
`supabase.functions.invoke('substitute-engine', { body: { matchId } })` (fire-and-forget,
Fehler nur in der Konsole). Damit rückt die Kette sofort weiter, nicht erst nach 10 Minuten.

**Endzustand — Antwort per Link ohne Login:** Neue RPC
`answer_substitute_request(p_token UUID, p_answer TEXT) RETURNS TEXT` (SECURITY DEFINER,
für `anon` ausführbar): findet den Request per Token, prüft `pending` und nicht abgelaufen,
schreibt/aktualisiert `availabilities` des Spielers für die Match-Version (`yes` bzw. `no`),
setzt Request auf `accepted`/`declined`, gibt `'ok'` / `'expired'` / `'unknown'` zurück.
`App.tsx` erkennt `?sub=<token>&a=yes|no` **vor** dem Passwort-Gate, ruft die RPC und zeigt
eine Bestätigungsseite ("Danke, du bist als Ersatz eingetragen." / "Schade, wir fragen den
Nächsten."), dann Link zur App. Danach ruft die Seite `substitute-engine` für das Spiel auf
(mit `x-sync-secret`? Nein — anonym nicht erlaubt; stattdessen wertet der nächste Cron-Lauf
aus, maximal 10 Minuten Verzögerung. Das ist akzeptiert.)

**Tests:** Komponententests für den Aufruf nach Vote; pgTAP für die RPC (Token unbekannt →
`unknown`; abgelaufen → `expired`; gültig → `ok` und Availability existiert).

**Verifikation:** Lokales Szenario: Team mit `sequential`, 4 Stamm, 2 Kandidaten. Stamm sagt
ab → Function → Request 1 pending + Notification. Kandidat 1 antwortet `no` per Link →
Function → Request 2. Kandidat 2 `yes` → Request 2 accepted, Aufstellung zeigt ihn.

**Commit:** `Edge Function substitute-engine mit Cron und Sofort-Ausloeser`

---

### Aufgabe 4.4 — Sichtbarkeit der Kette in der App

**Dateien:** `src/components/TeamTabView.tsx`, `src/components/TeamMatrixView.tsx`, neu
`src/components/SubstituteChainPanel.tsx` (+ Test), `docs/nutzung.md`, `src/components/GuideView.tsx`.

**Endzustand:**
- Unter jedem Spiel (für Manager/Sportwart/Admin) ein Panel "Ersatzkette": Liste der
  Requests mit Rang, Name (Kurzform), Status-Badge, Frist; Buttons "Kette jetzt starten"
  (ruft Function mit `matchId`) und "Kette stoppen" (setzt alle `pending` auf `cancelled`
  und `substitute_mode`-unabhängig ein Flag `matches.substitute_paused BOOLEAN`, neue
  Migration in dieser Aufgabe; Engine respektiert das Flag wie `mode='off'`).
- Für Spieler: Banner oben in ihrem Team-Tab, wenn eine `pending`-Anfrage an sie existiert:
  "Du wurdest als Ersatz für <Spiel> angefragt — Frist bis <Datum>" mit Buttons Ja/Nein,
  die `handleVote` mit `yes`/`no` aufrufen (die Engine wertet das beim nächsten Lauf aus).
- GuideView: neuer Abschnitt "Ersatzspieler-Automatik" für Manager und Spieler.

**Tests:** Panel rendert Requests und Statusfarben; Spieler-Banner erscheint nur bei
eigener pending-Anfrage.

**Commit:** `Ersatzkette in der Oberflaeche sichtbar und steuerbar`

---

## Teil H — Phase 5: PWA und Push

### Aufgabe 5.1 — Installierbare PWA

**Dateien:** `package.json` (`vite-plugin-pwa`), `vite.config.ts`, `index.html`,
neu `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`
(einfaches 🏓-Motiv auf einfarbigem Hintergrund, erzeugt mit einem Skript
`scripts/make-icons.mjs` auf Basis von `sharp` — als Dev-Dependency), `README.md`.

**Endzustand:**
- `vite-plugin-pwa` mit `registerType: 'autoUpdate'`, Manifest: `name` = "Spielplaner",
  `short_name` = "Spielplaner", `start_url` = `./`, `display` = `standalone`,
  `background_color` = `#f9fafb`, `theme_color` = `#0d9488`, Icons wie oben.
  Der Vereinsname kann nicht ins Manifest (Build-Zeit) — akzeptiert.
- Workbox-Strategie: App-Shell precached; Supabase-Requests (`/rest/`, `/functions/`,
  `/auth/`) **NetworkOnly** (nie cachen).
- Lighthouse "Installable" erfüllt; Chrome zeigt "App installieren".
- `docs/nutzung.md`: Abschnitt "App installieren" (Android/Chrome: Menü → Installieren;
  iOS/Safari: Teilen → Zum Home-Bildschirm).

**Verifikation:** `npm run build && npx serve dist` → Chrome DevTools → Application →
Manifest ohne Fehler, Service Worker aktiv. Tests: bestehende grün (das Plugin ist im
Test-Modus inaktiv; falls Vitest meckert, Plugin nur bei `command === 'build'` laden).

**Commit:** `PWA: Manifest, Icons und Service Worker`

---

### Aufgabe 5.2 — Web Push

**Dateien:** Migration `<ts>_push_subscriptions.sql`; neu `src/lib/push.ts` (+ Test);
`src/components/UserSettingsView.tsx`; Service-Worker-Erweiterung (`src/sw.ts` mit
`injectManifest`-Strategie des Plugins); `supabase/functions/process-notifications/index.ts`;
`docs/einrichtung.md`.

**Endzustand — Migration:**
```sql
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  user_agent TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), last_success_at TIMESTAMPTZ, failures INTEGER NOT NULL DEFAULT 0
);  -- RLS: alles nur für profile_id = auth.uid(); Service Role liest alle
```

**Endzustand — Client:** In den Einstellungen Button "Push auf diesem Gerät aktivieren" →
`Notification.requestPermission()` → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })` → Subscription in Tabelle speichern (upsert auf `endpoint`). Hinweis-Text für iOS: nur nach "Zum Home-Bildschirm".
`src/sw.ts`: `push`-Event zeigt Notification mit `title`=subject, `body`, `data.url`;
`notificationclick` öffnet `data.url`.

**Endzustand — Server:** `process-notifications` verarbeitet jetzt auch `channel='push'`:
alle Subscriptions des Profils, Versand mit `npm:web-push` (Deno npm-Specifier), VAPID aus
Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`). HTTP 404/410
→ Subscription löschen. Erfolg auf mindestens einer Subscription → `sent`; keine
Subscription → `skipped`.

**Endzustand — Doku:** VAPID-Schlüssel erzeugen (`npx web-push generate-vapid-keys`),
Public Key als `VITE_VAPID_PUBLIC_KEY` (GitHub-Secret + `.env.local`), beide als
Function-Secrets.

**Tests:** `push.ts`: `urlBase64ToUint8Array` korrekt; Subscribe-Flow mit gemocktem
`navigator.serviceWorker`. Statuslogik von 3.2 um Push-Fälle erweitert.

**Verifikation:** Android/Chrome: Push aktivieren, Notification-Zeile manuell einfügen,
Function aufrufen → Benachrichtigung erscheint, Klick öffnet die App.

**Commit:** `Web Push fuer Erinnerungen und Ersatzanfragen`

---

## Teil I — Phase 6: Ausblick (nur Skizze, keine Aufgaben)

Erst nach Freigabe durch den Vorstand, wenn der TT-Planer tatsächlich abgelöst werden soll:

- **Training**: Tabellen `trainings` (Wochentag, Zeit, Rhythmus, Halle, Trainer),
  `training_sessions` (konkrete Termine, generiert 8 Wochen im Voraus, Ausfall-Flag),
  `training_attendance`. Feiertage/Ferien über eine Bundesland-Tabelle. Erinnerung
  wiederverwendet 3.3 mit anderem Typ.
- **Vereinskalender**: Sicht über `matches` ∪ `training_sessions` ∪ neue `events`.
- **Umfragen**: `polls`, `poll_options`, `poll_votes`; Spielverlegungs-Umfrage = Poll mit
  Datumsoptionen, verknüpft mit `match_id`.
- **Halle**: nicht bauen — DTTB-Tool in click-TT.

---

## Teil J — Reihenfolge und Abhängigkeiten

```
0.1 → 0.2 → 0.4 → 0.5
        └→ 0.3 (optional bis Phase 2, dann Pflicht)
0.6 unabhängig
1.1 → 1.2 → 1.3
1.1 → 1.4 → 1.5
1.6 nach 1.4 (seed.sql braucht team_number)
1.7 nach 1.1
2.1 → 2.2 → 2.3 → 2.4        (Reihenfolge zwingend)
3.1 → 3.2 → 3.3
3.1 → 3.4 ; 3.2 → 3.5 ; 2.2+3.1 → 3.6
4.1 → 4.2 → 4.3 → 4.4        (3.2 muss laufen, sonst gehen keine Anfragen raus)
5.1 → 5.2                    (5.2 braucht 3.2)
```

Empfohlene Bearbeitung: strikt in der Nummernfolge. Phase 1 kann komplett gegen das
Cloud-Projekt aus 0.2 gemacht werden; ab 2.3 ist die lokale Instanz (0.3) nötig.

---

## Teil K — Status

Vom ausführenden Agenten zu pflegen. Eine Zeile je Aufgabe.

| Aufgabe | Status | Datum | Commit | Anmerkung |
|---|---|---|---|---|
| 0.1 | offen | | | |
| 0.2 | offen (Mensch) | | | |
| 0.3 | offen | | | |
| 0.4 | offen (Mensch) | | | |
| 0.5 | offen (Mensch) | | | |
| 0.6 | offen | | | |
| 1.1 | offen | | | |
| 1.2 | offen | | | |
| 1.3 | offen | | | |
| 1.4 | offen | | | |
| 1.5 | offen | | | |
| 1.6 | offen | | | |
| 1.7 | offen | | | |
| 2.1 | offen | | | |
| 2.2 | offen | | | |
| 2.3 | offen | | | |
| 2.4 | offen | | | |
| 3.1 | offen | | | |
| 3.2 | offen | | | |
| 3.3 | offen | | | |
| 3.4 | offen | | | |
| 3.5 | offen | | | |
| 3.6 | offen | | | |
| 4.1 | offen | | | |
| 4.2 | offen | | | |
| 4.3 | offen | | | |
| 4.4 | offen | | | |
| 5.1 | offen | | | |
| 5.2 | offen | | | |

**Blocker:** —

**Fragen an den Planer:** —
