-- ============================================================================
-- Versandlauf für Benachrichtigungen (Aufgabe 4.2)
--
-- Alle fünf Minuten. Häufiger wäre unnötig — eine Erinnerung an ein Spiel am
-- Samstag verträgt fünf Minuten Verzögerung — seltener macht Antwortlinks träge.
--
-- Wie beim Kalenderabgleich ist alles in eine Prüfung gehüllt: ohne pg_cron und
-- pg_net tut die Migration nichts und meldet das.
-- ============================================================================

CREATE OR REPLACE FUNCTION private.trigger_process_notifications()
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
        RAISE NOTICE 'Versandlauf übersprungen: functions_base_url oder cron_secret ist leer.';
        RETURN;
    END IF;

    IF to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') IS NULL THEN
        RAISE NOTICE 'Versandlauf übersprungen: pg_net ist nicht installiert.';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_base || '/process-notifications',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', v_secret
        ),
        body    := '{}'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_process_notifications() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron nicht vorhanden — der Versandlauf wird nicht eingeplant.';
        RETURN;
    END IF;

    PERFORM cron.unschedule('process-notifications')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notifications');

    PERFORM cron.schedule(
        'process-notifications',
        '*/5 * * * *',
        $job$ SELECT private.trigger_process_notifications(); $job$
    );
END $$;
