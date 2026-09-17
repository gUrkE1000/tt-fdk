-- ============================================================================
-- Spielverlegung als Terminumfrage (Aufgabe 5.5, Zielbild 4.3)
--
-- Eine Verlegung läuft in vier Schritten: Der Mannschaftsführer schlägt bis zu
-- drei Termine vor, der Kader sagt zu jedem „kann" oder „kann nicht", der
-- Mannschaftsführer schließt die Umfrage und wählt einen Termin.
--
-- Der gewählte Termin landet in `dtstart_override` — nicht in `dtstart_external`.
-- Der Verband weiß von der Verlegung noch nichts; erst wenn click-TT nachzieht,
-- räumt der Kalenderabgleich den Override weg. Bis dahin steht in der Oberfläche
-- „verlegt", und beide Termine bleiben nachvollziehbar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Umfrage starten
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_start_reschedule_poll(
    p_match_id UUID,
    p_options  TIMESTAMPTZ[]
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_match   public.matches%ROWTYPE;
    v_poll_id UUID;
    v_payload JSONB;
    v_member  RECORD;
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_options IS NULL OR array_length(p_options, 1) IS NULL
       OR array_length(p_options, 1) > 3 THEN
        RAISE EXCEPTION 'Bitte einen bis drei Terminvorschläge angeben.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF EXISTS (SELECT 1 FROM unnest(p_options) AS o WHERE o < NOW()) THEN
        RAISE EXCEPTION 'Ein Terminvorschlag darf nicht in der Vergangenheit liegen.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND OR NOT v_match.active THEN
        RAISE EXCEPTION 'Diesen Spieltermin gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    -- Zwei offene Umfragen zum selben Spiel wären nicht auflösbar.
    IF EXISTS (
        SELECT 1 FROM public.reschedule_polls
         WHERE match_id = p_match_id AND status = 'open'
    ) THEN
        RAISE EXCEPTION 'Für dieses Spiel läuft bereits eine Terminumfrage.'
            USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO public.reschedule_polls (match_id, initiated_by, options)
    VALUES (p_match_id, auth.uid(), p_options)
    RETURNING id INTO v_poll_id;

    v_payload := public.match_payload(p_match_id)
        || jsonb_build_object(
            'action',     'poll_vote',
            'target_id',  v_poll_id,
            'expires_at', v_match.dtstart
        );

    -- Gefragt wird, wer nicht ohnehin abgesagt hat.
    FOR v_member IN
        SELECT mp.profile_id
          FROM public.match_participations mp
          JOIN public.profiles p ON p.id = mp.profile_id
         WHERE mp.match_id = p_match_id
           AND mp.response <> 'no'
           AND NOT mp.removed
           AND p.deleted_at IS NULL
    LOOP
        PERFORM public.enqueue_notification(v_member.profile_id, 'reschedule_poll', v_payload);
    END LOOP;

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (p_match_id, 'reschedule_poll_started',
            jsonb_build_object('poll_id', v_poll_id, 'options', to_jsonb(p_options)), auth.uid());

    RETURN v_poll_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Abstimmen
-- ----------------------------------------------------------------------------

-- Wie bei den Ersatzanfragen: die handelnde Person ist ein Parameter, damit
-- derselbe Weg für die Oberfläche und für den Link aus der E-Mail gilt.
CREATE OR REPLACE FUNCTION public.apply_reschedule_vote(
    p_poll_id      UUID,
    p_profile_id   UUID,
    p_option_index INTEGER,
    p_available    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_poll public.reschedule_polls%ROWTYPE;
BEGIN
    SELECT * INTO v_poll FROM public.reschedule_polls WHERE id = p_poll_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown'); END IF;
    IF v_poll.status <> 'open' THEN RETURN jsonb_build_object('status', 'closed'); END IF;

    IF p_option_index < 0 OR p_option_index >= array_length(v_poll.options, 1) THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    INSERT INTO public.reschedule_votes (poll_id, profile_id, option_index, available)
    VALUES (p_poll_id, p_profile_id, p_option_index, p_available)
    ON CONFLICT (poll_id, profile_id, option_index) DO UPDATE
       SET available = EXCLUDED.available;

    RETURN jsonb_build_object('status', 'ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_vote_reschedule(
    p_poll_id      UUID,
    p_option_index INTEGER,
    p_available    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können abstimmen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN public.apply_reschedule_vote(p_poll_id, auth.uid(), p_option_index, p_available);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Schließen und anwenden
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_close_reschedule_poll(p_poll_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_poll public.reschedule_polls%ROWTYPE;
BEGIN
    SELECT * INTO v_poll FROM public.reschedule_polls WHERE id = p_poll_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diese Umfrage gibt es nicht.' USING ERRCODE = 'no_data_found';
    END IF;

    IF NOT (public.is_admin() OR public.leads_match(v_poll.match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE public.reschedule_polls
       SET status = 'closed', closed_at = NOW()
     WHERE id = p_poll_id AND status = 'open';
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_apply_reschedule(p_poll_id UUID, p_option_index INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_poll     public.reschedule_polls%ROWTYPE;
    v_match    public.matches%ROWTYPE;
    v_new_start TIMESTAMPTZ;
    v_duration  INTERVAL;
BEGIN
    SELECT * INTO v_poll FROM public.reschedule_polls WHERE id = p_poll_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diese Umfrage gibt es nicht.' USING ERRCODE = 'no_data_found';
    END IF;

    IF NOT (public.is_admin() OR public.leads_match(v_poll.match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_poll.status = 'applied' THEN
        RAISE EXCEPTION 'Diese Umfrage wurde bereits angewendet.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_option_index < 0 OR p_option_index >= array_length(v_poll.options, 1) THEN
        RAISE EXCEPTION 'Diesen Terminvorschlag gibt es nicht.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_new_start := v_poll.options[p_option_index + 1];   -- Postgres-Arrays zählen ab 1

    SELECT * INTO v_match FROM public.matches WHERE id = v_poll.match_id;
    v_duration := v_match.dtend_external - v_match.dtstart_external;

    -- Der Override, nicht der Importtermin: Der Verband weiß noch nichts davon.
    -- Mit `version + 1` verlieren alle bisherigen Zusagen ihre Gültigkeit, und der
    -- Trigger aus Aufgabe 4.4 benachrichtigt den Kader.
    UPDATE public.matches
       SET dtstart_override = v_new_start,
           dtend_override   = v_new_start + v_duration,
           version          = version + 1
     WHERE id = v_poll.match_id;

    UPDATE public.reschedule_polls
       SET status = 'applied', chosen_index = p_option_index,
           closed_at = COALESCE(closed_at, NOW())
     WHERE id = p_poll_id;

    INSERT INTO public.match_changes (match_id, change_type, old_value, new_value, actor)
    VALUES (
        v_poll.match_id,
        'rescheduled',
        jsonb_build_object('dtstart', v_match.dtstart),
        jsonb_build_object('dtstart', v_new_start, 'poll_id', p_poll_id),
        auth.uid()
    );

    -- `match_changed` kommt aus dem Trigger; hier zusätzlich die Bestätigung mit
    -- dem neuen Termin, weil das die Nachricht ist, auf die alle warten.
    PERFORM public.notify_reschedule_confirmed(v_poll.match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_reschedule_confirmed(p_match_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_payload JSONB;
    v_member  RECORD;
    v_count   INTEGER := 0;
BEGIN
    v_payload := public.match_payload(p_match_id);

    FOR v_member IN
        SELECT mp.profile_id
          FROM public.match_participations mp
          JOIN public.profiles p ON p.id = mp.profile_id
         WHERE mp.match_id = p_match_id AND p.deleted_at IS NULL
    LOOP
        PERFORM public.enqueue_notification(v_member.profile_id, 'reschedule_confirmed', v_payload);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_start_reschedule_poll(UUID, TIMESTAMPTZ[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_reschedule_vote(UUID, UUID, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_vote_reschedule(UUID, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_close_reschedule_poll(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_apply_reschedule(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_reschedule_confirmed(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_start_reschedule_poll(UUID, TIMESTAMPTZ[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vote_reschedule(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_close_reschedule_poll(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_apply_reschedule(UUID, INTEGER) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Alle haben abgestimmt
-- ----------------------------------------------------------------------------

-- Sobald jeder Gefragte zu jeder Option geantwortet hat, ist Warten sinnlos.
-- Der Initiator erfährt es, statt täglich nachzusehen.
CREATE OR REPLACE FUNCTION public.check_poll_complete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_poll     public.reschedule_polls%ROWTYPE;
    v_asked    INTEGER;
    v_answered INTEGER;
BEGIN
    SELECT * INTO v_poll FROM public.reschedule_polls WHERE id = NEW.poll_id;
    IF v_poll.status <> 'open' THEN RETURN NEW; END IF;

    SELECT count(*) INTO v_asked
      FROM public.match_participations mp
      JOIN public.profiles p ON p.id = mp.profile_id
     WHERE mp.match_id = v_poll.match_id
       AND mp.response <> 'no'
       AND NOT mp.removed
       AND p.deleted_at IS NULL;

    SELECT count(DISTINCT profile_id) INTO v_answered
      FROM public.reschedule_votes
     WHERE poll_id = NEW.poll_id;

    IF v_answered >= v_asked AND v_poll.initiated_by IS NOT NULL THEN
        UPDATE public.reschedule_polls
           SET status = 'closed', closed_at = NOW()
         WHERE id = NEW.poll_id AND status = 'open';

        PERFORM public.enqueue_notification(
            v_poll.initiated_by,
            'reschedule_poll',
            public.match_payload(v_poll.match_id)
                - 'action' - 'target_id'
                || jsonb_build_object('note', 'Alle haben abgestimmt.')
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reschedule_votes_complete ON public.reschedule_votes;
CREATE TRIGGER reschedule_votes_complete
    AFTER INSERT OR UPDATE ON public.reschedule_votes
    FOR EACH ROW EXECUTE FUNCTION public.check_poll_complete();

-- ----------------------------------------------------------------------------
-- 5. Abstimmen über den Link aus der E-Mail
-- ----------------------------------------------------------------------------

-- Der Link kann nur „ich kann zum ersten Vorschlag" sagen — mehr passt nicht in
-- einen Klick. Für die vollständige Abstimmung führt er in die Anwendung.
CREATE OR REPLACE FUNCTION public.rpc_answer_action_token(p_token UUID, p_answer TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_token  public.action_tokens%ROWTYPE;
    v_match  public.matches%ROWTYPE;
    v_team   public.teams%ROWTYPE;
    v_name   TEXT;
    v_result JSONB;
    v_index  INTEGER;
BEGIN
    SELECT * INTO v_token FROM public.action_tokens WHERE token = p_token;

    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown'); END IF;
    IF v_token.used_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'used'); END IF;
    IF v_token.expires_at < NOW() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

    IF v_token.action = 'match_response' THEN
        IF p_answer NOT IN ('yes', 'no', 'unclear') THEN
            RETURN jsonb_build_object('status', 'invalid_answer');
        END IF;

        SELECT * INTO v_match FROM public.matches WHERE id = v_token.target_id;
        IF NOT FOUND OR NOT v_match.active THEN
            RETURN jsonb_build_object('status', 'gone');
        END IF;

        SELECT * INTO v_team FROM public.teams WHERE id = v_match.team_id;

        IF v_team.block_participants_after IS NOT NULL
           AND CURRENT_DATE > v_team.block_participants_after THEN
            RETURN jsonb_build_object('status', 'closed');
        END IF;

        INSERT INTO public.match_participations AS mp
            (match_id, profile_id, response, version_responded, source, updated_by)
        VALUES
            (v_match.id, v_token.profile_id, p_answer::public.participation_response,
             v_match.version, 'link', v_token.profile_id)
        ON CONFLICT (match_id, profile_id) DO UPDATE
           SET response          = EXCLUDED.response,
               version_responded = EXCLUDED.version_responded,
               source            = 'link',
               updated_by        = EXCLUDED.updated_by,
               removed           = mp.removed;

        INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
        VALUES (
            v_match.id,
            'response_by_link',
            jsonb_build_object('profile_id', v_token.profile_id, 'response', p_answer),
            v_token.profile_id
        );

        PERFORM public.recompute_lineup(v_match.id);

        UPDATE public.action_tokens SET used_at = NOW() WHERE token = p_token;

        SELECT t.name INTO v_name FROM public.teams t WHERE t.id = v_match.team_id;

        RETURN jsonb_build_object(
            'status',  'ok',
            'answer',  p_answer,
            'summary', format(
                '%s gegen %s am %s um %s Uhr',
                v_name,
                COALESCE(NULLIF(v_match.opponent, ''), 'unbekannt'),
                to_char(v_match.dtstart AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
                to_char(v_match.dtstart AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
            )
        );
    END IF;

    IF v_token.action = 'substitute_answer' THEN
        v_result := public.apply_substitute_answer(v_token.target_id, v_token.profile_id, p_answer);

        IF v_result ->> 'status' = 'ok' THEN
            UPDATE public.action_tokens SET used_at = NOW() WHERE token = p_token;
        END IF;

        RETURN v_result;
    END IF;

    IF v_token.action = 'poll_vote' THEN
        -- „0:yes" heißt: zum ersten Vorschlag kann ich. Mehr trägt ein Link nicht.
        v_index := NULLIF(split_part(p_answer, ':', 1), '')::INTEGER;
        IF v_index IS NULL THEN RETURN jsonb_build_object('status', 'invalid_answer'); END IF;

        v_result := public.apply_reschedule_vote(
            v_token.target_id,
            v_token.profile_id,
            v_index,
            split_part(p_answer, ':', 2) = 'yes'
        );

        -- Der Token bleibt gültig: Wer abstimmt, soll auch zu den anderen
        -- Vorschlägen noch etwas sagen können.
        RETURN v_result;
    END IF;

    RETURN jsonb_build_object('status', 'not_supported');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Ergebnis der Umfrage
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_reschedule_results
WITH (security_invoker = true) AS
SELECT
    p.id            AS poll_id,
    p.match_id,
    p.status,
    p.chosen_index,
    o.ordinality - 1 AS option_index,
    o.option         AS option_at,
    count(*) FILTER (WHERE v.available)        AS available_count,
    count(*) FILTER (WHERE NOT v.available)    AS unavailable_count
FROM public.reschedule_polls p
CROSS JOIN LATERAL unnest(p.options) WITH ORDINALITY AS o(option, ordinality)
LEFT JOIN public.reschedule_votes v
       ON v.poll_id = p.id AND v.option_index = o.ordinality - 1
GROUP BY p.id, p.match_id, p.status, p.chosen_index, o.ordinality, o.option;

GRANT SELECT ON public.v_reschedule_results TO authenticated;
