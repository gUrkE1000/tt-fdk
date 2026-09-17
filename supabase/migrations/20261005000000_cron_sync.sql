-- ============================================================================
-- Nächtlicher Kalenderabgleich (Aufgabe 3.3)
--
-- Der Job läuft in der Datenbank (pg_cron) und ruft die Edge Function über pg_net.
-- Beide Erweiterungen gibt es in Supabase, aber nicht in jeder PostgreSQL-Installation —
-- die lokale Testdatenbank und der CI-Container haben sie nicht.
--
-- Deshalb ist alles hier in eine Prüfung gehüllt: Wo die Erweiterungen fehlen, tut die
-- Migration nichts und meldet das. So läuft dieselbe Datei lokal, in der CI und in
-- Supabase, ohne Sonderfälle in den Skripten.
-- ============================================================================

-- Adresse und Secret liegen in `private`, das PostgREST nicht veröffentlicht. Beides
-- setzt der Betreiber nach dem Anlegen des Projekts (siehe docs/betrieb.md).
INSERT INTO private.cron_config (key, value) VALUES
    ('functions_base_url', ''),
    ('cron_secret',        '')
ON CONFLICT (key) DO NOTHING;

-- Ruft die Edge Function mit dem Cron-Secret auf. Ohne Konfiguration passiert nichts —
-- ein Job, der jede Nacht ins Leere läuft, wäre schlimmer als keiner.
CREATE OR REPLACE FUNCTION private.trigger_sync_calendars()
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
        RAISE NOTICE 'Kalenderabgleich übersprungen: functions_base_url oder cron_secret ist leer.';
        RETURN;
    END IF;

    IF to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') IS NULL THEN
        RAISE NOTICE 'Kalenderabgleich übersprungen: pg_net ist nicht installiert.';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_base || '/sync-calendars',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', v_secret
        ),
        body    := '{}'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_sync_calendars() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron nicht vorhanden — der nächtliche Abgleich wird nicht eingeplant.';
        RETURN;
    END IF;

    -- 04:00 UTC: nach dem Ende aller Spiele und vor dem ersten Blick am Morgen.
    PERFORM cron.unschedule('sync-calendars')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-calendars');

    PERFORM cron.schedule(
        'sync-calendars',
        '0 4 * * *',
        $job$ SELECT private.trigger_sync_calendars(); $job$
    );
END $$;
