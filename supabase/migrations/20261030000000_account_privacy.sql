-- ============================================================================
-- Konten und Datenschutz (Code-Review K-2, H-1, N-1, N-2, N-9, M-3, M-4)
--
--   1. berlin_today(): „heute" in deutscher Zeit statt UTC
--   2. handle_new_user(): ein vorhandenes Profil nur nach Nachweis der Adresse
--      übernehmen (Einladung oder bestätigte E-Mail)
--   3. profiles.email folgt der Anmeldeadresse
--   4. Spaltenschutz: Mitglieder ändern E-Mail und Verwaltungsspalten nicht selbst
--   5. Spaltenrechte: Kontaktdaten sind nicht mehr über die Tabelle lesbar
--   6. Verzeichnis, Geburtstage und Kalender lesen über Sichten des Eigentümers
--   7. Rollen-Helfer und Selbstlöschung beachten den Status
--   8. Push-Endpunkte und Kopie-Adressen werden geprüft
--   9. Der Löschlauf entfernt auch den Auth-Benutzer
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Heute in Berlin
--
-- Die Datenbank läuft in UTC. CURRENT_DATE ist deshalb zwischen Mitternacht und
-- ein bzw. zwei Uhr deutscher Zeit noch „gestern" — Anmeldefristen blieben eine
-- Stunde zu lange offen.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.berlin_today()
RETURNS DATE
LANGUAGE sql STABLE
AS $$
    SELECT (NOW() AT TIME ZONE 'Europe/Berlin')::date;
$$;

-- ----------------------------------------------------------------------------
-- 2. Anmeldung: vorhandenes Profil nur mit Nachweis übernehmen
--
-- Der Trigger läuft beim Anlegen des Auth-Benutzers, also vor der Bestätigung der
-- E-Mail. Bisher genügte die Adresse eines angelegten Mitglieds, um dessen Profil
-- (samt Rolle) an ein selbst angelegtes Konto zu binden. Die echte Person hätte das
-- Konto später per Magic Link bestätigt — und der Angreifer kannte das Passwort.
--
-- Jetzt gilt: Übernommen wird nur, wenn der Auth-Dienst die Adresse belegt hat —
-- per Einladung (invited_at) oder Bestätigung (email_confirmed_at).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_id       UUID;
    v_first_name        TEXT;
    v_last_name         TEXT;
    v_supplied_code     TEXT;
    v_registration_code TEXT;
BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data ->> 'first_name', '');
    v_last_name  := COALESCE(NEW.raw_user_meta_data ->> 'last_name', '');

    -- a) Vorhandenes, noch nicht verknüpftes Profil mit gleicher E-Mail.
    SELECT id INTO v_existing_id
      FROM public.profiles
     WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
       AND auth_linked_at IS NULL
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        IF NEW.invited_at IS NULL AND NEW.email_confirmed_at IS NULL THEN
            RAISE EXCEPTION
                'Für diese E-Mail-Adresse gibt es bereits ein Mitgliedsprofil. Bitte beim Administrator eine Einladung anfordern.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;

        UPDATE public.profiles
           SET id = NEW.id,
               auth_linked_at = NOW(),
               status = CASE WHEN status = 'unconfirmed' THEN 'active' ELSE status END,
               first_name = CASE WHEN first_name = '' THEN v_first_name ELSE first_name END,
               last_name  = CASE WHEN last_name  = '' THEN v_last_name  ELSE last_name  END
         WHERE id = v_existing_id;

        RETURN NEW;
    END IF;

    -- b) Selbstregistrierung: nur mit gültigem Vereinscode.
    v_supplied_code := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'registration_code', '')), '');
    SELECT NULLIF(TRIM(value), '') INTO v_registration_code
      FROM public.club_settings WHERE key = 'registration_code';

    IF v_registration_code IS NULL OR v_supplied_code IS DISTINCT FROM v_registration_code THEN
        RAISE EXCEPTION
            'Diese E-Mail-Adresse ist im Verein nicht bekannt. Bitte den Registrierungslink des Vereins nutzen oder beim Administrator melden.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.profiles (id, first_name, last_name, email, status, role, auth_linked_at)
    VALUES (NEW.id, v_first_name, v_last_name, NEW.email, 'pending_approval', 'member', NOW());

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. profiles.email folgt der Anmeldeadresse
--
-- Ändert jemand seine Adresse über den Auth-Dienst (mit Bestätigung), zieht das
-- Profil nach. Umgekehrt ändert ein Mitglied profiles.email nicht mehr selbst
-- (Abschnitt 4) — sonst gingen Benachrichtigungen an eine Adresse, mit der man
-- sich gar nicht anmeldet.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
        UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- ----------------------------------------------------------------------------
