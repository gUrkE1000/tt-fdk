-- ============================================================================
-- Ersatzkette: Anstoß und Ausführung (Aufgabe 5.3)
--
-- Zwei Funktionen für die Engine, ein Cron-Job für die Fristen und ein
-- Sofort-Anstoß aus den RPCs heraus.
--
-- Das Sofortige ist der wichtigere Teil: Wer freitags absagt, soll nicht bis zum
-- nächsten Zehnminutentakt warten, bis der Ersatz gefragt wird.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Anfrage schreiben und verschicken
-- ----------------------------------------------------------------------------

-- Was `rpc_create_substitute_request` für den Mannschaftsführer tut, tut diese
-- Funktion für die Automatik. Getrennt, weil dort Rechte geprüft werden müssen
-- und hier nicht — der Aufrufer ist der Hintergrundlauf.
CREATE OR REPLACE FUNCTION public.enqueue_substitute_request(
    p_match_id   UUID,
    p_profile_id UUID,
    p_rank       INTEGER,
    p_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_match   public.matches%ROWTYPE;
    v_id      UUID;
    v_payload JSONB;
BEGIN
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND OR NOT v_match.active OR v_match.dtstart < NOW() THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.substitute_requests
        (match_id, match_version, profile_id, rank, created_by, expires_at)
    VALUES (p_match_id, v_match.version, p_profile_id, p_rank, 'system',
            LEAST(p_expires_at, v_match.dtstart))
    ON CONFLICT (match_id, match_version, profile_id) DO NOTHING
    RETURNING id INTO v_id;

    -- Nichts eingefügt heißt: ein paralleler Lauf war schneller.
    IF v_id IS NULL THEN RETURN NULL; END IF;

    v_payload := public.match_payload(p_match_id)
        || jsonb_build_object(
            'action',    'substitute_answer',
            'target_id', v_id,
            'deadline',  to_char(
                LEAST(p_expires_at, v_match.dtstart) AT TIME ZONE 'Europe/Berlin',
                'DD.MM.YYYY HH24:MI'
            ),
            'expires_at', v_match.dtstart
        );

    PERFORM public.enqueue_notification(p_profile_id, 'substitute_request', v_payload);

    INSERT INTO public.match_changes (match_id, change_type, new_value)
    VALUES (p_match_id, 'substitute_requested',
            jsonb_build_object('profile_id', p_profile_id, 'origin', 'system'));

    RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Leere Kette melden
-- ----------------------------------------------------------------------------

-- Der TT-Planer kennt diese Nachricht nicht — dort erfährt der Mannschaftsführer
-- nicht, dass die Kette durchgelaufen ist. Genau dann muss er aber handeln, und
-- zwar bevor Samstag ist.
CREATE OR REPLACE FUNCTION public.notify_chain_exhausted(p_match_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_match   public.matches%ROWTYPE;
    v_payload JSONB;
    v_leader  RECORD;
    v_count   INTEGER := 0;
BEGIN
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- Die Fassung wandert in die Nutzlast: Daran erkennt der nächste Lauf, dass
    -- für diesen Stand schon gemeldet wurde.
    v_payload := public.match_payload(p_match_id)
        || jsonb_build_object('match_id', p_match_id, 'match_version', v_match.version);
    v_payload := v_payload - 'action' - 'target_id';

    FOR v_leader IN
        SELECT profile_id FROM public.team_leaders WHERE team_id = v_match.team_id
    LOOP
        PERFORM public.enqueue_notification(
            v_leader.profile_id, 'substitute_chain_exhausted', v_payload
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_substitute_request(UUID, UUID, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_chain_exhausted(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_substitute_request(UUID, UUID, INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_chain_exhausted(UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Sofort-Anstoß nach einer Absage
-- ----------------------------------------------------------------------------

-- Ruft die Engine für ein einzelnes Spiel. Ohne pg_net passiert nichts — dann
-- übernimmt der Zehnminutenlauf, nur eben später.
CREATE OR REPLACE FUNCTION public.kick_substitute_engine(p_match_id UUID)
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
        url     := v_base || '/substitute-engine',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', v_secret
        ),
        body    := jsonb_build_object('matchId', p_match_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.kick_substitute_engine(UUID) FROM PUBLIC;

-- Nach jeder Absage die Kette anstoßen. Als Trigger statt in den RPCs, damit auch
-- eine Absage über den Link aus der E-Mail sie auslöst.
CREATE OR REPLACE FUNCTION public.trigger_substitute_chain()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.response = 'no' AND (TG_OP = 'INSERT' OR OLD.response IS DISTINCT FROM 'no') THEN
        PERFORM public.kick_substitute_engine(NEW.match_id);
    ELSIF TG_OP = 'UPDATE' AND NEW.removed AND NOT OLD.removed THEN
        PERFORM public.kick_substitute_engine(NEW.match_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_participations_kick_chain ON public.match_participations;
CREATE TRIGGER match_participations_kick_chain
    AFTER INSERT OR UPDATE ON public.match_participations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_substitute_chain();

-- ----------------------------------------------------------------------------
-- 4. Cron: alle zehn Minuten für die Fristen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.trigger_substitute_engine()
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
        RAISE NOTICE 'Ersatzkette übersprungen: functions_base_url oder cron_secret ist leer.';
        RETURN;
    END IF;

    IF to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') IS NULL THEN
        RAISE NOTICE 'Ersatzkette übersprungen: pg_net ist nicht installiert.';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_base || '/substitute-engine',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', v_secret
        ),
        body    := '{}'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_substitute_engine() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron nicht vorhanden — die Ersatzkette wird nicht eingeplant.';
        RETURN;
    END IF;

    PERFORM cron.unschedule('substitute-engine')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'substitute-engine');

    PERFORM cron.schedule(
        'substitute-engine',
        '*/10 * * * *',
        $job$ SELECT private.trigger_substitute_engine(); $job$
    );
END $$;
