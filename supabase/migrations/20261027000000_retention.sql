-- ============================================================================
-- Aufbewahrung und Löschung (Aufgabe 10.1)
--
-- Das Schema verspricht seit der Baseline: „Soft-Delete, endgültig nach 30 Tagen".
-- Getan hat das bisher **niemand** — es gab keinen Job dafür. Ein gelöschtes
-- Mitglied blieb mit Name, Adresse und Geburtsdatum unbegrenzt in der Datenbank
-- stehen, nur unsichtbar.
--
-- Das ist kein Schönheitsfehler. Art. 17 DSGVO verlangt die Löschung, und ein
-- Löschkonzept, das eine Löschung beschreibt, die nicht stattfindet, ist
-- schlimmer als keins: Es begründet eine Zusage, die der Verein bricht.
--
-- Diese Migration macht aus dem Kommentar einen Vorgang. Die Fristen stehen in
-- `docs/datenschutz/loeschkonzept.md`; hier ist die Umsetzung.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fristen
--
-- Als Einstellungen und nicht fest verdrahtet: Ein Verein kann andere Fristen
-- brauchen (Satzung, Kassenprüfung), und dann soll er sie ändern können, ohne
-- eine Migration zu schreiben.
-- ----------------------------------------------------------------------------

INSERT INTO public.club_settings (key, value) VALUES
    -- Gelöschte Konten: Frist, bis die Zeile endgültig verschwindet. Die 30 Tage
    -- sind eine Gnadenfrist gegen das versehentliche Löschen, kein Archiv.
    ('retention_deleted_profiles_days', '30'),
    -- Verschickte und fehlgeschlagene Benachrichtigungen. Sie enthalten Namen und
    -- Termininhalte; nach einem Jahr beantwortet niemand mehr „ich habe nie eine
    -- Mail bekommen".
    ('retention_notifications_days', '365'),
    -- Betriebsprotokolle: Prüfprotokoll der RPCs, Sync-Läufe, Erinnerungs-Log.
    ('retention_logs_days', '365'),
    -- Abwesenheiten mit privatem Grund, nachdem der Zeitraum vorbei ist.
    ('retention_absences_days', '730')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.retention_days(p_key TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        NULLIF(regexp_replace(value, '\D', '', 'g'), '')::INTEGER,
        p_default
    )
      FROM public.club_settings
     WHERE key = p_key;
$$;

-- ----------------------------------------------------------------------------
-- 2. Der Lauf
--
-- Gibt zurück, was er getan hat — sonst ließe sich nicht belegen, dass gelöscht
-- wurde, und genau das verlangt die Rechenschaftspflicht (Art. 5 Abs. 2 DSGVO).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_retention()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_profiles      INTEGER := 0;
    v_notifications INTEGER := 0;
    v_tokens        INTEGER := 0;
    v_logs          INTEGER := 0;
    v_absences      INTEGER := 0;
BEGIN
    -- --- Gelöschte Konten endgültig entfernen -------------------------------
    -- Alles, was an `profiles.id` hängt, trägt ON DELETE CASCADE: Rückmeldungen,
    -- Aufstellungen, Rangzuordnungen, Nachrichten. Genau das ist gemeint — nach
    -- der Frist bleibt von der Person nichts stehen.
    WITH gone AS (
        DELETE FROM public.profiles
         WHERE deleted_at IS NOT NULL
           AND deleted_at < NOW()
             - (public.retention_days('retention_deleted_profiles_days', 30) || ' days')::INTERVAL
        RETURNING id
    )
    SELECT count(*) INTO v_profiles FROM gone;

    -- --- Postfach -----------------------------------------------------------
    WITH gone AS (
        DELETE FROM public.notifications
         WHERE created_at < NOW()
             - (public.retention_days('retention_notifications_days', 365) || ' days')::INTERVAL
        RETURNING id
    )
    SELECT count(*) INTO v_notifications FROM gone;

    -- --- Abgelaufene Aktions-Token ------------------------------------------
    -- Ein verbrauchter oder abgelaufener Token ist wertlos, verknüpft aber weiter
    -- eine Person mit einem Termin.
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
    -- `comment_private` ist der Grund und geht niemanden etwas an; nach zwei
    -- Jahren geht er auch die Datenbank nichts mehr an.
    WITH gone AS (
        DELETE FROM public.absences
         WHERE end_date < (NOW()
             - (public.retention_days('retention_absences_days', 730) || ' days')::INTERVAL)::date
        RETURNING id
    )
    SELECT count(*) INTO v_absences FROM gone;

    RETURN jsonb_build_object(
        'profiles',      v_profiles,
        'notifications', v_notifications,
        'action_tokens', v_tokens,
        'match_changes', v_logs,
        'absences',      v_absences,
        'ran_at',        NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention() FROM PUBLIC;

-- Auch der Administrator darf ihn anstoßen — etwa, um nach einer Löschanfrage
-- nicht bis zur Nacht zu warten.
GRANT EXECUTE ON FUNCTION public.run_retention() TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_run_retention()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Nur Administratoren dürfen den Löschlauf anstoßen.'
            USING ERRCODE = '42501';
    END IF;

    RETURN public.run_retention();
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_run_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_run_retention() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Täglich
--
-- Wie bei den anderen Jobs in eine Prüfung gehüllt: pg_cron gibt es in Supabase,
-- aber nicht in der lokalen Testdatenbank und nicht im CI-Container.
--
-- Der Lauf braucht **keine** Edge Function: Er ist reines SQL und arbeitet mit
-- den Rechten des Eigentümers. Ein Umweg über pg_net wäre eine Fehlerquelle mehr
-- für eine Anweisung, die die Datenbank selbst ausführen kann.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron nicht vorhanden — der Löschlauf wird nicht eingeplant.';
        RETURN;
    END IF;

    PERFORM cron.unschedule('retention');
EXCEPTION WHEN OTHERS THEN
    NULL; -- Es gab ihn noch nicht.
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'retention',
            -- Nachts um 2, vor dem Kalenderabgleich: Wer gelöscht ist, soll nicht
            -- noch einmal in einen Spielplan einsortiert werden.
            '0 2 * * *',
            $job$ SELECT public.run_retention(); $job$
        );
    END IF;
END $$;