-- 4. Spaltenschutz
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;   -- Migrationen, Auth-Dienst und Edge Functions mit service_role
    END IF;

    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.qttr IS DISTINCT FROM OLD.qttr
       OR NEW.member_number IS DISTINCT FROM OLD.member_number
       OR NEW.no_games IS DISTINCT FROM OLD.no_games
    THEN
        RAISE EXCEPTION
            'Rolle, Status, QTTR, Mitgliedsnummer und die Kennzeichnung als Mannschaftsspieler darf nur ein Administrator ändern.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION
            'Die E-Mail-Adresse änderst du über „Anmeldeadresse ändern" – sie muss bestätigt werden.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.auth_linked_at IS DISTINCT FROM OLD.auth_linked_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'Diese Angaben verwaltet die Anwendung selbst.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Selbstlöschung ist erlaubt, das Zurücknehmen nicht.
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       AND NOT (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    THEN
        RAISE EXCEPTION 'Ein gelöschtes Konto kann nur ein Administrator wiederherstellen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Spaltenrechte auf profiles
--
-- Die Sichtbarkeit von E-Mail, Telefon und Geburtstag (contact_visible,
-- hide_birthday) setzte bisher nur die View v_members_directory um — die Tabelle
-- selbst gab jedem aktiven Mitglied alle Spalten her. Jetzt sind die persönlichen
-- Spalten über die Tabelle nicht mehr lesbar. Wer sie braucht, bekommt sie auf
-- einem der drei Wege unten: das eigene Profil, das Verzeichnis (mit Freigabe),
-- die Mitgliederverwaltung (nur Admin).
-- ----------------------------------------------------------------------------

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
    id, first_name, last_name, full_name, gender, member_number, role, status,
    no_games, qttr, contact_visible, hide_birthday, auth_linked_at, deleted_at,
    created_at, updated_at
) ON public.profiles TO authenticated;

-- Das eigene Profil, vollständig.
CREATE OR REPLACE FUNCTION public.rpc_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

-- Alle Profile, vollständig — für die Mitgliederverwaltung.
CREATE OR REPLACE FUNCTION public.rpc_admin_members()
RETURNS SETOF public.profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Nur Administratoren sehen die vollständigen Mitgliederdaten.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY SELECT * FROM public.profiles;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_my_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_admin_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_members() TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Sichten mit den Rechten des Eigentümers
--
-- Ohne Spaltenrecht kann eine security_invoker-Sicht die Kontaktspalten nicht mehr
-- lesen. Diese Sichten laufen deshalb als Eigentümer und tragen die Zeilenregel von
-- profiles_select selbst im WHERE. security_barrier verhindert, dass ein Filter des
-- Aufrufers vor dieser Regel ausgewertet wird.
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.v_members_directory;
CREATE VIEW public.v_members_directory
WITH (security_barrier = true) AS
SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.full_name,
    p.role,
    p.status,
    p.no_games,
    p.qttr,
    CASE WHEN p.contact_visible OR public.is_admin() OR p.id = auth.uid()
         THEN p.email END AS email,
    CASE WHEN p.contact_visible OR public.is_admin() OR p.id = auth.uid()
         THEN p.phone END AS phone,
    CASE WHEN p.contact_visible OR public.is_admin() OR p.id = auth.uid()
         THEN p.mobile_phone END AS mobile_phone,
    CASE WHEN NOT p.hide_birthday OR public.is_admin() OR p.id = auth.uid()
         THEN p.birthday END AS birthday
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND (
      p.id = auth.uid()
      OR public.is_admin()
      OR (
          public.is_active_member()
          AND (public.current_member_role() <> 'guest' OR p.role IN ('admin', 'trainer'))
      )
  );

REVOKE ALL ON public.v_members_directory FROM anon;
GRANT SELECT ON public.v_members_directory TO authenticated;

-- Geburtstage für den Kalender: nur freigegebene, nur für Mitglieder, die das
-- Verzeichnis auch sonst sehen dürften.
CREATE OR REPLACE VIEW public.v_birthdays
WITH (security_barrier = true) AS
SELECT
    p.id,
    p.full_name,
    p.birthday
