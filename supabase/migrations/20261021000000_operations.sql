-- ============================================================================
-- Betrieb: Cron-Sicht und erneuter Versandversuch (Aufgabe 8.4)
--
-- Der Administrator soll ohne psql sehen können, ob die Jobs laufen und was
-- zuletzt nicht rausging — und einen fehlgeschlagenen Versand wiederholen können.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sicht auf die Cron-Jobs
--
-- `cron.job` und `cron.job_run_details` gehören der Erweiterung pg_cron. Die
-- gibt es in Supabase, aber nicht in der lokalen Testdatenbank und nicht im
-- CI-Container. Wie schon bei den Job-Migrationen prüft diese hier und meldet,
-- statt zu scheitern — dieselbe Datei läuft überall.
--
-- Die View ist bewusst **nicht** `security_invoker`: Auf `cron.*` hat eine
-- angemeldete Rolle keinen Zugriff, und den sollte sie auch nicht bekommen.
-- Stattdessen liest die View als Eigentümer und gibt nur heraus, was ein
-- Administrator sehen darf — das prüft die WHERE-Klausel.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron nicht vorhanden — v_cron_status bleibt leer.';

        -- Eine leere View mit denselben Spalten: Die Oberfläche braucht keine
        -- Fallunterscheidung, sie zeigt dann schlicht keine Jobs.
        EXECUTE $view$
            CREATE OR REPLACE VIEW public.v_cron_status AS
            SELECT
                NULL::BIGINT      AS jobid,
                NULL::TEXT        AS jobname,
                NULL::TEXT        AS schedule,
                NULL::BOOLEAN     AS active,
                NULL::TIMESTAMPTZ AS last_start,
                NULL::TIMESTAMPTZ AS last_end,
                NULL::TEXT        AS last_status,
                NULL::TEXT        AS last_message
            WHERE false
        $view$;
    ELSE
        EXECUTE $view$
            CREATE OR REPLACE VIEW public.v_cron_status AS
            SELECT
                j.jobid,
                j.jobname::TEXT   AS jobname,
                j.schedule::TEXT  AS schedule,
                j.active,
                r.start_time      AS last_start,
                r.end_time        AS last_end,
                r.status::TEXT    AS last_status,
                LEFT(COALESCE(r.return_message, ''), 300) AS last_message
            FROM cron.job j
            LEFT JOIN LATERAL (
                SELECT d.start_time, d.end_time, d.status, d.return_message
                  FROM cron.job_run_details d
                 WHERE d.jobid = j.jobid
                 ORDER BY d.start_time DESC
                 LIMIT 1
            ) r ON true
            WHERE public.is_admin()
        $view$;
    END IF;
END $$;

GRANT SELECT ON public.v_cron_status TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Einen Versand wiederholen
--
-- `notifications` hat bewusst keine UPDATE-Policy: Zeilen entstehen nur über
-- `enqueue_notification`, und der Zustand gehört dem Versandlauf. Für den einen
-- Fall, in dem ein Mensch eingreifen soll — eine Adresse war falsch, sie ist
-- korrigiert, die Nachricht soll doch noch raus — gibt es diese Funktion.
--
-- Sie setzt den Zähler zurück: Sonst wäre die Zeile nach dem ersten neuen Versuch
-- schon wieder `failed`, weil `attempts` bereits bei drei stand.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_retry_notification(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Nur Administratoren dürfen einen Versand wiederholen.'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.notifications
       SET status        = 'pending',
           attempts      = 0,
           error         = NULL,
           scheduled_for = NOW()
     WHERE id = p_id
       AND status IN ('failed', 'skipped');

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_retry_notification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_retry_notification(UUID) TO authenticated;
