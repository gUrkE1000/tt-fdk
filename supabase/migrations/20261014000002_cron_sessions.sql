-- ============================================================================
-- Trainingstermine erzeugen: Anstoß (Aufgabe 6.3)
--
-- Ein nächtlicher Lauf schiebt das Fenster von acht Wochen täglich weiter. Der
-- wichtigere Teil ist wieder der sofortige Anstoß: Wer ein Training anlegt oder
-- die Uhrzeit ändert, will die Termine sehen — nicht morgen früh, sondern jetzt.
--
-- Wie bei den anderen Jobs ist alles in eine Prüfung gehüllt: ohne pg_cron und
-- pg_net tut die Migration nichts und meldet das. Dieselbe Datei läuft damit
-- lokal, im CI und in Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sofort-Anstoß für ein einzelnes Training
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.kick_session_generation(p_training_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_base   TEXT;
    v_secret TEXT;
BEGIN
    SELECT value INTO v_base   FROM private.cron_config WHERE key = 'functions_base_url';
    SELECT value INTO v_secret FROM private.cron_config WHERE key = 'cron_secret';

    IF COALESCE(v_base, '') = '' OR COALESCE(v_secret, '') = '' THEN RETURN; END IF;
    IF to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') IS NULL THEN RETURN; END IF;

    PERFORM net.http_post(
        url     := v_base || '/generate-training-sessions',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', v_secret
        ),
        body    := jsonb_build_object('training_id', p_training_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.kick_session_generation(UUID) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 2. Auslöser
--
-- Drei Stellen ändern, welche Termine es geben muss: das Training selbst, ein
-- Ausfall und — für die automatischen Zusagen — eine Dauerzusage. Alle drei
-- stoßen denselben Lauf an; der Planer entscheidet, ob sich daraus etwas ergibt.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_session_generation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_training UUID;
BEGIN
    IF TG_TABLE_NAME = 'trainings' THEN
        v_training := NEW.id;

        -- Nur die Felder, die den Terminplan bestimmen. Ein geänderter Beschreibungstext
        -- soll keinen Lauf auslösen.
        IF TG_OP = 'UPDATE'
           AND NEW.weekday    IS NOT DISTINCT FROM OLD.weekday
           AND NEW.time_start IS NOT DISTINCT FROM OLD.time_start
           AND NEW.time_end   IS NOT DISTINCT FROM OLD.time_end
           AND NEW.rhythm     IS NOT DISTINCT FROM OLD.rhythm
           AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
           AND NEW.venue_id   IS NOT DISTINCT FROM OLD.venue_id
           AND NEW.active     IS NOT DISTINCT FROM OLD.active
           AND NEW.skip_public_holidays IS NOT DISTINCT FROM OLD.skip_public_holidays
           AND NEW.skip_school_holidays IS NOT DISTINCT FROM OLD.skip_school_holidays
        THEN
            RETURN NEW;
        END IF;
    ELSE
        -- Ausfälle und Dauerzusagen. Ein Hallenausfall trifft mehrere Trainings und
        -- hat kein `training_id`; dann läuft der Job über alle.
        v_training := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.training_id
            ELSE NEW.training_id
        END;
    END IF;

    PERFORM public.kick_session_generation(v_training);

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_session_generation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trainings_generate_sessions ON public.trainings;
CREATE TRIGGER trainings_generate_sessions
    AFTER INSERT OR UPDATE ON public.trainings
    FOR EACH ROW EXECUTE FUNCTION public.trigger_session_generation();

DROP TRIGGER IF EXISTS training_cancellations_generate_sessions ON public.training_cancellations;
CREATE TRIGGER training_cancellations_generate_sessions
    AFTER INSERT OR UPDATE OR DELETE ON public.training_cancellations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_session_generation();

DROP TRIGGER IF EXISTS training_auto_attendance_generate_sessions ON public.training_auto_attendance;
CREATE TRIGGER training_auto_attendance_generate_sessions
    AFTER INSERT OR UPDATE ON public.training_auto_attendance
    FOR EACH ROW EXECUTE FUNCTION public.trigger_session_generation();

-- ----------------------------------------------------------------------------
-- 3. Cron: täglich um 03:00 UTC
--
-- Nachts, weil der Lauf das Fenster nur um einen Tag weiterschiebt und niemanden
-- stört. Nicht häufiger: mehr als einmal am Tag gibt es nichts Neues zu planen.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.trigger_generate_training_sessions()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, public, pg_temp
AS $$
DECLARE
    v_base   TEXT;
    v_secret TEXT;
BEGIN
    SELECT value INTO v_base   FROM private.cron_config WHERE key = 'functions_base_url';
    SELECT value INTO v_secret FROM private.cron_config WHERE key = 'cron_secret';

    IF COALESCE(v_base, '') = '' OR COALESCE(v_secret, '') = '' THEN
        RAISE NOTICE 'Terminerzeugung übersprungen: functions_base_url oder cron_secret ist leer.';
        RETURN;
    END IF;

    IF to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') IS NULL THEN
        RAISE NOTICE 'Terminerzeugung übersprungen: pg_net ist nicht installiert.';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_base || '/generate-training-sessions',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', v_secret
        ),
        body    := '{}'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_generate_training_sessions() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron nicht vorhanden — die Terminerzeugung wird nicht eingeplant.';
        RETURN;
    END IF;

    PERFORM cron.unschedule('generate-training-sessions')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-training-sessions');

    PERFORM cron.schedule(
        'generate-training-sessions',
        '0 3 * * *',
        $job$ SELECT private.trigger_generate_training_sessions(); $job$
    );
END $$;