FROM public.profiles p
WHERE p.birthday IS NOT NULL
  AND NOT p.hide_birthday
  AND p.deleted_at IS NULL
  AND p.status = 'active'
  AND public.is_active_member()
  AND (public.current_member_role() <> 'guest' OR p.role IN ('admin', 'trainer'));

REVOKE ALL ON public.v_birthdays FROM anon;
GRANT SELECT ON public.v_birthdays TO authenticated;

CREATE OR REPLACE VIEW public.v_calendar_items
WITH (security_invoker = true) AS

-- Trainingstermine
SELECT
    'training'::TEXT AS kind,
    s.id             AS id,
    t.name           AS title,
    s.starts_at      AS starts_at,
    COALESCE(s.ends_at, s.starts_at + INTERVAL '2 hours') AS ends_at,
    false            AS all_day,
    NULL::TEXT       AS color,
    t.venue_id       AS venue_id,
    NULL::BOOLEAN    AS is_home,
    s.cancelled      AS cancelled
FROM public.training_sessions s
JOIN public.trainings t ON t.id = s.training_id
WHERE NOT t.hide_in_calendar

UNION ALL

-- Spieltermine, in der Farbe ihrer Mannschaft
SELECT
    'match'::TEXT,
    m.id,
    tm.name || ' – ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt'),
    m.dtstart,
    COALESCE(m.dtend, m.dtstart + INTERVAL '4 hours'),
    false,
    tm.color,
    m.venue_id,
    m.is_home,
    NOT m.active
FROM public.matches m
JOIN public.teams tm ON tm.id = m.team_id

UNION ALL

-- Vereinstermine
SELECT
    'event'::TEXT,
    e.id,
    e.name,
    e.starts_at,
    COALESCE(e.ends_at, e.starts_at + INTERVAL '2 hours'),
    e.full_day,
    NULL,
    NULL,
    NULL,
    false
FROM public.club_events e
WHERE NOT e.exclude_calendar

UNION ALL

-- Geburtstage: der nächste Jahrestag ab heute. Gelesen über v_birthdays, weil der
-- Aufrufer die Spalte birthday in profiles nicht mehr lesen darf.
SELECT
    'birthday'::TEXT,
    b.id,
    b.full_name,
    next_birthday::timestamptz,
    next_birthday::timestamptz,
    true,
    NULL,
    NULL,
    NULL,
    false
FROM public.v_birthdays b
CROSS JOIN LATERAL (
    SELECT (
        b.birthday
        + ((EXTRACT(YEAR FROM public.berlin_today()) - EXTRACT(YEAR FROM b.birthday))::int
           + CASE
               WHEN (b.birthday + ((EXTRACT(YEAR FROM public.berlin_today())
                                    - EXTRACT(YEAR FROM b.birthday))::int
                                   * INTERVAL '1 year')) < public.berlin_today()
               THEN 1 ELSE 0
             END) * INTERVAL '1 year'
    ) AS next_birthday
) n

UNION ALL

-- Gesperrte Hallen: ganztägig, über den ganzen Zeitraum
SELECT
    'venue_blocked'::TEXT,
    c.id,
    COALESCE(v.name, 'Halle') || ' nicht verfügbar'
        || CASE WHEN c.reason <> '' THEN ' (' || c.reason || ')' ELSE '' END,
    c.from_date::timestamptz,
    (c.to_date + 1)::timestamptz,
    true,
    NULL,
    c.venue_id,
    NULL,
    false
FROM public.training_cancellations c
LEFT JOIN public.venues v ON v.id = c.venue_id
WHERE c.venue_id IS NOT NULL;

REVOKE ALL ON public.v_calendar_items FROM anon;
GRANT SELECT ON public.v_calendar_items TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. Rollen-Helfer und Selbstlöschung beachten den Status
--
-- current_member_role() lieferte die Rolle auch für Konten, die auf Freischaltung
-- warten. Policies wie trainings_insert oder sync_runs_select prüften damit nur die
-- Rolle, nicht, ob das Konto aktiv ist.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_member_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.profiles
     WHERE id = auth.uid() AND deleted_at IS NULL AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_my_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_last_admin BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Gezählt werden nur Administratoren, die sich tatsächlich anmelden können.
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND role = 'admin'
    ) AND (
        SELECT count(*) FROM public.profiles
         WHERE role = 'admin' AND deleted_at IS NULL AND status = 'active'
    ) <= 1
    INTO v_is_last_admin;

    IF v_is_last_admin THEN
        RAISE EXCEPTION
            'Du bist der letzte Administrator. Bitte zuerst jemand anderen zum Administrator machen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE public.profiles
       SET deleted_at = NOW()
     WHERE id = auth.uid();
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Push-Endpunkte und Kopie-Adressen prüfen
--
-- push_subscriptions schreibt jedes Mitglied selbst. Ohne Prüfung schickte der
-- Versandlauf POST-Anfragen an jede eingetragene Adresse. Die Liste deckt die
-- Push-Dienste von Chrome/Edge/Opera/Samsung (FCM), Firefox, Windows und Apple ab.
--
-- emails_copies bekommt jede Benachrichtigung in Kopie. Ohne Obergrenze ließe sich
-- der Vereinsversand als Verteiler missbrauchen.
--
-- NOT VALID: Bestehende Zeilen bleiben unangetastet, geprüft wird ab jetzt.
-- ----------------------------------------------------------------------------

ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_known;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_known CHECK (
    endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/'
) NOT VALID;

