# Umsetzungsplan v2: Vereinsplaner

Stand: 17.09.2026 · Ersetzt v1 vollständig · Grundlage: [zielbild.md](zielbild.md) (Design) und
[tt-planer-bestandsaufnahme.md](tt-planer-bestandsaufnahme.md) (Referenzprodukt).

Dieses Dokument ist die Arbeitsanweisung für einen ausführenden Agenten, der **keine
Architekturentscheidungen trifft**. Jede Aufgabe beschreibt den exakten Endzustand und den Weg dorthin.
Wo eine Aufgabe auf das Zielbild verweist („Zielbild 3.2"), ist der dortige Text die Spezifikation.
Wenn etwas offenbleibt: stoppen, in Teil K unter „Fragen" eintragen, nicht raten.

---

## Teil A — Regeln für den ausführenden Agenten

### A.1 Arbeitsablauf pro Aufgabe

1. Aufgabe vollständig lesen: Endzustand, Vorgehen, Verifikation, Nicht tun.
2. Die referenzierten Zielbild-Abschnitte und alle unter „Dateien" genannten Dateien vollständig lesen.
3. Voraussetzungen prüfen (`git log --oneline -30`, genannte Tabellen/Dateien existieren).
4. Umsetzen. Nur genannte Dateien plus die neuen, die die Aufgabe vorsieht. Jede weitere Änderung im
   Commit-Body mit einem Satz begründen.
5. Verifikation exakt ausführen. Grundprüfungen immer:
   ```bash
   npx tsc --noEmit && npm test && npm run build
   npm run db:reset && npm run db:test               # sobald Migrationen/Policies betroffen sind
   ```
   `db:reset`/`db:test` laufen gegen eine **native PostgreSQL-16-Instanz mit Supabase-Kompatibilitätsschicht**
   (`scripts/local-db.sh`, Aufgabe 0.2) — in der Entwicklungsumgebung steht kein Docker und damit kein
   `supabase start` zur Verfügung.
6. Ein Commit pro Aufgabe mit dem vorgegebenen Titel; Body 2–5 Zeilen (was, wie verifiziert).
7. Teil K (Status) aktualisieren: Aufgabe, Datum, Commit-Hash.

### A.2 Konventionen

| Thema | Regel |
|---|---|
| Sprache | UI-Texte, Kommentare, Commits: Deutsch. Bezeichner (Code, DB, Enums): Englisch. Enum→Label-Mapping ausschließlich in `src/lib/labels.ts`. |
| Migrationen | Eine Baseline `supabase/migrations/20261001000000_schema_v2.sql` (entsteht in 1.3 und wird bis Abschluss von Phase 1 fortgeschrieben). **Ab dem Commit von Aufgabe 1.9 ist die Baseline eingefroren**; danach jede Änderung als neue Datei `YYYYMMDDHHMMSS_<slug>.sql`, idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`), kein `COMMIT;`. Die alte `20260808000000_init.sql` wird in 1.3 gelöscht. |
| RLS | Jede Tabelle: `ENABLE ROW LEVEL SECURITY` und Policies in derselben Migration. Keine Policy mit `USING (true)` für Schreibzugriffe. Jede Policy hat in `supabase/tests/` mindestens einen positiven und einen negativen pgTAP-Fall. |
| Datenzugriff im Frontend | Nur in `src/features/<feature>/api.ts` (react-query-Hooks). Komponenten importieren Hooks, nie `supabase` direkt. Typen aus `src/lib/database.types.ts` (generiert, nie von Hand geändert). |
| Nebenwirkungen | Aktionen, die Benachrichtigungen auslösen oder mehrere Tabellen ändern, sind Postgres-RPCs (`rpc_*`, SECURITY DEFINER, Rechteprüfung im Funktionskörper). Nie mehrere Client-Statements für eine fachliche Aktion. |
| Reine Logik | Ohne I/O in `supabase/functions/_shared/*.ts`; importierbar aus Frontend (`../../supabase/functions/_shared/x`) und Edge Functions (`../_shared/x.ts`). Keine Deno-/Browser-Imports darin. |
| Formulare | `react-hook-form` + `zod`-Schema in `features/<f>/schemas.ts`. Pflichtfelder und Optionen exakt wie im Zielbild bzw. der Bestandsaufnahme. |
| Tests | Jede Datei in `_shared/` und `src/lib/` hat `tests/<name>.test.ts`. Jede Route hat einen Smoke-Test (rendert ohne Fehler mit gemocktem API-Hook). `it.skip`/`xit` verboten. |
| UI | Nur Komponenten aus `src/components/ui/`. Neue Primitive dort anlegen, nie inline im Feature. Tokens aus Zielbild 6.3. |
| Externe Dienste | Supabase, Resend, GitHub Actions, Web Push (VAPID). Nichts anderes ohne Planänderung. |
| Nicht anfassen | `NOTICE.md`, `docs/upstream-README.md`, `docs/tt-planer-bestandsaufnahme.md`, `REQUIREMENTS.md`. |

### A.3 Definition of Done (jede Aufgabe)

- [ ] Alle Punkte unter „Endzustand" erfüllt und einzeln geprüft.
- [ ] Grundprüfungen grün; bei DB-Änderungen zusätzlich `npm run db:reset` + `npm run db:test` grün.
- [ ] Tests ergänzt (Logik, Policies, Route-Smoke), keine bestehenden gelöscht oder übersprungen.
- [ ] Zielbild nicht verletzt (Namen, Enums, Rechte). Abweichung = Frage in Teil K, nicht Umsetzung.
- [ ] Commit mit vorgegebenem Titel; Teil K aktualisiert.

### A.4 Wenn etwas nicht passt

- Stelle nicht mehr an der beschriebenen Position → per `grep` suchen; Verhalten zählt, nicht die Zeile.
- Fremder Test bricht → nicht anfassen, im Commit-Body nennen, Teil K „Blocker".
- Unklar → Aufgabe nicht beginnen, Teil K „Fragen".

---

## Teil B — Phase 0: Arbeitsumgebung

### Aufgabe 0.1 — Repository und Werkzeuge

**Endzustand:** Node ≥ 20, npm ≥ 10, Docker läuft (`docker ps`), Repo geklont, Branch
`claude/tt-planer-alternative-bc8mku` ausgecheckt, `npm install` fehlerfrei, `npm test` grün (Basisstand:
18 Dateien/87 Tests), `npm run build` erzeugt `dist/`.
**Vorgehen:** `git clone https://github.com/gUrkE1000/tt-fdk.git && cd tt-fdk && git checkout claude/tt-planer-alternative-bc8mku && npm install && npm test && npm run build`
**Commit:** keiner.

### Aufgabe 0.2 — Lokale Test-Datenbank (native PostgreSQL)

In der Entwicklungsumgebung gibt es **keinen Docker-Daemon**, also kein `supabase start`. Stattdessen
läuft eine native PostgreSQL-16-Instanz mit einer Supabase-Kompatibilitätsschicht. Das deckt alles ab,
was wir testen müssen: Migrationen, RLS-Policies, Trigger, RPCs — inklusive `auth.uid()` und der Rollen
`anon` / `authenticated` / `service_role`.

**Dateien:** neu `scripts/local-db.sh`, `scripts/supabase-compat.sql`, `supabase/seed.sql`; `package.json` (Skripte), `.gitignore`, `docs/entwicklung.md`.

**Endzustand — `scripts/supabase-compat.sql`** bildet nach, was Supabase mitbringt und was unsere
Migrationen voraussetzen:
- Extensions `pgcrypto`, `pgtap`;
- Rollen `anon`, `authenticated`, `service_role`, `supabase_auth_admin` (NOLOGIN) mit `GRANT USAGE ON SCHEMA public`;
- Schema `auth` mit `auth.users(id uuid pk, email text, raw_user_meta_data jsonb, created_at)`;
- `auth.uid()`, `auth.role()`, `auth.email()` — lesen `current_setting('request.jwt.claims', true)::json`;
- Hilfsfunktionen `tests.login_as(uuid)` / `tests.logout()` zum Rollenwechsel in pgTAP-Tests.

**Endzustand — `scripts/local-db.sh`** mit den Unterkommandos:
- `start` — Cluster starten (`pg_ctlcluster 16 main start`), idempotent;
- `reset` — Datenbank neu anlegen, `supabase-compat.sql` einspielen, danach **alle** Dateien aus
  `supabase/migrations/` in alphabetischer Reihenfolge, danach `supabase/seed.sql`; bricht beim ersten
  Fehler ab (`psql -v ON_ERROR_STOP=1`);
- `test` — `pg_prove` über `supabase/tests/*.sql`;
- `psql` — interaktive Konsole.

**Endzustand — `package.json`:** `db:start`, `db:reset`, `db:test`, `db:psql` rufen das Skript.
`gen:types` erzeugt die Typen direkt aus der Datenbank-URL (die Supabase-CLI kann das ohne laufende
Supabase-Instanz).

**Endzustand — `docs/entwicklung.md`:** beschreibt beide Wege — native Instanz (diese Umgebung) und
`supabase start` (auf einem Rechner mit Docker). Beide nutzen dieselben Migrationen und Tests.

**Verifikation:** `npm run db:reset` legt die Datenbank an und meldet Erfolg; `npm run db:test` läuft
(zu Beginn ohne Testdateien). Nach 1.3 sind beide mit Inhalt grün.
**Commit:** `Lokale Test-Datenbank mit Supabase-Kompatibilitaetsschicht`

### Aufgabe 0.3 — Cloud-Projekt (Mensch, später)

**Status 17.09.2026: zurückgestellt.** Es gibt noch kein Supabase-Projekt. Die Entwicklung bis
einschließlich Phase 3 läuft gegen die lokale Datenbank aus 0.2. Der ausführende Agent meldet sich,
sobald ein Projekt gebraucht wird — spätestens vor Aufgabe 4.2 (E-Mail-Versand), weil dort erstmals
ein echter Dienst (Resend) und ein erreichbarer Cron nötig sind.

**Endzustand, wenn es soweit ist:** Supabase-Projekt in EU-Region (Frankfurt), Baseline und alle
Folgemigrationen per `supabase db push` eingespielt. Resend-Konto mit verifizierter Absenderadresse,
in Supabase unter Authentication → SMTP Settings als Custom SMTP eingetragen (Host `smtp.resend.com`,
User `resend`, Passwort = API-Key). GitHub-Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_APP_URL`, `VITE_VAPID_PUBLIC_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`,
`SUPABASE_DB_PASSWORD`. Vollständige Anleitung entsteht in Aufgabe 8.4 als `docs/einrichtung.md`.
**Commit:** keiner.

### Aufgabe 0.4 — Umgebungsvariablen

**Dateien:** `.env.example` (erweitern), `.env.local` (lokal, nicht einchecken).
**Endzustand — `.env.example`:**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=http://localhost:5173
VITE_VAPID_PUBLIC_KEY=
```
`VITE_SYNC_SECRET` ist entfernt (Sync läuft nur noch serverseitig). `.env.local` zeigt auf die lokale Instanz aus 0.2.
**Commit:** `Umgebungsvariablen fuer v2`

---

## Teil C — Phase 1: Fundament

Ziel: Leere, aber vollständig verdrahtete App: Routing, Layout, Design-System, Schema-Baseline mit
Mitgliedern/Rechten, Login, Datenzugriffsschicht, CI. Am Ende der Phase kann sich ein Admin einloggen,
sieht die Navigation und eine leere Mitgliederliste.

### Aufgabe 1.1 — Abhängigkeiten, Ordnerstruktur, Router, Layout-Hülle

**Dateien:** `package.json`, neu `src/app/router.tsx`, `src/app/providers.tsx`, `src/app/layout/AppShell.tsx`, `Sidebar.tsx`, `Header.tsx`, `BottomBar.tsx`, `src/app/nav.ts`, `src/main.tsx`, `src/App.tsx` (wird zur Router-Wurzel), `index.html`, `tailwind.config.js`, Tests `tests/app/router.test.tsx`.

**Endzustand:**
- Neue Dependencies: `react-router-dom@^6`, `@tanstack/react-query@^5`, `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns`, `date-fns-tz`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-checkbox`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@dnd-kit/core`, `@dnd-kit/sortable`, `clsx`. Versionen im Lockfile gepinnt.
- `src/app/nav.ts` exportiert die Navigationsstruktur aus Zielbild 2 als Datenstruktur: `{ section, items: [{ to, label, icon, roles: Role[] }] }` — `roles` leer = alle.
- `router.tsx`: `createBrowserRouter` mit allen Routen aus Zielbild 2; jede Route rendert vorerst `<Placeholder title="…"/>`. Öffentliche Routen `/login`, `/r/:token`, `/register/:code` außerhalb des `AppShell`.
- `AppShell`: Desktop-Sidebar 256 px ab `xl`, sonst Drawer + Header + `BottomBar` (Übersicht, Meine Spiele, Trainings, Kalender, Mehr). Aktiver Link teal. Header: Seitentitel (aus Route-Handle), Platzhalter für Glocke und Profilmenü.
- `providers.tsx`: `QueryClientProvider` (staleTime 30 s, retry 1), `BrowserRouter` wird vom Router gestellt.
- `tailwind.config.js`: Tokens aus Zielbild 6.3 als `theme.extend.colors` (`primary`, `status.*`, `cal.*`).
- `index.html` `<title>` = „Vereinsplaner"; `lang="de"`.

**Tests:** Router rendert `/` und `/teams` ohne Fehler; Sidebar zeigt für Rolle `member` keine „Verwalten"-Gruppe, für `admin` alle Gruppen (`nav.ts` als reine Funktion `visibleNav(role)` getestet).
**Verifikation:** Grundprüfungen; `npm run dev` zeigt Sidebar + Platzhalter. Alte Komponenten bleiben vorerst im Baum (werden in 1.7 entfernt), müssen aber nicht mehr erreichbar sein.
**Commit:** `Router, Layout-Huelle und Navigationsstruktur`

### Aufgabe 1.2 — Design-System-Primitives

**Dateien:** neu `src/components/ui/*.tsx` (Liste Zielbild 6.4), `src/components/ui/index.ts`, `src/lib/cn.ts`, Tests `tests/ui/*.test.tsx` (je Komponente ein Render-Test + ein Interaktionstest, wo sinnvoll), neu `src/app/DesignPlayground.tsx` unter Route `/_design` (nur `import.meta.env.DEV`).

**Endzustand:** Alle Komponenten aus Zielbild 6.4 existieren mit den dort genannten Varianten; Props sind typisiert; Touch-Ziele ≥ 44 px; `Dialog`/`Tabs`/`Checkbox`/`Select`/`Popover` auf Radix; `SortableList` auf dnd-kit mit Tastaturbedienung; `Table` rendert unter `md` als Kartenliste (Prop `mobileCard: (row) => ReactNode`); `Toast` über einen `ToastProvider` in `providers.tsx`; `FormField` verdrahtet mit react-hook-form (`name`, Fehleranzeige). `/_design` zeigt alle Komponenten in allen Varianten.
**Verifikation:** Grundprüfungen; `/_design` visuell geprüft auf 375 px und 1440 px Breite.
**Commit:** `Design-System-Primitives`

### Aufgabe 1.3 — Schema-Baseline v2, Teil 1: Verein, Mitglieder, Struktur, Rechte

**Dateien:** löschen `supabase/migrations/20260808000000_init.sql`; neu `supabase/migrations/20261001000000_schema_v2.sql`; neu `supabase/tests/001_helpers.sql`, `supabase/tests/010_profiles_rls.test.sql`, `020_groups_venues_rls.test.sql`; `supabase/seed.sql`; `docs/datenbank.md` (neu schreiben, v2).

**Endzustand — Migration enthält (exakt Zielbild 3.1, 3.8, 5):**
1. Extensions `pgcrypto`, `pg_cron`, `pg_net`; Schema `private` mit `private.cron_config(key, value)`.
2. Enums `user_role`, `member_status`, `gender`, `ranking_type`.
3. Tabellen `club_settings`, `profiles`, `member_rankings`, `groups`, `group_members`, `venues` (Ämter/Schlüssel/Delegationen kommen in Phase 9).
4. Trigger `set_updated_at()` auf allen Tabellen mit `updated_at`.
5. Funktion `handle_new_user()` + Trigger auf `auth.users`: verknüpft nach `LOWER(email)`, sonst neues Profil `role=member, status=pending_approval`; setzt `auth_linked_at`; bei Verknüpfung eines `unconfirmed`-Profils → `status=active`.
6. Helfer (SECURITY DEFINER, STABLE): `current_role()`, `is_admin()`, `is_organizer_or_admin()`, `is_active_member()` (status=active und deleted_at IS NULL).
7. Spaltenschutz-Trigger `protect_profile_columns()`: `role, status, qttr, member_number, no_games` nur `is_admin()`; `member_rankings` nur admin.
8. RLS (Zielbild 5): `profiles` SELECT für `is_active_member()` (Gast: nur eigene Zeile + Zeilen mit `role IN ('admin','trainer')`); UPDATE eigene Zeile oder admin; INSERT/DELETE admin. Kontaktspalten werden nicht per RLS versteckt (Spaltenebene) — stattdessen View `v_members_directory` mit `CASE WHEN contact_visible OR is_admin() THEN email END`. `groups/group_members/venues`: SELECT aktive Mitglieder, Schreiben admin. `club_settings`: SELECT aktive Mitglieder außer Keys mit Präfix `secret_`; Schreiben admin.
9. RPC `get_public_club_info()` (anon): `club_name`, `club_short_name`.
10. Seeds in `club_settings` mit Defaults aus Zielbild 3.8.

**Endzustand — `seed.sql` (lokal):** 1 Admin, 1 Organisator, 2 Trainer, 3 Mannschaftsführer, 20 Mitglieder, 1 Gast; alle mit E-Mail `<vorname>@example.com`; 2 Orte; 3 Gruppen. Rangdaten `men` für 12 Spieler (1.1–1.4, 2.1–2.4, 3.1–3.4).

**Endzustand — pgTAP:** Helfer-Datei simuliert Nutzer per `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);`. Fälle: anon sieht 0 Profile; member sieht alle aktiven; guest sieht nur sich + Admin/Trainer; member kann `first_name` ändern, `role` nicht (throws); admin kann `role` ändern; member kann keinen Ort anlegen; `v_members_directory` liefert `email` NULL, wenn `contact_visible=false` und Aufrufer kein Admin.

**Vorgehen:** Migration schreiben → `npm run db:reset` → `npm run db:test` → `npm run gen:types`. (Cloud-Projekt existiert noch nicht, siehe 0.3.)
**Commit:** `Schema-Baseline v2: Verein, Mitglieder, Gruppen, Orte, Rechte`

### Aufgabe 1.4 — Authentifizierung

**Dateien:** neu `src/features/auth/{api.ts,session.tsx,LoginPage.tsx,RegisterPage.tsx,guards.tsx,schemas.ts}`, `src/app/router.tsx`, `src/lib/supabaseClient.ts`, Tests.

**Endzustand:**
- `LoginPage` (`/login`): Tab „Mit E-Mail-Link" (Standard): E-Mail → `signInWithOtp({ email, options: { emailRedirectTo: VITE_APP_URL, shouldCreateUser: false } })` → Hinweistext. `shouldCreateUser:false`: Unbekannte E-Mails erzeugen **keinen** Account (Schutz vor Fremden); Fehlermeldung „Diese E-Mail ist im Verein nicht bekannt. Bitte beim Admin melden oder den Registrierungslink des Vereins nutzen." Tab „Mit Passwort": `signInWithPassword`. Link „Passwort vergessen" → `resetPasswordForEmail`.
- `RegisterPage` (`/register/:code`): prüft `code` gegen `club_settings.registration_code` per RPC `rpc_validate_registration_code(code)` (anon). Felder Vorname, Nachname, E-Mail, Passwort (optional; leer = nur Magic Link). Ruft `signUp` mit `options.data = { first_name, last_name, registration_code }`; `handle_new_user()` legt Profil `pending_approval` an, wenn `registration_code` gültig ist, sonst verweigert der Trigger (`RAISE EXCEPTION`). QR-Code für den Link wird in 2.3 erzeugt.
- `session.tsx`: `SessionProvider` mit `useSession()` → `{ user, profile, role, loading }`; lädt Profil per react-query; `onAuthStateChange` hält es aktuell. Bei `status=pending_approval`: Seite „Dein Zugang wartet auf Freischaltung durch den Admin." Bei `deleted_at`: Logout.
- `guards.tsx`: `<RequireAuth/>`, `<RequireRole roles={[...]}/>` → Redirect `/` mit Toast „Keine Berechtigung".
- Header-Profilmenü: Name, Rollenlabel, QTTR-Badge, Links „Mein Profil", „Abmelden".
- `supabaseClient.ts` wirft beim Start, wenn `VITE_SUPABASE_URL` fehlt (kein Placeholder mehr).

**Tests:** Login-Tab-Wechsel; OTP-Aufruf mit `shouldCreateUser:false`; Guard leitet `member` von `/players` um; Register mit ungültigem Code zeigt Fehler. pgTAP: `handle_new_user` mit gültigem/ungültigem Code.
**Commit:** `Authentifizierung: Magic Link, Passwort, Registrierung per Code`

### Aufgabe 1.5 — Datenzugriffsschicht und generierte Typen

**Dateien:** `package.json` (Skript `gen:types`: `supabase gen types typescript --local > src/lib/database.types.ts`), neu `src/lib/database.types.ts` (generiert), `src/lib/labels.ts`, `src/lib/dates.ts`, `src/lib/queryKeys.ts`, `src/features/members/api.ts` (erstes Beispiel), Tests.

**Endzustand:**
- `database.types.ts` generiert und eingecheckt; CI prüft in 1.8, dass es aktuell ist (Diff nach `gen:types` leer).
- `labels.ts`: `roleLabel`, `statusLabel`, `rankingTypeLabel`, später weitere — jede Enum aus dem Schema hat hier genau eine deutsche Bezeichnung (Werte wie in der Bestandsaufnahme: „Admin, Mannschaftsführer, Trainer, Organisator, Mitglied, Gast" …).
- `dates.ts`: `formatDate`, `formatTime`, `formatDateTime`, `formatShortDayDate` („Do., 08.10.2026"), `toBerlin`, `fromBerlin`, `weekdayLabel` — alle auf date-fns-tz mit `Europe/Berlin`.
- `queryKeys.ts`: Factory je Feature (`members.list(filters)`, `members.detail(id)` …).
- `features/members/api.ts`: `useMembers(filters)`, `useMember(id)`, `useUpdateMember()`, mit Invalidation. Dient als Vorlage; ein Kommentarblock am Dateikopf beschreibt das Muster (Query, Mutation, Invalidation, Fehler → Toast).

**Tests:** `dates.test.ts` (Zeitzone Sommer/Winter), `labels.test.ts` (jede Enum vollständig abgedeckt — Test iteriert über `Database['public']['Enums']`).
**Commit:** `Datenzugriffsschicht, Labels, Datumsfunktionen, generierte Typen`

### Aufgabe 1.6 — Reine Logik aus der Basis übernehmen

**Dateien:** neu `supabase/functions/_shared/ics.ts`, `homeAway.ts`, `lineupOrder.ts`, `syncPlanner.ts`; neu `src/lib/names.ts`, `src/lib/lineupText.ts`; Tests dazu (bestehende Tests `icsParser.test.ts`, `realCalendarSync.test.ts`, `nameUtils.test.ts`, `whatsappUtils.test.ts` werden auf die neuen Module umgezogen und angepasst).

**Endzustand:**
- `ics.ts`: `parseIcs`, `parseLocalDateToUtc`, `extractMatchday` unverändert aus `src/lib/icsParser.ts`.
- `homeAway.ts`: `determineHomeAway(summary, teamName, clubAliases: string[])` — Alias-Liste statt festem Vereinsnamen; Tests übergeben `['heiligenhaus','heiligenhauser']`, damit die realen Upstream-Kalenderdaten weiter als Testfälle dienen.
- `lineupOrder.ts`: `orderLineupCandidates(candidates: {profileId, response, isRegular, teamNumber, positionNumber, name}[]): string[]` — Reihenfolge `yes` (regular vor substitute, dann Rang) > `none` > `unclear` > `no`; `yes_sub` existiert nicht mehr.
- `syncPlanner.ts`: `planSync(existing: MatchRow[], events: IcsEvent[], now): SyncAction[]` mit Aktionen `insert | reschedule(version+1) | update_details | touch | deactivate` und der **Sicherheitssperre** (0 Events bei aktiven Spielen → `[]` + `warning`). Berücksichtigt `dtstart_override` (Zielbild 4.3): liefert der Feed `dtstart_external = override` → Aktion `clear_override`.
- `names.ts`: `getShortName`, `getFirstName`, `isNameMatch`.
- `lineupText.ts`: `buildLineupText(input): string` erzeugt exakt das Format aus Bestandsaufnahme C „Aufstellung teilen", ergänzt um Zeile „Treffpunkt: <Ankunftszeit> Uhr <Ort>" (aus `arrival_minutes_*`) und „Hinweis: <comment_home/away>" sowie den Parallelspiel-Satz; zweite Funktion `buildMissingPlayersText` für < required_players (aus Basis-Generator).

**Tests:** Alle bisherigen Fälle bestehen weiter (umbenannt); neu: `syncPlanner` mit 8 Fällen (neu, verlegt, Details, unverändert, entfallen, Sicherheitssperre, Override bestätigt, Override abweichend), `lineupText` mit 3 Fällen (Heim, Auswärts, zu wenige).
**Commit:** `Reine Logik aus der Basis uebernehmen`

### Aufgabe 1.7 — Altcode entfernen

**Dateien:** löschen `src/components/*` (alle 10 Altkomponenten), `src/lib/icsParser.ts`, `syncEngine.ts`, `whatsappUtils.ts`, `nameUtils.ts`, alte `tests/*` dazu, `supabase/functions/sync-calendars/index.ts` (wird in 3.3 neu geschrieben), `docs/nutzung.md`, `docs/architektur.md`, `docs/faq.md`, `docs/einrichtung.md` (werden in 8.4/10.1 neu geschrieben; bis dahin steht in `README.md` der Hinweis „Doku im Aufbau, siehe zielbild.md").
**Endzustand:** `grep -rn "club_password\|ttv_selected_player_id\|allorigins\|codetabs" src/ supabase/` ohne Treffer. `src/App.tsx` besteht nur aus `<RouterProvider/>`. Tests grün (nur noch neue).
**Commit:** `Altcode der Basis entfernen`

### Aufgabe 1.8 — CI/CD

**Dateien:** `.github/workflows/ci.yml` (neu, ersetzt `run-tests.yml` + `code-quality.yml`), `deploy.yml` (anpassen), `deploy-edge-functions.yml` (anpassen), löschen `sync-calendars.yml`, `auto-version-badges.yml`; `README.md`.
**Endzustand:** `ci.yml` bei PR und Push auf `main`. Job `app`: `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`. Job `database`: Service-Container `postgres:16`, pgTAP im Runner nachinstalliert, dann `scripts/local-db.sh reset` und `scripts/local-db.sh test` gegen den Container, plus Typen-Aktualitätsprüfung (`npm run gen:types && git diff --exit-code src/lib/database.types.ts`). `deploy.yml`: Pages-Deploy mit `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `VITE_VAPID_PUBLIC_KEY`. `deploy-edge-functions.yml`: deployt **alle** Ordner unter `supabase/functions/` außer `_shared` bei Änderung, plus `supabase db push` für Migrationen (Secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`).
**Verifikation:** Workflow-Lauf auf `main` grün. Der Verein arbeitet direkt auf `main` (Entscheidung 17.09.2026); Feature-Branches bleiben möglich und lösen denselben Workflow per PR aus.
**Commit:** `CI mit Typecheck, Tests, pgTAP und Deploy`

### Aufgabe 1.9 — Baseline einfrieren, README

**Dateien:** `README.md`, `docs/umsetzungsplan.md` (Teil K).
**Endzustand:** README beschreibt Stack, Setup (0.1–0.4), Skripte, Ordnerstruktur, Link auf Zielbild und Plan. Absatz „Schema-Baseline eingefroren ab <Commit>".
**Commit:** `Baseline v2 eingefroren`

---

## Teil D — Phase 2: Mitglieder und Verein

### Aufgabe 2.1 — Mein Profil

**Dateien:** neu `src/features/profile/{api.ts,schemas.ts,ProfilePage.tsx,ProfileTab.tsx,AbsencesTab.tsx}` (Benachrichtigungen-Tab in 4.3, Auto-Zusagen in 6.7), Migration `<ts>_absences.sql`, pgTAP `030_absences_rls.test.sql`, Tests.
**Endzustand:** Route `/profile` mit Tabs „Profil · Abwesenheiten · Benachrichtigungen · Automatische Trainingszusagen" (letzte zwei vorerst Platzhalter). Profil-Tab: Felder aus Bestandsaufnahme G „nur im eigenen Profil" (ohne Foto, ohne Sprache) + Stammdaten (Vorname, Nachname, Geschlecht, Geburtstag, Telefon, Handy) + Passwort setzen/ändern (`updateUser`) + Button „Profil & Zugang löschen" (Dialog mit Bestätigungstext → RPC `rpc_delete_my_account` setzt `deleted_at`, Logout). Abwesenheiten-Tab: Tabelle Von | Bis | Kommentar | Aktion, Dialog mit VON (Pflicht), BIS, KOMMENTAR (nur für dich sichtbar). Tabelle `absences` (Zielbild 3.5) mit RLS: SELECT eigene oder admin/team_leader/trainer (Kommentar nur eigene → View `v_absences_public` ohne Kommentar für Fremde); Schreiben eigene oder admin.
**Tests:** Route-Smoke; Absence-Formular Validierung (BIS ≥ VON); pgTAP: MF sieht fremde Abwesenheit ohne Kommentar.
**Commit:** `Mein Profil und Abwesenheiten`

### Aufgabe 2.2 — Mitgliederverwaltung

**Dateien:** neu `src/features/members/{MembersPage.tsx,MemberTable.tsx,MemberDialog.tsx,RankingEditor.tsx,schemas.ts}`, `api.ts` (erweitern), Tests.
**Endzustand:** Route `/players` (admin), Tab „Mitglieder": Filter Suche · Alle Rollen · Alle Status · Alle Mannschaften · Alle Trainings · Zurücksetzen; Spalten Name (mit QTTR-Badge) | E-Mail | Rolle | Status | Mannschaft (STAMM/ERSATZ ab Phase 3) | Training (ab Phase 6) | Gruppen | Aktion (Bearbeiten, Freischalten wenn `pending_approval`, Löschen = `deleted_at`). Dialog mit **allen** Feldern aus Bestandsaufnahme G Objekt Mitglied (Rang-Felder als `RankingEditor`: je `ranking_type` ein Feld „1.2"-Format → `member_rankings`). Kopfbutton „Ränge bearbeiten" schaltet Inline-Edit der Rangspalte, „QTTR Update" öffnet Massen-Eingabe (Name → QTTR). Freischalten ruft RPC `rpc_activate_member(id)` (setzt `active`, löst Willkommens-E-Mail aus — Versand erst ab 4.2 wirksam, RPC schreibt bis dahin nur den Status; Hook `enqueue_notification` wird in 4.1 nachgezogen).
**Tests:** Filterlogik als reine Funktion `filterMembers()`; Dialog-Validierung; Rang-Parser „1.2" ↔ `{team_number:1, position_number:2}`.
**Commit:** `Mitgliederverwaltung`

### Aufgabe 2.3 — Einladung und Registrierung

**Dateien:** neu `supabase/functions/invite-member/index.ts`, `src/features/members/InviteDialog.tsx`, `RegistrationLinkDialog.tsx` (Link + QR via `qrcode`-Paket), `src/features/club/api.ts` (registration_code), Tests.
**Endzustand:** Dropdown „Mitglieder hinzufügen" mit: (1) per E-Mail einladen (mehrere Adressen, je Zeile Vorname Nachname E-Mail Rolle) → legt Profile `unconfirmed` an und ruft `invite-member` je Adresse (`auth.admin.inviteUserByEmail`, Redirect `VITE_APP_URL`); (2) Mitglied ohne E-Mail anlegen (= Dialog aus 2.2); (3) Registrierungslink kopieren; (4) QR-Code anzeigen. Admin kann `registration_code` neu generieren (Verein → Daten). `invite-member`: Auth = Admin-JWT; Body `{ profileId }`; Fehler `already_registered` wird als Toast gezeigt.
**Commit:** `Mitglieder einladen per E-Mail, Link und QR`

### Aufgabe 2.4 — Gruppen

**Dateien:** `src/features/members/{GroupsTab.tsx,AssignMembersDialog.tsx}`, `api.ts`, Tests.
**Endzustand:** Tab „Gruppen": Tabelle Name | Mitglieder; „Gruppe anlegen" (nur NAME); „Mitglieder zuweisen" (Gruppe → Mehrfachauswahl Mitglieder). Gruppen erscheinen als Filter und Spalte in 2.2.
**Commit:** `Gruppen`

### Aufgabe 2.5 — Vereinsdaten und Orte

**Dateien:** neu `src/features/club/{ClubPage.tsx,ClubDataTab.tsx,ClubOverviewTab.tsx,schemas.ts}`, `src/features/venues/{VenuesPage.tsx,VenueDialog.tsx,api.ts,schemas.ts}`, Tests.
**Endzustand:** `/club` Tabs „Daten · Ämter · Neuigkeiten · Dateien · Übersicht" (Ämter/Neuigkeiten/Dateien Platzhalter bis Phase 9). Daten-Tab: alle Felder aus Bestandsaufnahme I (ohne Sponsor-Logo, ohne FAQ-Datei) + **Bundesland** (Auswahl 16) + Registrierungscode + `default_venue_id`. Übersicht-Tab: Tabelle Name | Mitglieds-Nr. | Zugang seit | Rolle | Training | Mannschaft | Ersatz (Spalten, die es noch nicht gibt, leer). `/venues`: Abschnitt Orte mit allen Feldern aus Bestandsaufnahme F Objekt Ort; Abschnitt Schlüssel Platzhalter (9.1).
**Commit:** `Vereinsdaten und Orte`

### Aufgabe 2.6 — Mein Verein (Mitgliedersicht)

**Dateien:** neu `src/features/club/MyClubPage.tsx` + Tabs `Mitglieder`, `Rollen & Kontaktdaten` (Rest Platzhalter bis zur jeweiligen Phase), Tests.
**Endzustand:** `/my-club` Tab „Mitglieder": Liste aus `v_members_directory` (Kontaktdaten nur bei Freigabe), Suche. Tab „Rollen & Kontaktdaten": Admin, Trainer, Mannschaftsführer mit freigegebenen Kontaktdaten (Ämter kommen in 9.6).
**Commit:** `Mein Verein: Mitglieder und Kontaktdaten`

---

## Teil E — Phase 3: Mannschaften und Spieltermine

### Aufgabe 3.1 — Schema: Mannschaften, Spiele, Beteiligung, RPCs

**Dateien:** Migration `<ts>_teams_matches.sql`; pgTAP `040_teams_rls.test.sql`, `041_matches_rls.test.sql`, `042_rpc_match_response.test.sql`; `npm run gen:types`; `docs/datenbank.md`.
**Endzustand:** Tabellen `teams`, `team_leaders`, `team_members`, `matches`, `match_participations`, `match_volunteers`, `match_changes`, `sync_runs` exakt Zielbild 3.2/3.3 (ohne `substitute_requests`, `reschedule_*` — Phase 5). Trigger: `team_members` regular ≤ `teams.size`; `substitute.rank` eindeutig je Team; `matches.required_players` Default aus `teams.size`; beim Anlegen eines Spiels Zeilen in `match_participations` für alle `team_members` mit `response=none` (Trigger `seed_match_participations`). Helfer `leads_team(team_id)`. RLS: `teams` SELECT aktive Mitglieder, Schreiben admin; `team_leaders` Schreiben admin; `team_members` Schreiben admin oder `leads_team`; `matches` SELECT aktive Mitglieder, INSERT/UPDATE admin oder `leads_team`, DELETE admin; `match_participations` SELECT aktive Mitglieder, direkter Schreibzugriff **niemand** (nur RPC); `match_volunteers` eigene Zeile oder leads_team. RPCs: `rpc_set_match_response(match_id, response, comment)` (eigene Antwort; prüft `block_participants_after`; setzt `version_responded = matches.version`, `source=self`; in `lineup_mode=fixed` und `lineup_locked=false` ruft `recompute_lineup(match_id)`), `rpc_manage_player(match_id, profile_id, action)` mit `action ∈ add, remove, decline, reset` (Rechte: admin oder leads_team; `add` setzt `response=yes, lineup_position` nächste freie; `remove` setzt `removed=true`; `decline` setzt `response=no`; `reset` setzt `response=none, removed=false, lineup_position=NULL`), `rpc_set_lineup(match_id, positions jsonb)` (setzt Positionen, `lineup_locked=true`), `recompute_lineup(match_id)` (SQL, Zielbild 4.1 fixed-Modus). Audit in `match_changes` bei jeder RPC.
**pgTAP:** member antwortet für sich (ok), für anderen (throws); MF fremdes Team `rpc_manage_player` (throws); `recompute_lineup` setzt 4 regulars mit yes auf Positionen 1–4, fünften auf 5; `block_participants_after` in der Vergangenheit → throws.
**Commit:** `Schema: Mannschaften, Spiele, Beteiligung`

### Aufgabe 3.2 — Mannschaften verwalten

**Dateien:** neu `src/features/teams/{TeamsPage.tsx,TeamDialog.tsx,TeamRosterEditor.tsx,PlayersManagementPage.tsx,api.ts,schemas.ts}`, `src/lib/labels.ts`, Tests.
**Endzustand:** `/teams`: Tabelle Name | Mannschaftsführer | Spieler | Ersatzspieler | Ligen | Aktion, Untertitel „4er Mannschaft · Rang: 2 | Erwachsene"; Kopfbuttons „Mannschaft anlegen", „Mannschaften bearbeiten". Dialog mit **allen** Feldern aus Bestandsaufnahme C Objekt Mannschaft (Ligen als Freitext-Chips; Ersatzspieler als `SortableList`; Hinweis „Maximal {size} Stammspieler"; Hilfetexte zu Spieler-Logik und Ersatzanfragen-Logik wörtlich aus der Bestandsaufnahme) + Webcal-URL + Ankunftsminuten + Frist Ersatzanfrage. `/teams/players-management`: Tabelle Mannschaft | Stammspieler | Ersatzspieler mit zwei Auswahlfeldern je Zeile, Speichern.
**Tests:** Schema-Validierung (size Pflicht, regulars ≤ size); SortableList-Reihenfolge wird als `rank` gespeichert.
**Commit:** `Mannschaften und Kader`

### Aufgabe 3.3 — ICS-Import und Kalender-Sync

**Dateien:** neu `supabase/functions/sync-calendars/index.ts`, Migration `<ts>_cron_sync.sql`, `src/features/matches/ImportDialog.tsx`, `src/features/admin/SyncRunsPanel.tsx`, Tests (`syncPlanner` bereits; Function-Handler mit gemocktem fetch).
**Endzustand:** Function: Auth = `x-cron-secret` (aus `private.cron_config`) **oder** JWT admin/team_leader; Body optional `{ teamId }`; lädt `club_aliases`, je Team mit `sync_enabled` und `webcal_url` ICS holen, `planSync` anwenden, Aktionen ausführen (insert löst `seed_match_participations` und Notification `match_created` aus — Notification-Aufruf erst ab 4.1 wirksam, bis dahin `IF EXISTS`-Aufruf), `sync_runs` schreiben. Cron: täglich 04:00 UTC über pg_net; `docs/betrieb.md` (neu) beschreibt das Setzen von `private.cron_config` (`functions_base_url`, `cron_secret`). Import-Dialog (`/games` → „Spiele importieren"): MANNSCHAFT (Pflicht), KALENDER SPIELPLAN URL (Pflicht, Validierung `exportICSCalendar?teamIds=`), Hinweistext wörtlich aus Bestandsaufnahme D; speichert `webcal_url` am Team und ruft die Function mit `teamId`; zeigt Ergebnis (neu/verlegt/entfallen). Admin-Panel zeigt letzte 20 Läufe.
**Verifikation:** Lokal mit einer echten öffentlichen myTischtennis-ICS-URL: Spiele erscheinen; zweiter Lauf: 0 Änderungen; Feed-URL absichtlich kaputt: Lauf `failed`, keine Spiele deaktiviert.
**Commit:** `ICS-Import und serverseitiger Kalender-Sync`

### Aufgabe 3.4 — Spieltermine: Liste, Filter, manuell anlegen

**Dateien:** neu `src/features/matches/{GamesPage.tsx,GameTable.tsx,GameDialog.tsx,api.ts,schemas.ts,filters.ts}`, Tests.
**Endzustand:** `/games` Tabs „Offene Termine (n)" / „Beendete Termine (n)" (beendet = `dtend < now`); Filter Suche · Mannschaft · Zeitraum von/bis · Filter hinzufügen (Rangtyp, Spielort, Spielerstand = vollständig/unvollständig, Terminabweichung = override gesetzt, Ohne Code/PIN) · Zurücksetzen; Spalten Termin (Sync-Symbol bei `source=ics`) | Mannschaft (MF-Avatar) | Gegner (HEIM/AUSWÄRTS, Liga, Halle) | Aufstellung (Avatare + Balken, Buttons „Spieler verwalten", „Aufstellung teilen" — beide erst in 3.6/3.7 aktiv) | Aktion (Bearbeiten, Spielverlegung [5.5], Löschen). Dialog mit allen Feldern aus Bestandsaufnahme C Objekt Spieltermin (Code/PIN inklusive). Mehrfachauswahl-Checkboxen mit Massenaktion „Löschen".
**Tests:** `filters.ts` rein getestet (jeder Filter); Dialog-Pflichtfelder.
**Commit:** `Spieltermine: Liste, Filter, Bearbeitung`

### Aufgabe 3.5 — Spielkarte, eigene Rückmeldung, Fahrdienst, Meine Spiele

**Dateien:** neu `src/features/matches/{GameCard.tsx,ResponseButtons.tsx,VolunteerToggles.tsx,MyGamesPage.tsx}`, Tests.
**Endzustand:** `GameCard` nach Zielbild 6.5 (ohne MF-Leiste, die kommt in 3.6). `ResponseButtons`: Zusage / Unsicher / Absage + Bemerkung (Popover), ruft `rpc_set_match_response`; Anzeige des eigenen Status als Badge; bei `version_responded < version` Warnbanner „Termin geändert — bitte erneut antworten". `VolunteerToggles`: „Ich kann fahren"/„Kann doch nicht fahren", „Ich bringe etwas mit" (ausgeblendet bei `hide_drivers_catering`). `/my-games`: Filter-Chips Alle/Heim/Auswärts, Karten der Spiele, an denen ich beteiligt bin (Kader oder Teilnahmezeile), sortiert nach Datum.
**Tests:** Buttons rufen RPC mit richtigem Wert; Banner erscheint bei veralteter Version; Chips filtern.
**Commit:** `Spielkarte mit Rueckmeldung und Fahrdienst`

### Aufgabe 3.6 — Aufstellung: Automatik und Dialog „Spieler verwalten"

**Dateien:** neu `src/features/matches/{ManagePlayersDialog.tsx,LineupSection.tsx}`, `api.ts`, Migration `<ts>_v_match_lineup_status.sql` (View Zielbild 3.7), Tests, pgTAP `043_lineup_view.test.sql`.
**Endzustand:** Dialog exakt nach Zielbild 6.5 mit Abschnitten 1–8 aus Bestandsaufnahme C; Aktions-Icons mit Tooltips im Wortlaut der „Erklärung Aktionen" (`?` und `🗑` sind bis 5.4 deaktiviert). Aufstellung: Positionen per `SortableList` änderbar → `rpc_set_lineup` (setzt `lineup_locked`); Button „Automatik wiederherstellen" (`lineup_locked=false` + `recompute_lineup`). Abschnitt „Spieltermin am gleichen Tag" aus Query über `match_participations` mit `response=yes` bei anderem Spiel ±3 h. Bei `lineup_mode=open` Hinweis „Offene Spieler: Aufstellung bitte manuell festlegen" und Vorschlag-Button. MF-Leiste auf der Karte: Spieler verwalten · Aufstellung teilen · Spielverlegung.
**Tests:** Dialog gruppiert Testdaten korrekt in die sechs Abschnitte; Aktionen rufen `rpc_manage_player` mit richtigem `action`.
**Commit:** `Aufstellung: Automatik und Dialog Spieler verwalten`

### Aufgabe 3.7 — Aufstellung teilen

**Dateien:** neu `src/features/matches/ShareLineupDialog.tsx`, `src/lib/lineupText.ts` (aus 1.6, ggf. anpassen), Tests.
**Endzustand:** Dialog mit Textblock aus `buildLineupText` (Format Bestandsaufnahme C, Ort mit Adresse aus `venues` bzw. `location_text`, Fahrer aus `match_volunteers`, Ankunftszeit, Standard-Hinweis der Mannschaft), Button „In Zwischenablage kopieren" (Toast „Kopiert"), Button „Per E-Mail an Aufstellung senden" (erst ab 4.4 aktiv).
**Commit:** `Aufstellung teilen`

### Aufgabe 3.8 — Mein Verein: Mannschaften und Spiele

**Dateien:** `src/features/club/MyClubPage.tsx` (Tabs Mannschaften, Spiele), Tests.
**Endzustand:** Tab „Mannschaften": Karten je Team mit Kader (Stamm/Ersatz), MF. Tab „Spiele": Filter Suche · Alle Mannschaften · Alle Spielorte · Zeitraum · Einträge pro Seite; dieselben `GameCard`s.
**Commit:** `Mein Verein: Mannschaften und Spiele`

---

## Teil F — Phase 4: Benachrichtigungen

### Aufgabe 4.1 — Schema: Präferenzen, Outbox, Vorlagen, Aktions-Token

**Dateien:** Migration `<ts>_notifications.sql`; pgTAP `050_notifications.test.sql`; `gen:types`.
**Endzustand:** Tabellen aus Zielbild 3.6 (`notification_preferences`, `notifications`, `push_subscriptions`, `action_tokens`; `calendar_tokens` in 7.4) + `notification_templates(type PK, subject_tpl, body_tpl)` mit den 15 Typen (Betreff/Text deutsch, Platzhalter `{{first_name}} {{opponent}} {{date}} {{time}} {{home_away}} {{team}} {{link}} {{training}} {{event}} {{deadline}}`). SQL-Funktion `enqueue_notification(p_profile uuid, p_type text, p_payload jsonb, p_force_email bool DEFAULT false)`: liest Präferenzen (fehlende Zeile = an), erzeugt je aktivem Kanal eine `notifications`-Zeile mit gerendertem Text (Funktion `render_template`), hängt `emails_copies` als `payload.cc` an, erzeugt bei `payload.action` einen `action_tokens`-Eintrag und ersetzt `{{link}}` durch `<app_url>/r/<token>`. `p_force_email=true` ignoriert die Matrix (Direkt-E-Mails). RLS: `notifications` SELECT eigene oder admin, Schreiben niemand (nur Funktionen); `notification_preferences` eigene Zeile; `push_subscriptions` eigene; `action_tokens` niemand (nur RPC).
**pgTAP:** Präferenz `email=false` → nur Push-Zeile; ohne Präferenzzeile → beide; `force_email` → E-Mail trotz `false`; Token wird erzeugt und Link steht im Text.
**Commit:** `Schema: Benachrichtigungen und Aktions-Token`

### Aufgabe 4.2 — Versand: `process-notifications` (E-Mail)

**Dateien:** neu `supabase/functions/process-notifications/index.ts`, `_shared/notificationState.ts` (+Test), `_shared/emailHtml.ts` (+Test), Migration `<ts>_cron_notifications.sql`, `docs/betrieb.md`.
**Endzustand:** Function (Auth Cron-Secret oder admin): bis 50 `pending` mit `scheduled_for <= now()`; E-Mail via Resend (`from` aus `notification_sender_*`, `to` = `profiles.email`, `cc` = `payload.cc`, `text`, `html`); Zustandsübergänge `sent | retry(+15 min, attempts+1) | failed (attempts ≥ 3) | skipped (keine E-Mail / deleted)`. Push-Zeilen werden übersprungen (8.3). Cron alle 5 Minuten. Secret `RESEND_API_KEY`.
**Verifikation:** Lokal Zeile einfügen → Function → Mail kommt (Resend-Test-Domain), Status `sent`.
**Commit:** `E-Mail-Versand ueber Outbox und Resend`

### Aufgabe 4.3 — Einstellungs-Matrix im Profil

**Dateien:** `src/features/profile/NotificationsTab.tsx`, `src/features/notifications/{api.ts,NotificationMatrix.tsx}`, Tests.
**Endzustand:** Tabelle 15 Typen × (APP, E-MAIL) Checkboxen (Reihenfolge und Labels Zielbild 3.6), darunter „Für welche Trainings möchtest du eine Teilnahmeerinnerung erhalten?" (Mehrfachauswahl, leer = „Allen zugeordneten Trainings"; Tabelle `training_reminder_filter(profile_id, training_id)` — Migration in dieser Aufgabe, Trainings existieren ab Phase 6, das Feld bleibt bis dahin leer), „Wie viele Stunden vor einem Spiel möchtest du erinnert werden?" (`reminder_games_hours`), Kopie-Adressen (`emails_copies`). Speichern sticky.
**Commit:** `Benachrichtigungseinstellungen`

### Aufgabe 4.4 — Ereignisgesteuerte Benachrichtigungen

**Dateien:** Migration `<ts>_notification_triggers.sql`; pgTAP `051_notification_triggers.test.sql`; `sync-calendars` (Aufruf aktivieren); `ShareLineupDialog` (E-Mail-Button); `rpc_activate_member` (Willkommensmail); `invite-member` unverändert (Supabase-Mail).
**Endzustand:** `match_created` bei Insert in `matches` an alle `team_members`; `match_assigned` bei `rpc_manage_player(add)` und `rpc_set_lineup`; Direkt-E-Mails (`p_force_email`) bei `add/remove/decline` durch MF mit Texten aus „Erklärung Aktionen"; `match_changed` bei `version`-Erhöhung oder `active=false` an Kader; Willkommensmail bei Freischaltung (Text aus `welcome_email_html` oder Standard); „Per E-Mail an Aufstellung senden" → `p_force_email` an alle mit `lineup_position` (Typ `lineup_shared`, Template ergänzen).
**pgTAP:** Insert Match → n Zeilen `match_created`; Verlegung → `match_changed`; `add` → `match_assigned` + Direktmail.
**Commit:** `Ereignisgesteuerte Benachrichtigungen`

### Aufgabe 4.5 — Erinnerungen: `enqueue-reminders`

**Dateien:** neu `supabase/functions/enqueue-reminders/index.ts`, `_shared/reminderPlanner.ts` (+Test), Migration `<ts>_reminder_tracking.sql` (`match_reminders(match_id, profile_id, match_version, sent_at)`, `open_reminder_log(profile_id, sent_on date)`), Cron alle 10 min.
**Endzustand:** (a) `match_reminder`: je Spiel und je beteiligtem Mitglied (Aufstellung oder Kader mit `response ≠ no`), wenn `now ≥ dtstart − reminder_games_hours(member)` und noch nicht gesendet für diese Version, Fangfenster 6 h. (b) `open_participations`: einmal täglich ab `open_reminder_time` je Mitglied mit mindestens einer offenen Antwort (Spiele in `open_reminder_days`, ab Phase 6/7 auch Trainings/Termine — Planner nimmt eine generische Liste `openItems`), nicht doppelt am Tag. `reminderPlanner` ist rein: `planMatchReminders(input)`, `planOpenReminders(input)`.
**Tests:** ≥ 8 Fälle (Vorlauf, Fangfenster, Version, bereits gesendet, tägliche Sperre, keine offenen → nichts).
**Commit:** `Erinnerungen an Spiele und offene Rueckmeldungen`

### Aufgabe 4.6 — Antwort-Links ohne Login

**Dateien:** Migration `<ts>_rpc_action_token.sql`, `src/features/auth/ActionPage.tsx` (Route `/r/:token`), Tests, pgTAP `052_action_tokens.test.sql`.
**Endzustand:** RPC `rpc_answer_action_token(p_token, p_answer text)` (anon erlaubt): prüft Token (existiert, nicht benutzt, nicht abgelaufen), führt je `action` aus (`match_response` → wie `rpc_set_match_response` im Namen des Token-Profils; `substitute_answer`, `event_response`, `poll_vote` in ihren Phasen), markiert `used_at`, gibt `{status: ok|expired|used|unknown, summary}` zurück. `ActionPage`: liest `?a=`, zeigt Bestätigung („Danke, deine Zusage ist gespeichert.") oder Fehler, Link „Zur App". Tokens laufen mit `dtstart` des Ziels ab.
**pgTAP:** ok / used / expired / unknown.
**Commit:** `Antwort-Links ohne Login`

---

## Teil G — Phase 5: Ersatzkette und Spielverlegung

### Aufgabe 5.1 — Schema

**Dateien:** Migration `<ts>_substitutes_reschedule.sql`; pgTAP `060_substitutes_rls.test.sql`; `gen:types`.
**Endzustand:** `substitute_requests`, `reschedule_polls`, `reschedule_votes` (Zielbild 3.3); RLS: Requests SELECT eigene oder Kader-Mitglied des Teams oder leads_team; Schreiben nur RPC/Service Role. RPCs: `rpc_create_substitute_request(match_id, profile_id)` (MF, manuell), `rpc_cancel_substitute_request(id)`, `rpc_answer_substitute_request(id, answer)` (Angefragter; setzt Response + Status; bei Zusage und (`fixed` oder `manual_request_auto_add`) `recompute_lineup`/Position). `action_tokens.action='substitute_answer'` in `rpc_answer_action_token` verdrahtet.
**Commit:** `Schema: Ersatzanfragen und Spielverlegung`

### Aufgabe 5.2 — Reine Planungslogik `planSubstituteStep`

**Dateien:** neu `supabase/functions/_shared/substituteEngine.ts`, `tests/substituteEngine.test.ts`.
**Endzustand:** Schnittstelle:
```ts
export type SubstituteMode = 'sequential' | 'parallel' | 'manual';
export interface EngineInput { now: Date; timeoutHours: number; match: { id; version; dtstart; active; requiredPlayers; lineupLocked };
  team: { id; substituteMode: SubstituteMode; manualAutoAdd: boolean };
  participations: { profileId; response: 'none'|'yes'|'no'|'unclear'; versionResponded; lineupPosition: number|null; removed: boolean; isRegular: boolean }[];
  candidates: { profileId; rank }[]; requests: { id; profileId; rank; status; expiresAt; matchVersion; createdBy }[];
  absences: { profileId; startDate; endDate }[]; exhaustedNotified: boolean; }
export type EngineAction = { kind:'expire'|'cancel'|'accept'|'decline'; requestId; reason? } | { kind:'request'; profileId; rank; expiresAt } | { kind:'exhausted' };
export function planSubstituteStep(i: EngineInput): EngineAction[];
```
Regeln exakt Zielbild 4.2, ausformuliert in Kommentaren in der Datei. `needed = requiredPlayers − |lineupPosition ≤ requiredPlayers und response=yes und !removed|`. `manual`: nur Aufräumen + Auswertung von Antworten auf manuelle Requests; keine neuen Requests. `lineupLocked=true`: keine neuen Requests (MF hat übernommen), Aufräumen ja.
**Tests:** ≥ 14 Fälle (je Regel, sequentiell Weiterrücken, parallel Storno der übrigen bei Zusage, Verlegung, genug Spieler, Abwesender übersprungen, manual, locked, exhausted nur einmal).
**Commit:** `Planungslogik der Ersatzkette`

### Aufgabe 5.3 — `substitute-engine` Function, Cron, Sofort-Auslöser

**Dateien:** neu `supabase/functions/substitute-engine/index.ts`, Migration `<ts>_cron_substitute.sql`, `rpc_set_match_response` und `rpc_manage_player` (rufen nach `no`/`decline` per `pg_net` die Function mit `matchId` — asynchron), Tests.
**Endzustand:** Function: Auth Cron-Secret oder JWT admin/leads_team; Body `{ matchId? }`; Daten laden, `planSubstituteStep`, Aktionen ausführen: `request` → Insert + `enqueue_notification(substitute_request, {action:'substitute_answer'})`; `accept` → `substitute_found` an Absager(n) der Version + MF, parallel: übrige `cancel`; `exhausted` → `substitute_chain_exhausted` an `team_leaders`, `exhaustedNotified` über Existenz einer solchen Notification je (match, version). Audit in `match_changes`. Cron alle 10 min ohne Body (alle aktiven Spiele der nächsten 21 Tage + Spiele mit `pending`).
**Verifikation:** Szenario aus Zielbild 4.2 lokal durchgespielt (sequentiell 2 Kandidaten; parallel 3 Kandidaten).
**Commit:** `Edge Function substitute-engine`

### Aufgabe 5.4 — Ersatzkette in der Oberfläche

**Dateien:** neu `src/features/substitutes/{ChainStepper.tsx,SubstituteBanner.tsx,api.ts}`, `ManagePlayersDialog` (Aktionen `?` und `🗑` aktivieren), `GameCard`, `MyGamesPage`, Tests.
**Endzustand:** Schrittleiste unter der Karte (MF/Admin): je Request Rang · Kurzname · Status-Badge · Frist; Buttons „Ersatz anfragen" (öffnet Personenauswahl → `rpc_create_substitute_request`), „Anfrage löschen". Spieler-Banner oben auf `/` und `/my-games`: „Du wurdest als Ersatz für <Spiel> angefragt — Frist <Datum>" mit Ja/Nein → `rpc_answer_substitute_request`. Statusfarben nach Tokens.
**Commit:** `Ersatzkette sichtbar und steuerbar`

### Aufgabe 5.5 — Spielverlegung

**Dateien:** neu `src/features/matches/{RescheduleDialog.tsx,RescheduleVotePanel.tsx}`, RPCs `rpc_start_reschedule_poll(match_id, options[])`, `rpc_vote_reschedule(poll_id, option_index, available)`, `rpc_close_reschedule_poll(poll_id)`, `rpc_apply_reschedule(poll_id, option_index)` (Migration), Trigger „alle abgestimmt → Initiator benachrichtigen", `syncPlanner` (Override-Verhalten bereits in 1.6), Tests, pgTAP `061_reschedule.test.sql`.
**Endzustand:** Dialog wörtlich nach Bestandsaufnahme C Spielverlegung (bis zu 3 Optionen, Button „Umfrage jetzt starten") → `reschedule_poll` an Kader mit `response ≠ no`. Spieler sehen auf der Karte ein Abstimmungspanel (je Option „kann/kann nicht"), auch per Link (`action='poll_vote'`). MF sieht Ergebnis-Matrix, schließt, wählt Termin → `dtstart_override`, `version+1`, `reschedule_confirmed`. Karte zeigt Badge „Verlegt (inoffiziell)" bis der Sync den Override bestätigt.
**Commit:** `Spielverlegung als Terminumfrage`

---

## Teil H — Phase 6: Training

### Aufgabe 6.1 — Schema Training

**Dateien:** Migration `<ts>_trainings.sql`; pgTAP `070_trainings_rls.test.sql`; `gen:types`.
**Endzustand:** Tabellen aus Zielbild 3.4 inkl. `holidays`. Helfer `trains(training_id)`. RLS: `trainings` SELECT aktive Mitglieder (Gast: nur `is_open` oder zugeordnet), Schreiben admin oder trains; `training_sessions` SELECT wie trainings, Schreiben Service Role/RPC; `training_attendance` eigene Zeile per RPC `rpc_set_training_attendance(session_id, status, guests)` (prüft Zuordnung oder `is_open`, `max_participants`, Sessionbeginn nicht vorbei), Trainer/Admin für andere; Inkognito: View `v_session_participants` liefert Liste nur für Trainer/Admin, Zähler für alle nur wenn nicht inkognito. `training_cancellations` Schreiben admin oder trains (bei `venue_id`: admin).
**Commit:** `Schema: Training`

### Aufgabe 6.2 — Feiertage und Schulferien

**Dateien:** neu `scripts/import-holidays.mjs`, `supabase/seed_holidays.sql` (generiert, eingecheckt), Migration `<ts>_holidays_seed.sql` (INSERT … ON CONFLICT DO NOTHING aus der generierten Datei), Tests für den Parser.
**Endzustand:** Skript lädt gesetzliche Feiertage (`https://feiertage-api.de/api/?jahr=YYYY`) und Schulferien (`https://ferien-api.de/api/v1/holidays/<BL>/<YYYY>`) für alle 16 Bundesländer für aktuelles + 2 Folgejahre und schreibt idempotentes SQL. `docs/betrieb.md`: jährlich im Herbst ausführen und Migration einchecken.
**Commit:** `Feiertage und Schulferien`

### Aufgabe 6.3 — Session-Erzeugung

**Dateien:** neu `supabase/functions/generate-training-sessions/index.ts`, `_shared/sessionPlanner.ts` (+Test), Migration `<ts>_cron_sessions.sql`.
**Endzustand:** `planSessions(training, holidays, cancellations, existing, from, to): { create[], cancel[], uncancel[] }` rein; Function täglich 03:00 UTC und per RPC-Aufruf nach Speichern eines Trainings (`pg_net`). Regeln Zielbild 4.4. Auto-Zusagen (6.7) setzen beim Erzeugen `attendance`.
**Tests:** wöchentlich/zweiwöchentlich/monatlich, Feiertag, Ferien, Ausfall je Training/Ort, bestehende Session bleibt.
**Commit:** `Trainings-Sessions erzeugen`

### Aufgabe 6.4 — Trainings verwalten

**Dateien:** neu `src/features/trainings/{TrainingsPage.tsx,TrainingDialog.tsx,AssignMembersDialog.tsx,CancellationsPage.tsx,CancellationDialog.tsx,api.ts,schemas.ts}`, Tests.
**Endzustand:** `/trainings` Tab „Planung" (Verwaltung): Tabelle Name | Zeitpunkt | Trainer | Mitglieder | Rhythmus | Aktiv (Schalter) | Aktion (Bearbeiten, Ausfälle, Löschen), Badges Typ / OFFENES TRAINING; Kopfbuttons „Training anlegen", „Mitglieder zuweisen", „Ausfall anlegen". Dialog mit **allen** Feldern aus Bestandsaufnahme E Objekt Training (`statistics_visibility` nur beim Bearbeiten). „Mitglieder zuweisen": Training | Mannschaft(en) | Gruppe(n) | Mitglied(er) | Checkbox „Bisherige überschreiben". Ausfälle: Tabelle Von | Bis | Grund | Aktion; Dialog ORT/TRAINING, VON, BIS, GRUND, Checkbox „per E-Mail direkt benachrichtigen" (→ `training_cancelled` mit `force_email`).
**Commit:** `Trainings verwalten`

### Aufgabe 6.5 — Trainingstermine und Teilnahme

**Dateien:** neu `src/features/trainings/{SessionsTab.tsx,SessionCard.tsx,OpenTrainingsList.tsx}`, `src/features/club/MyClubPage.tsx` (Tab Trainings), Tests.
**Endzustand:** Tab „Termine": Karten nach Zielbild 6.5 (Trainings-Karte) für die nächsten 14 Tage, dabei/später/nicht + Gäste → `rpc_set_training_attendance`; abgesagte Sessions grau mit Grund; Inkognito ohne Liste; Schlüssel-Hinweis (Warnung, wenn `requires_key_owner` und kein Zusagender Schlüsselinhaber — bis 9.1 immer Warnung unterdrückt). „Offene Trainings": Tabelle Name | Zeitpunkt | Rhythmus | Ort | Trainer | Teilnahme mit „Teilnehmen"/„Nicht mehr teilnehmen" (schreibt `training_members`).
**Commit:** `Trainingstermine und Teilnahme`

### Aufgabe 6.6 — Trainingserinnerung, Ausfall-Benachrichtigung, Auto-Absage

**Dateien:** `_shared/reminderPlanner.ts` (+ `planTrainingReminders`), `enqueue-reminders`, Migration `<ts>_training_notifications.sql` (Trigger: Ausfall → `training_cancelled`; Trigger: alle Trainer `no` → Session cancelled + Benachrichtigung), `open_participations` um Trainings erweitern, Tests, pgTAP.
**Endzustand:** `training_attendance_request` `reminder_hours` vor Session an zugeordnete (bzw. alle bei `is_open`) ohne Antwort, gefiltert nach `training_reminder_filter`; einmal je Session (`training_sessions.reminder_sent_at`).
**Commit:** `Trainingserinnerungen und Ausfaelle`

### Aufgabe 6.7 — Automatische Trainingszusagen [B]

**Dateien:** `src/features/profile/AutoAttendanceTab.tsx`, `sessionPlanner` (setzt Attendance), Tests.
**Endzustand:** Tabelle Training | Zusagen bis | Status | Aktion; Dialog TRAINING, AUTOMATISCH ZUSAGEN BIS, Checkbox „Komme später"; Hinweistext wörtlich aus Bestandsaufnahme E.
**Commit:** `Automatische Trainingszusagen`

---

## Teil I — Phase 7: Vereinstermine, Umfragen, Kalender

### Aufgabe 7.1 — Vereinstermine

**Dateien:** Migration `<ts>_events.sql` (Tabellen Zielbild 3.5, RPC `rpc_set_event_participation`, Trigger Einladung `event_invitation` an alle aktiven bei Insert, Erinnerung `event_reminder` `event_reminder_hours` vorher via `enqueue-reminders`), `src/features/events/*`, `MyClubPage` Tab Vereinstermine, Tests, pgTAP.
**Endzustand:** `/dates` Tabs Offene/Beendete, Filter Suche · Zeitraum; Dialog mit allen Feldern aus Bestandsaufnahme H Vereinstermine (Details als einfacher Rich-Text: fett/kursiv/Listen/Links — Editor `@tiptap/react` **statt** WYSIWYG mit Bild/Video/Tabelle; Dateianhänge erst mit 9.4). Teilnehmerliste, Anmeldefrist, max. Teilnehmer; Zusage/Absage + Gäste, auch per Link.
**Commit:** `Vereinstermine`

### Aufgabe 7.2 — Umfragen

**Dateien:** Migration `<ts>_polls.sql` (Zielbild 3.5; RPC `rpc_vote_poll(option_ids[])` prüft `max_answers`, Ziel-Zugehörigkeit, `expires_at`), `src/features/polls/*`, Tests, pgTAP.
**Endzustand:** `/votes`: Liste (offen/abgelaufen), Dialog mit allen Feldern aus Bestandsaufnahme H Umfragen; Abstimmung als Radio (max 1) oder Checkboxen; Typ „Personen" zeigt je Antwort die Namen; Ergebnis als Balken (ausgeblendet für Mitglieder bei `hide_results`, Organisator/Admin sehen immer).
**Commit:** `Umfragen`

### Aufgabe 7.3 — Kalender

**Dateien:** `package.json` (`@fullcalendar/react`, `daygrid`, `timegrid`, `list`, `core`), neu `src/features/calendar/{CalendarPage.tsx,PlanningTab.tsx,AbsencesTab.tsx,api.ts,events.ts}`, Migration `<ts>_v_calendar.sql` (View `v_calendar_items(kind, id, title, starts_at, ends_at, all_day, team_color, venue_id, is_home)` über Sessions ohne `hide_in_calendar`, Spiele, Vereinstermine ohne `exclude_calendar`, Geburtstage (ohne `hide_birthday`), Hallen-Ausfälle), Tests.
**Endzustand:** `/calendar` Tab „Planung": Monat/Woche/Liste, Kategorie-Chips mit Farben aus Tokens, Checkbox „Nur Heimspiele anzeigen", Klick öffnet Karte/Detail. Tab „Abwesenheiten" (admin/MF/Trainer): alle Abwesenheiten, Admin kann anlegen/bearbeiten/löschen. Dashboard-Tab Kalender nutzt dieselbe Komponente.
**Commit:** `Kalender`

### Aufgabe 7.4 — ICS-Abo pro Mitglied

**Dateien:** neu `supabase/functions/calendar-feed/index.ts`, Migration `<ts>_calendar_tokens.sql`, `src/features/calendar/SubscribeDialog.tsx`, Tests.
**Endzustand:** `GET <functions>/calendar-feed?token=<uuid>` liefert ICS mit zugesagten Spielen, Trainings (Zusage) und Vereinsterminen (Zusage) des Mitglieds; `X-WR-CALNAME` = Vereinsname; UIDs stabil; Cache 1 h. Dialog unter „Meine Termine": Link kopieren, Anleitungslinks (Google, Outlook, Apple), Button „Link neu erzeugen" (invalidiert alten).
**Commit:** `Kalender-Abo per ICS`

### Aufgabe 7.5 — Meine Termine

**Dateien:** neu `src/features/calendar/MyDatesPage.tsx`, Tests.
**Endzustand:** `/my-dates` Tabs „Zugesagte Termine" / „Abgesagte Termine" (Spiele, Trainings, Vereinstermine gemischt, chronologisch) + Button „Kalender abonnieren".
**Commit:** `Meine Termine`

---

## Teil J — Phase 8: Dashboard, PWA, Push, Admin

### Aufgabe 8.1 — Übersicht (Dashboard)

**Dateien:** neu `src/features/dashboard/{DashboardPage.tsx,CountdownTile.tsx,QuickLinks.tsx}`, Migration `<ts>_v_my_upcoming.sql`, Tests.
**Endzustand:** Zielbild-IA `/`: Countdown-Kachel „Mannschaftsspiele — n Tage bis zum nächsten Spiel" + Badge „n Spiele in den nächsten 30 Tagen"; Tabs Trainings (n) · Spiele (n) · Kalender · Schlüssel [9.1] · Offene Trainings (n) mit den bestehenden Karten; Quicklinks „Tabelle & Spielplan", „TTR-Rechner", „Vereinsrangliste" (URLs aus `club_settings.quicklinks_json`, Admin pflegt). **Zusatz** für MF/Admin: Kachel „Offene Rückmeldungen: n Spieler bei m Spielen".
**Commit:** `Uebersicht`

### Aufgabe 8.2 — PWA

**Dateien:** `package.json` (`vite-plugin-pwa`, Dev `sharp`), `vite.config.ts`, `src/sw.ts`, `public/icons/*`, `scripts/make-icons.mjs`, neu `src/features/notifications/MobileAppPage.tsx` (Route `/mobile-app`), Tests.
**Endzustand:** Manifest (`name` „Vereinsplaner", `display standalone`, `theme_color` teal-600), injectManifest-SW mit App-Shell-Precache und NetworkOnly für Supabase; installierbar (Lighthouse). `/mobile-app`: Anleitungen iOS/Android wörtlich nach Bestandsaufnahme J. Plugin nur bei `command === 'build'`.
**Commit:** `PWA`

### Aufgabe 8.3 — Web Push und Glocke

**Dateien:** `src/features/notifications/{BellButton.tsx,push.ts}` (+Test), `src/sw.ts` (push/notificationclick), `process-notifications` (Push-Kanal via `npm:web-push`, VAPID-Secrets, 404/410 → Subscription löschen), `Header.tsx`, `docs/betrieb.md`.
**Endzustand:** Glocke mit drei Zuständen und Button-IDs/Farben exakt Bestandsaufnahme B (aktivieren blau / aktiv grün / inaktiv rot); Klick → Permission → Subscribe → Upsert. Push-Text = `subject`, Body = erste 120 Zeichen, `data.url` = Link. `open_participations` und `match_reminder` erreichen das Gerät.
**Commit:** `Web Push und Benachrichtigungs-Glocke`

### Aufgabe 8.4 — Admin-Bereich und Betriebsdokumentation

**Dateien:** neu `src/features/admin/{AdminPage.tsx,SyncRunsPanel.tsx (aus 3.3 verschieben),NotificationsLogPanel.tsx,CronStatusPanel.tsx,SettingsPanel.tsx}`, Migration `<ts>_v_cron_status.sql` (View über `cron.job_run_details`, nur admin), `docs/betrieb.md` (vollständig), `docs/einrichtung.md` (neu, v2), Tests.
**Endzustand:** `/club` Tab „Betrieb" (admin): letzte Sync-Läufe, Benachrichtigungen mit `failed`/`skipped` (Retry-Button → `status=pending`), Cron-Jobs mit letztem Lauf/Status, Einstellungen (`open_reminder_*`, `event_reminder_hours`, Absender, App-URL, Quicklinks). `docs/einrichtung.md`: Setup von null (Supabase, Resend, VAPID, Secrets, Cron-Config, erster Admin per SQL). `docs/betrieb.md`: Routinen, Fehlerbilder, Backup (Supabase-Backups + wöchentlicher `pg_dump` per Action in privates Artefakt).
**Commit:** `Admin-Bereich und Betriebsdokumentation`

---

## Teil K — Phase 9: Stufe B

Jede Aufgabe eigenständig; Reihenfolge frei nach Nutzen. Kurzform, gleiche Ansprüche an Endzustand/Tests.

| # | Aufgabe | Endzustand (Kurz) | Commit |
|---|---|---|---|
| 9.1 | Schlüsselverwaltung | Tabellen `keys`, `key_handovers`; `/venues` Abschnitt Schlüssel mit Feldern aus Bestandsaufnahme F; Dashboard-Tab „Schlüssel" mit Übergabe (nur aktueller Inhaber, nicht bei `no_forwarding`); Spalte Schlüssel in Vereinsübersicht; Trainings-Schlüsselwarnung aktiv | `Schluesselverwaltung` |
| 9.2 | Nachrichten am Termin | `object_messages`; Thread-Panel auf Spiel-/Trainings-/Terminkarte („Nachrichten (n)"); Notification `object_message` an Beteiligte | `Nachrichten am Termin` |
| 9.3 | Vereinsneuigkeiten | `news`; `/club` Tab Neuigkeiten (anlegen, organizer/admin), `/my-club` Tab Neuigkeiten; keine Benachrichtigung (wie TT-Planer) | `Vereinsneuigkeiten` |
| 9.4 | Dateien | Supabase Storage Bucket `club-files` (privat), Tabelle `files`, Upload/Download in `/club` und `/my-club`, Anhänge an Vereinsterminen | `Dateien` |
| 9.5 | Excel-Import/-Update | `xlsx`-Paket; Vorlage herunterladen, Import (Spalten wie Bestandsaufnahme G), Update (Export → Bearbeiten → Upload); neue Mitglieder erhalten Einladung | `Excel-Import und -Update der Mitglieder` |
| 9.6 | Ämter (Vereinsrollen) | `club_roles`, `club_role_members`; `/club` Tab Ämter mit Name, Beschreibung, Tätigkeiten (ohne Inventar-/Bekleidung-Checkboxen — beide Module sind gestrichen); Zuweisung im Ämter-Dialog; `/my-club` Rollen & Kontaktdaten zeigt Ämter | `Aemter` |
| 9.7 | NuScore Codes & PINs Import | PDF-Parser (`pdfjs-dist`) für die click-TT-PDFs; Dialog Einzeln/Mehrfach wie Bestandsaufnahme D; Code/PIN auf der Karte für Aufstellung sichtbar | `NuScore Codes und PINs` |
| ~~9.8~~ | ~~Arbeitszeiten~~ | **Gestrichen** (Vereinsentscheidung 17.09.2026). Nummer bleibt vergeben, damit Verweise stabil bleiben. | — |
| 9.9 | Statistik Trainingsbeteiligung | `/statistics`: Widget je Training (Zusagen/Absagen/Abwesenheiten, Zeitraum, CSV) + Top 10 (12 Monate), Sichtbarkeit nach `statistics_visibility` | `Trainingsstatistik` |
| 9.10 | Anmelden als (Eltern) | `login_delegations`; Profilmenü „Anmelden als …"; Sitzung wechselt Profil-Kontext (RPC-seitig `acting_profile_id` im JWT-Claim via Custom Claims Hook) | `Anmelden als` |
| 9.11 | Dark Mode | `dark:`-Varianten der Tokens, Umschalter im Profil | `Dark Mode` |

---

## Teil L — Phase 10: Go-live

| # | Aufgabe | Endzustand |
|---|---|---|
| 10.1 | Datenschutz-Unterlagen | `docs/datenschutz/{verarbeitungsverzeichnis.md, av-supabase.md, av-resend.md, datenschutzhinweis.md, loeschkonzept.md}`; Datenschutzhinweis in der App verlinkt (Fußzeile, Registrierung) |
| 10.2 | Datenübernahme aus TT-Planer | Mitglieder-Excel des TT-Planers (Reiter Update) → Import 9.5 mit Spalten-Mapping-Doku; Mannschaften/Kader/Webcal-URLs manuell; Checkliste in `docs/migration.md` |
| 10.3 | Parallelbetrieb | 4 Wochen beide Systeme; Checkliste je Zielkriterium Z1–Z11 mit Datum und Prüfer; Feedback-Formular (Umfrage in der App selbst) |
| 10.4 | Kündigung und Abschluss | Kündigung TT-Planer fristgerecht; Lizenzfrage `NOTICE.md` geklärt (nur noch `_shared/ics.ts`, `homeAway.ts`, `lineupOrder.ts`, `names.ts` stammen aus dem Upstream — im Zweifel neu schreiben, das sind < 300 Zeilen); Release-Tag `v1.0.0` |

---

## Teil M — Releases und Abhängigkeiten

```
Release 0 „Fundament"      Phase 0–1           → Login, Navigation, Mitglieder leer
Release 1 „Verein"         Phase 2             → Mitglieder, Gruppen, Orte, Profil, Abwesenheiten
Release 2 „Spieltag"       Phase 3 + 4 + 5     → ersetzt die Champion-only-Funktionen (Kündigungs-Vorbedingung)
Release 3 „Training"       Phase 6             → ersetzt Starter-Funktionen Training
Release 4 „Vereinsleben"   Phase 7 + 8         → Termine, Umfragen, Kalender, Dashboard, PWA, Push
Release 5 „Komfort"        Phase 9 (Auswahl)
Go-live                    Phase 10
```

Abhängigkeiten: 3.x vor 4.4 (Trigger brauchen Tabellen) · 4.1/4.2 vor 5.3 (Anfragen müssen versendet werden) · 4.6 vor 5.4 (Links) · 6.1 vor 4.3-Trainingsfilter-Nutzung · 7.3 nach 6.x und 7.1 (Kalenderquellen) · 8.3 nach 4.2 · 9.1 vor Aktivierung der Schlüsselwarnung in 6.5.

Hinweis zur Reihenfolge Push vs. E-Mail: Bis 8.3 gehen alle Benachrichtigungen nur per E-Mail. Das ist
für Release 2 akzeptabel, wenn die Mitglieder-E-Mails gepflegt sind. Wer Push früher will, zieht 8.2/8.3
direkt hinter 4.2.

---

## Teil N — Status

Vom ausführenden Agenten gepflegt.

| Aufgabe | Status | Datum | Anmerkung |
|---|---|---|---|
| 0.1 Repository und Werkzeuge | erledigt | 17.09.2026 | |
| 0.2 Lokale Test-Datenbank | erledigt | 17.09.2026 | native PostgreSQL 16 statt Docker; scripts/local-db.sh, supabase-compat.sql |
| 0.3 Cloud-Projekt | zurückgestellt | — | kein Supabase-Projekt vorhanden; spätestens vor 4.2 nötig |
| 0.4 Umgebungsvariablen | erledigt | 17.09.2026 | `VITE_SYNC_SECRET` entfällt, `VITE_APP_URL` und `VITE_VAPID_PUBLIC_KEY` neu |
| 0.6 Geerbte Workflows | erledigt | 17.09.2026 | auto-version-badges und sync-calendars entfernt |
| 1.1 Router, Layout, Navigation | erledigt | 17.09.2026 | |
| 1.2 Design-System | erledigt | 17.09.2026 | 26 Primitives, Playground unter /_design |
| 1.3 Schema-Baseline v2 | erledigt | 17.09.2026 | eingefroren; eigener Typgenerator statt `supabase gen types` |
| 1.4 Authentifizierung | erledigt | 17.09.2026 | Magic Link mit `shouldCreateUser: false`, Registrierung per Vereinscode |
| 1.5 Datenzugriffsschicht | erledigt | 17.09.2026 | queryKeys, labels, dates, features/members/api.ts als Vorlage |
| 1.6 Geteilte Logik übernommen | erledigt | 17.09.2026 | `lineupText` blieb dabei, `_shared` statt Duplikat in der Edge Function |
| 1.7 Altcode entfernt | erledigt | 17.09.2026 | vorgezogen: der typisierte Client hat die Altlasten erzwungen |
| 1.8 CI/CD | erledigt | 17.09.2026 | ci.yml mit App- und Datenbank-Job; Deploys vorerst nur manuell |
| 1.9 Baseline eingefroren | erledigt | 17.09.2026 | |
| 2.1 Mein Profil und Abwesenheiten | erledigt | 17.09.2026 | Tabelle `absences` + View `v_absences`; `rpc_delete_my_account` als Soft-Delete |
| 2.2 Mitgliederverwaltung | erledigt | 17.09.2026 | `rpc_activate_member`, `rpc_update_qttr_bulk`; Filter als reine Funktion `filterMembers` |
| 2.3 Einladung und Registrierung | erledigt | 17.09.2026 | Edge Function `invite-member`; Registrierungslink mit QR-Code; neues Primitive `Menu` |
| 2.4 Gruppen | erledigt | 17.09.2026 | Tab „Gruppen" mit Anlegen, Umbenennen, Zuweisen |
| 2.5 Vereinsdaten und Orte | erledigt | 17.09.2026 | Bundesland als eigenes Feld (16 Länder), Orte mit Stilllegen statt Löschen |
| 2.6 Mein Verein | erledigt | 17.09.2026 | Verzeichnis aus `v_members_directory`, Ansprechpartner, Vereinstext |
| 3.1 Schema Mannschaften und Spiele | erledigt | 17.09.2026 | `v_match_lineup_status` vorgezogen; `rpc_unlock_lineup` ergänzt |
| 3.2 Mannschaften und Kader | erledigt | 17.09.2026 | Ligen als Freitext statt Katalog; Frist der Ersatzkette als eigenes Feld |
| 3.3 ICS-Import und Kalender-Sync | erledigt | 17.09.2026 | `sync-calendars`, Cron-Migration mit Prüfung auf pg_cron/pg_net, `docs/betrieb.md` |
| 3.4 Spieltermine: Liste, Filter, Bearbeitung | erledigt | 17.09.2026 | Filter als reine Funktion `filterMatches` |
| 3.5 Spielkarte, Rückmeldung, Fahrdienst | erledigt | 17.09.2026 | Warnbanner bei veralteter Fassung; Bemerkung als Popover |
| 3.6 Aufstellung und „Spieler verwalten" | erledigt | 17.09.2026 | Einteilung als reine Funktion `groupParticipations`; Ersatzanfragen erst in Phase 5 |
| 3.7 Aufstellung teilen | erledigt | 17.09.2026 | E-Mail-Versand sichtbar deaktiviert bis 4.4 |
| 3.8 Mein Verein: Mannschaften und Spiele | erledigt | 17.09.2026 | |
| 4.1 Schema Benachrichtigungen | erledigt | 17.09.2026 | 19 Vorlagen (15 in der Matrix, 4 Direkt-E-Mails); `v_my_notification_preferences` ergänzt |
| 4.2 E-Mail-Versand | erledigt | 17.09.2026 | Zustandslogik als reine Funktion; Push wird bis 8.3 als „übersprungen" markiert |
| 4.3 Einstellungs-Matrix | erledigt | 17.09.2026 | Tabelle ab sm, Liste darunter |
| 4.4 Ereignisgesteuerte Benachrichtigungen | erledigt | 17.09.2026 | `rpc_share_lineup` ergänzt; Spiele in der Vergangenheit lösen nichts aus |
| 4.5 Erinnerungen | erledigt | 17.09.2026 | `reminderPlanner` als reine Funktion; Fangfenster sechs Stunden |
| 4.6 Antwort-Links ohne Login | erledigt | 17.09.2026 | `rpc_describe_action_token` ergänzt, damit die Seite fragen kann statt blind zu handeln |
| 5.1 Schema Ersatzanfragen und Verlegung | erledigt | 17.09.2026 | `apply_substitute_answer` getrennt, damit Oberfläche und Link denselben Weg nehmen |
| 5.2 Planungslogik der Ersatzkette | erledigt | 17.09.2026 | 28 Tests |
| 5.3 Edge Function substitute-engine | erledigt | 17.09.2026 | Sofort-Anstoß als Trigger auf `match_participations` statt in den RPCs |
| 5.4 Ersatzkette in der Oberfläche | erledigt | 17.09.2026 | Schrittleiste im Dialog, Banner unter „Meine Spiele" |
| 5.5 Spielverlegung | erledigt | 17.09.2026 | Ergebnisansicht `v_reschedule_results`; Umfrage schließt sich selbst, wenn alle abgestimmt haben |
| 6.1 – 6.7 Training | offen | | |
| 7.1 – 7.5 Termine, Umfragen, Kalender | offen | | |
| 8.1 – 8.4 Dashboard, PWA, Push, Admin | offen | | |
| 9.x Stufe B | offen | | 9.8 Arbeitszeiten gestrichen |
| 10.x Go-live | offen | | |

### Abweichungen vom Plan, die sich beim Bauen ergeben haben

1. **Keine Docker-Umgebung.** Aufgabe 0.2 nutzt eine native PostgreSQL-Instanz mit einer
   Supabase-Kompatibilitätsschicht. Dieselben Migrationen und Tests laufen unverändert gegen
   eine echte Supabase-Instanz.
2. **Eigener Typgenerator.** `supabase gen types` startet einen Container. `scripts/gen-types.mjs`
   liest denselben Katalog über `psql`. Objekte aus Extensions bleiben draußen, damit die
   Ausgabe lokal und in Supabase identisch ist.
3. **1.7 vorgezogen.** Sobald der Supabase-Client typisiert war, fielen 290 Typfehler in den
   Altkomponenten an — Tabellen, die es im neuen Schema nicht mehr gibt. Der Altcode musste
   deshalb zusammen mit 1.4 verschwinden.
4. **`current_role()` heißt `current_member_role()`.** `current_role` ist in SQL bereits ein
   Schlüsselwort für die aktuelle Datenbankrolle.
5. **`lineupText` schon in 1.6.** Die Funktion braucht keine Datenbanktypen, nur ihre eigenen
   Eingabefelder — damit ist sie vollständig testbar, bevor es Mannschaften gibt.
6. **Deploy-Workflows vorerst manuell.** Ohne Supabase-Projekt und Secrets würden sie bei jedem
   Push scheitern und die CI-Anzeige unbrauchbar machen.
7. **Kontolöschung als Soft-Delete mit geschütztem `deleted_at`.** Beim Bauen von 2.1 fiel auf,
   dass ein gelöschtes Profil sich selbst hätte wiederbeleben können. Der Trigger
   `protect_profile_columns()` lässt `deleted_at` jetzt nur noch von NULL auf einen Zeitpunkt
   setzen, nie zurück. Der letzte Administrator kann sich nicht löschen.
8. **`profiles_select` um den Admin erweitert (2.2).** Der Admin konnte niemanden löschen:
   PostgreSQL prüft beim UPDATE auch die SELECT-Policy gegen die neue Zeile, und die verlangte
   für fremde Zeilen `deleted_at IS NULL`. Siehe `docs/datenbank.md`.
9. **Neues Primitive `Menu` (2.3).** Der Plan verlangt ein Aufklappmenü „Mitglieder
   hinzufügen". Im Design-System aus 1.2 gab es keins; es steht jetzt als `Menu` bereit und
   wird in Phase 3 für die Zeilenaktionen der Spieltermine wiederverwendet.
10. **QTTR-Massenpflege als eigene Datenbankfunktion.** Der Plan sah dafür nur einen Dialog vor.
    Dreißig einzelne Aufrufe wären dreißig Anfragen; `rpc_update_qttr_bulk` macht daraus eine.
11. **Vereinstext wird als Text angezeigt, nicht als HTML (2.5/2.6).** Der TT-Planer hat dort
    einen WYSIWYG-Editor. Fremdes Markup ungeprüft einzuhängen wäre eine offene Tür für
    Skripte; ein Editor mit Bereinigung kommt in Phase 9. Bis dahin bleibt der Absatz Text.
12. **Orte werden stillgelegt, nicht gelöscht (2.5).** An einem Ort hängen vergangene Spiele
    und Trainings. Ein inaktiver Ort verschwindet aus den Auswahllisten, bleibt aber an den
    Terminen sichtbar.
13. **`v_match_lineup_status` schon in 3.1 statt erst in 3.6.** Die View gehört zum Schema und
    kostet dort drei Zeilen; in 3.6 hätte sie eine eigene Migration gebraucht. Ihre pgTAP-Tests
    laufen damit von Anfang an mit.
14. **`rpc_unlock_lineup` ergänzt.** Der Plan nennt in 3.6 den Button „Automatik wiederherstellen",
    aber keine Funktion dafür. Das Zurücksetzen von `lineup_locked` per UPDATE zu erlauben hätte
    bedeutet, dass die Oberfläche eine Regel kennt, die in der Datenbank steht.
15. **Reihenfolge der Ersatzspieler in der Aufstellung.** Beim Testen fiel auf, dass ein
    Vereinsrang die Ersatzreihenfolge aushebeln kann. `recompute_lineup` sortiert Stammspieler
    jetzt nach Vereinsrang, Ersatzspieler nach Ersatzrang — getrennt, nicht gemischt.
16. **Ligen als Freitext (3.2).** Der TT-Planer pflegt einen Katalog mit 1.657 Ligen. Ein
    eigener Katalog wäre am ersten Tag veraltet und für einen Verein ohnehin sinnlos — er
    braucht drei Einträge. Die Ligen sind deshalb ein kommagetrenntes Textfeld.
17. **Frist der Ersatzkette als Feld an der Mannschaft (3.2).** Im TT-Planer ist die Wartezeit
    unsichtbar; die Bestandsaufnahme konnte sie nicht ermitteln. Statt sie zu raten und fest zu
    verdrahten, steht sie als `substitute_timeout_hours` am Team.
18. **Cron-Migration mit Prüfung auf die Erweiterungen (3.3).** pg_cron und pg_net gibt es in
    Supabase, aber nicht in der lokalen Testdatenbank und nicht im CI-Container. Die Migration
    prüft und meldet, statt zu scheitern — dieselbe Datei läuft überall.
19. **„Codes & PINs Import" aus PDF nicht gebaut.** Der Plan nennt den Kopfbutton, die
    Bestandsaufnahme beschreibt zwei PDF-Uploads. Code und PIN lassen sich am Spieltermin
    eintippen; ein PDF-Parser für zwei Zahlen wäre viel Aufwand für wenig Ertrag. Falls es
    doch gebraucht wird, gehört es in Phase 9.
20. **Einteilung der Spieler doppelt (3.6).** `v_match_lineup_status` in der Datenbank und
    `groupParticipations` im Browser berechnen dasselbe. Die Oberfläche braucht die Einteilung
    zusammen mit Namen und Reihenfolge; ein zweiter Rundtrip dafür wäre teurer als die
    doppelte Regel. Beide sind getestet, die Datenbank bleibt maßgeblich.
21. **`rpc_share_lineup` und `rpc_describe_action_token` ergänzt (4.4/4.6).** Der Plan nennt
    den Knopf „Per E-Mail an Aufstellung senden" und die Seite `/r/:token`, aber keine
    Funktionen dafür. Beide Male wäre die Alternative gewesen, die Regel in die Oberfläche zu
    legen — beim Versand die Empfängerauswahl, beim Token das Verbrauchen vor dem Anzeigen.
22. **Kein Auslöser für Spiele in der Vergangenheit.** Beim ersten Import einer laufenden
    Saison kämen sonst dutzende Einladungen zu Spielen, die längst gespielt sind.
23. **Sofort-Anstoß der Ersatzkette als Trigger (5.3).** Der Plan wollte den Aufruf in
    `rpc_set_match_response` und `rpc_manage_player`. Als Trigger auf `match_participations`
    erwischt er auch die Absage über den Link aus der E-Mail — die geht durch keine der beiden
    Funktionen.
24. **Die leere Kette wird gemeldet.** Der TT-Planer hat diese Nachricht nicht; dort erfährt
    der Mannschaftsführer nicht, dass alle Ersatzspieler abgesagt haben. Genau dann muss er
    aber handeln, und zwar bevor Samstag ist.

**Blocker:** —

**Fragen an den Planer:** —
