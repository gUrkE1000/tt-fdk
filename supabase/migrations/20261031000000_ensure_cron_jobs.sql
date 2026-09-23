-- ============================================================================
-- Cron-Jobs sicherstellen
--
-- Die Jobs werden in sechs Migrationen eingeplant — aber nur, wenn pg_cron in dem
-- Moment schon eingeschaltet ist. Wurde die Erweiterung erst danach aktiviert (oder
-- nach einem `db reset` neu), sind diese Migrationen längst als erledigt vermerkt und
-- laufen nie wieder. Ergebnis: null Jobs, kein Versand, keine Erinnerungen, und nichts
-- meldet einen Fehler. Genau das trat im Betrieb auf (net._http_response blieb leer).
--
-- Diese Migration plant alle Jobs noch einmal ein, idempotent: vorhandene mit gleichem
-- Namen werden ersetzt. Ohne pg_cron meldet sie das und tut sonst nichts.
--
-- Die Definitionen müssen mit docs/einrichtung.md (Abschnitt 2) übereinstimmen.
-- ============================================================================

DO $$
DECLARE
    v_job RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron ist nicht eingeschaltet — keine Jobs eingeplant. '
                     'Erweiterung aktivieren und diese Anweisung aus docs/einrichtung.md ausführen.';
        RETURN;
    END IF;

    FOR v_job IN
        SELECT * FROM (VALUES
            ('retention',                  '0 2 * * *',    'SELECT public.run_retention();'),
            ('generate-training-sessions', '0 3 * * *',    'SELECT private.trigger_generate_training_sessions();'),
            ('sync-calendars',             '0 4 * * *',    'SELECT private.trigger_sync_calendars();'),
            ('process-notifications',      '*/5 * * * *',  'SELECT private.trigger_process_notifications();'),
            ('enqueue-reminders',          '*/10 * * * *', 'SELECT private.trigger_enqueue_reminders();'),
            ('substitute-engine',          '*/10 * * * *', 'SELECT private.trigger_substitute_engine();')
        ) AS jobs(name, schedule, command)
    LOOP
        EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1' USING v_job.name;
        EXECUTE 'SELECT cron.schedule($1, $2, $3)' USING v_job.name, v_job.schedule, v_job.command;
    END LOOP;
END $$;