CREATE OR REPLACE FUNCTION public.valid_email_list(p_list TEXT[])
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
    SELECT COALESCE(bool_and(entry ~* '^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$'), true)
      FROM unnest(p_list) AS entry;
$$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_emails_copies_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_emails_copies_check CHECK (
    cardinality(emails_copies) <= 3 AND public.valid_email_list(emails_copies)
) NOT VALID;

-- ----------------------------------------------------------------------------
-- 9. Der Löschlauf entfernt auch den Auth-Benutzer
--
-- Bisher verschwand nach der Frist nur die Zeile in profiles. E-Mail-Adresse,
-- Passwort-Hash und Anmeldedaten blieben in auth.users stehen, und die Person
-- konnte sich weiter anmelden.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_retention()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_profiles      INTEGER := 0;
    v_auth_users    INTEGER := 0;
    v_notifications INTEGER := 0;
    v_tokens        INTEGER := 0;
    v_logs          INTEGER := 0;
    v_absences      INTEGER := 0;
BEGIN
    -- --- Gelöschte Konten endgültig entfernen -------------------------------
    WITH gone AS (
        DELETE FROM public.profiles
         WHERE deleted_at IS NOT NULL
           AND deleted_at < NOW()
             - (public.retention_days('retention_deleted_profiles_days', 30) || ' days')::INTERVAL
        RETURNING id
    ),
    gone_auth AS (
        DELETE FROM auth.users WHERE id IN (SELECT id FROM gone) RETURNING id
    )
    SELECT (SELECT count(*) FROM gone), (SELECT count(*) FROM gone_auth)
      INTO v_profiles, v_auth_users;

    -- --- Postfach -----------------------------------------------------------
    WITH gone AS (
        DELETE FROM public.notifications
         WHERE created_at < NOW()
             - (public.retention_days('retention_notifications_days', 365) || ' days')::INTERVAL
        RETURNING id
    )
    SELECT count(*) INTO v_notifications FROM gone;

    -- --- Abgelaufene Aktions-Token ------------------------------------------
    WITH gone AS (
        DELETE FROM public.action_tokens
         WHERE expires_at < NOW() - INTERVAL '30 days'
        RETURNING token
    )
    SELECT count(*) INTO v_tokens FROM gone;

    -- --- Betriebsprotokolle -------------------------------------------------
    WITH gone AS (
        DELETE FROM public.match_changes
         WHERE created_at < NOW()
             - (public.retention_days('retention_logs_days', 365) || ' days')::INTERVAL
        RETURNING id
    )
    SELECT count(*) INTO v_logs FROM gone;

    DELETE FROM public.sync_runs
     WHERE started_at < NOW()
         - (public.retention_days('retention_logs_days', 365) || ' days')::INTERVAL;

    DELETE FROM public.open_reminder_log
     WHERE sent_on < (NOW()
         - (public.retention_days('retention_logs_days', 365) || ' days')::INTERVAL)::date;

    -- --- Abwesenheiten ------------------------------------------------------
    WITH gone AS (
        DELETE FROM public.absences
         WHERE end_date < (NOW()
             - (public.retention_days('retention_absences_days', 730) || ' days')::INTERVAL)::date
        RETURNING id
    )
    SELECT count(*) INTO v_absences FROM gone;

    RETURN jsonb_build_object(
        'profiles',      v_profiles,
        'auth_users',    v_auth_users,
        'notifications', v_notifications,
        'action_tokens', v_tokens,
        'match_changes', v_logs,
        'absences',      v_absences,
        'ran_at',        NOW()
    );
END;
$$;
