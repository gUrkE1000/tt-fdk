-- ============================================================================
-- Ersatzanfragen und Spielverlegung (Aufgabe 5.1, Zielbild 3.3/4.2/4.3)
--
-- Die Ersatzkette ist das Herzstück des TT-Planers: Sagt ein Stammspieler ab,
-- wird automatisch der nächste Ersatzspieler gefragt, und der übernächste, bis
-- jemand zusagt. Ohne das wäre die Anwendung ein Terminkalender.
--
-- Die Entscheidung, wer als Nächstes gefragt wird, trifft nicht die Datenbank,
-- sondern eine reine Funktion (`_shared/substituteEngine.ts`, Aufgabe 5.2). Hier
-- stehen nur die Tabellen und die Handgriffe, die der Mannschaftsführer selbst
-- macht.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'substitute_status') THEN
        CREATE TYPE public.substitute_status AS ENUM (
            'pending', 'accepted', 'declined', 'expired', 'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_origin') THEN
        CREATE TYPE public.request_origin AS ENUM ('system', 'leader');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_status') THEN
        CREATE TYPE public.poll_status AS ENUM ('open', 'closed', 'applied');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Ersatzanfragen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.substitute_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id      UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    -- Die Fassung gehört dazu: Wird das Spiel verlegt, sind alle laufenden
    -- Anfragen hinfällig — man hat ja für einen anderen Termin zugesagt.
    match_version INTEGER NOT NULL,
    profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    rank          INTEGER,
    status        public.substitute_status NOT NULL DEFAULT 'pending',
    created_by    public.request_origin NOT NULL DEFAULT 'system',
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    answered_at   TIMESTAMPTZ,

    -- Jede Person wird je Fassung höchstens einmal gefragt. Ohne diese Regel
    -- würde die Kette bei jedem Lauf dieselben Leute erneut anschreiben.
    UNIQUE (match_id, match_version, profile_id)
);

CREATE INDEX IF NOT EXISTS substitute_requests_pending_idx
    ON public.substitute_requests (match_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS substitute_requests_profile_idx
    ON public.substitute_requests (profile_id, status);

-- ----------------------------------------------------------------------------
-- 2. Terminumfragen für Verlegungen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reschedule_polls (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id     UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    initiated_by UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    -- Bis zu drei Vorschläge, wie im TT-Planer.
    options      TIMESTAMPTZ[] NOT NULL,
    status       public.poll_status NOT NULL DEFAULT 'open',
    chosen_index INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at    TIMESTAMPTZ,

    CONSTRAINT reschedule_polls_options_check
        CHECK (array_length(options, 1) BETWEEN 1 AND 3)
);

CREATE INDEX IF NOT EXISTS reschedule_polls_match_idx
    ON public.reschedule_polls (match_id, created_at DESC);

-- Je Person und Option eine Zeile: „kann" oder „kann nicht". Getrennt statt einer
-- Zeile mit drei Feldern, weil die Zahl der Optionen offen ist.
CREATE TABLE IF NOT EXISTS public.reschedule_votes (
    poll_id      UUID NOT NULL REFERENCES public.reschedule_polls(id) ON DELETE CASCADE,
    profile_id   UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    available    BOOLEAN NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, profile_id, option_index)
);

-- ----------------------------------------------------------------------------
-- 3. Rechte
-- ----------------------------------------------------------------------------

ALTER TABLE public.substitute_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reschedule_polls    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reschedule_votes    ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.substitute_requests, public.reschedule_polls, public.reschedule_votes
    TO authenticated;

-- Lesen darf, wen es angeht: der Gefragte selbst, die Mannschaftsführung, der Admin.
-- Geschrieben wird ausschließlich über die RPCs.
DROP POLICY IF EXISTS substitute_requests_select ON public.substitute_requests;
CREATE POLICY substitute_requests_select ON public.substitute_requests
    FOR SELECT TO authenticated
    USING (
        profile_id = auth.uid()
        OR public.is_admin()
        OR public.leads_match(match_id)
    );

DROP POLICY IF EXISTS reschedule_polls_select ON public.reschedule_polls;
CREATE POLICY reschedule_polls_select ON public.reschedule_polls
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS reschedule_votes_select ON public.reschedule_votes;
CREATE POLICY reschedule_votes_select ON public.reschedule_votes
    FOR SELECT TO authenticated
    USING (public.is_active_member());

GRANT SELECT, INSERT, UPDATE ON public.substitute_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.reschedule_polls TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.reschedule_votes TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Ersatzanfragen von Hand
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_create_substitute_request(
    p_match_id   UUID,
    p_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_match   public.matches%ROWTYPE;
    v_team    public.teams%ROWTYPE;
    v_rank    INTEGER;
    v_id      UUID;
    v_payload JSONB;
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND OR NOT v_match.active THEN
        RAISE EXCEPTION 'Diesen Spieltermin gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    IF v_match.dtstart < NOW() THEN
        RAISE EXCEPTION 'Für ein vergangenes Spiel lässt sich kein Ersatz mehr suchen.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_match.team_id;

    SELECT rank INTO v_rank
      FROM public.team_members
     WHERE team_id = v_match.team_id AND profile_id = p_profile_id AND kind = 'substitute';

    INSERT INTO public.substitute_requests
        (match_id, match_version, profile_id, rank, created_by, expires_at)
    VALUES (
        p_match_id,
        v_match.version,
        p_profile_id,
        v_rank,
        'leader',
        -- Nie länger als bis zum Spiel: eine Frist danach wäre sinnlos.
        LEAST(NOW() + make_interval(hours => v_team.substitute_timeout_hours), v_match.dtstart)
    )
    ON CONFLICT (match_id, match_version, profile_id) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Diese Person wurde für diesen Termin schon gefragt.'
            USING ERRCODE = 'unique_violation';
    END IF;

    v_payload := public.match_payload(p_match_id)
        || jsonb_build_object(
            'action',    'substitute_answer',
            'target_id', v_id,
            'deadline',  to_char(
                (SELECT expires_at FROM public.substitute_requests WHERE id = v_id)
                    AT TIME ZONE 'Europe/Berlin',
                'DD.MM.YYYY HH24:MI'
            ),
            'expires_at', v_match.dtstart
        );

    PERFORM public.enqueue_notification(p_profile_id, 'substitute_request', v_payload);

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (p_match_id, 'substitute_requested',
            jsonb_build_object('profile_id', p_profile_id, 'origin', 'leader'), auth.uid());

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_cancel_substitute_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_request public.substitute_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_request FROM public.substitute_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diese Anfrage gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    IF NOT (public.is_admin() OR public.leads_match(v_request.match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Diese Anfrage ist bereits beantwortet.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    UPDATE public.substitute_requests
       SET status = 'cancelled', answered_at = NOW()
     WHERE id = p_request_id;

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (v_request.match_id, 'substitute_cancelled',
            jsonb_build_object('profile_id', v_request.profile_id), auth.uid());
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Antwort des Gefragten
-- ----------------------------------------------------------------------------

-- Wird sowohl aus der Oberfläche als auch über den Link in der E-Mail aufgerufen.
-- Deshalb nimmt sie die handelnde Person als Parameter: beim Link gibt es keine
-- Anmeldung, aus der sie sich ergeben könnte.
CREATE OR REPLACE FUNCTION public.apply_substitute_answer(
    p_request_id UUID,
    p_profile_id UUID,
    p_answer     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_request public.substitute_requests%ROWTYPE;
    v_match   public.matches%ROWTYPE;
    v_team    public.teams%ROWTYPE;
    v_next    INTEGER;
    v_leader  RECORD;
    v_payload JSONB;
BEGIN
    IF p_answer NOT IN ('yes', 'no') THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    SELECT * INTO v_request FROM public.substitute_requests WHERE id = p_request_id;
    IF NOT FOUND OR v_request.profile_id <> p_profile_id THEN
        RETURN jsonb_build_object('status', 'unknown');
    END IF;

    IF v_request.status <> 'pending' THEN
        RETURN jsonb_build_object('status', 'used');
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = v_request.match_id;

    IF NOT v_match.active OR v_match.version <> v_request.match_version THEN
        -- Der Termin hat sich geändert; die Anfrage bezog sich auf den alten.
        UPDATE public.substitute_requests SET status = 'cancelled', answered_at = NOW()
         WHERE id = p_request_id;
        RETURN jsonb_build_object('status', 'stale');
    END IF;

    IF v_request.expires_at < NOW() THEN
        UPDATE public.substitute_requests SET status = 'expired', answered_at = NOW()
         WHERE id = p_request_id;
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_match.team_id;

    UPDATE public.substitute_requests
       SET status = (CASE p_answer WHEN 'yes' THEN 'accepted' ELSE 'declined' END)::public.substitute_status,
           answered_at = NOW()
     WHERE id = p_request_id;

    IF p_answer = 'yes' THEN
        INSERT INTO public.match_participations AS mp
            (match_id, profile_id, response, version_responded, source, updated_by)
        VALUES (v_match.id, p_profile_id, 'yes', v_match.version, 'request', p_profile_id)
        ON CONFLICT (match_id, profile_id) DO UPDATE
           SET response          = 'yes',
               version_responded = v_match.version,
               removed           = false,
               source            = 'request',
               updated_by        = p_profile_id;

        -- Bei gesperrter Aufstellung rechnet die Automatik nicht mehr; dann setzt
        -- die Zusage den Spieler nur dann ans Ende, wenn der Verein das für
        -- manuelle Anfragen so eingestellt hat.
        IF v_match.lineup_locked THEN
            IF v_request.created_by = 'system' OR v_team.manual_request_auto_add THEN
                SELECT COALESCE(MAX(lineup_position), 0) + 1 INTO v_next
                  FROM public.match_participations WHERE match_id = v_match.id;

                UPDATE public.match_participations
                   SET lineup_position = v_next
                 WHERE match_id = v_match.id AND profile_id = p_profile_id;
            END IF;
        ELSE
            PERFORM public.recompute_lineup(v_match.id);
        END IF;

        v_payload := public.match_payload(v_match.id);

        -- Wer abgesagt hatte, erfährt, dass Ersatz da ist — und die Mannschaftsführung auch.
        FOR v_leader IN
            SELECT DISTINCT mp.profile_id
              FROM public.match_participations mp
             WHERE mp.match_id = v_match.id
               AND mp.response = 'no'
               AND mp.version_responded = v_match.version
            UNION
            SELECT tl.profile_id FROM public.team_leaders tl WHERE tl.team_id = v_match.team_id
        LOOP
            PERFORM public.enqueue_notification(v_leader.profile_id, 'substitute_found', v_payload);
        END LOOP;
    END IF;

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (
        v_match.id,
        'substitute_answer',
        jsonb_build_object('profile_id', p_profile_id, 'answer', p_answer),
        p_profile_id
    );

    RETURN jsonb_build_object('status', 'ok', 'answer', p_answer);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_substitute_answer(UUID, UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.rpc_answer_substitute_request(p_request_id UUID, p_answer TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN public.apply_substitute_answer(p_request_id, auth.uid(), p_answer);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_substitute_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_cancel_substitute_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_answer_substitute_request(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_create_substitute_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_substitute_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_answer_substitute_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_substitute_answer(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_substitute_request(UUID, UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Antwort über den Link aus der E-Mail
-- ----------------------------------------------------------------------------

-- `rpc_answer_action_token` aus Aufgabe 4.6 um den Fall `substitute_answer` ergänzt.
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
BEGIN
    SELECT * INTO v_token FROM public.action_tokens WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'unknown');
    END IF;

    IF v_token.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'used');
    END IF;

    IF v_token.expires_at < NOW() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

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

        -- Nur eine wirksame Antwort verbraucht den Token. Wer auf eine abgelaufene
        -- Anfrage klickt, soll die Begründung sehen, nicht „schon benutzt".
        IF v_result ->> 'status' = 'ok' THEN
            UPDATE public.action_tokens SET used_at = NOW() WHERE token = p_token;
        END IF;

        RETURN v_result;
    END IF;

    RETURN jsonb_build_object('status', 'not_supported');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) TO anon, authenticated;

-- Auch die Beschreibung kennt den neuen Fall.
CREATE OR REPLACE FUNCTION public.rpc_describe_action_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_token   public.action_tokens%ROWTYPE;
    v_match   public.matches%ROWTYPE;
    v_team    TEXT;
    v_request public.substitute_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_token FROM public.action_tokens WHERE token = p_token;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown'); END IF;
    IF v_token.used_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'used'); END IF;
    IF v_token.expires_at < NOW() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

    IF v_token.action = 'substitute_answer' THEN
        SELECT * INTO v_request FROM public.substitute_requests WHERE id = v_token.target_id;
        IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown'); END IF;
        IF v_request.status <> 'pending' THEN RETURN jsonb_build_object('status', 'used'); END IF;

        SELECT * INTO v_match FROM public.matches WHERE id = v_request.match_id;
        IF NOT FOUND OR NOT v_match.active THEN
            RETURN jsonb_build_object('status', 'gone');
        END IF;
    ELSIF v_token.action = 'match_response' THEN
        SELECT * INTO v_match FROM public.matches WHERE id = v_token.target_id;
        IF NOT FOUND OR NOT v_match.active THEN
            RETURN jsonb_build_object('status', 'gone');
        END IF;
    ELSE
        RETURN jsonb_build_object('status', 'not_supported');
    END IF;

    SELECT name INTO v_team FROM public.teams WHERE id = v_match.team_id;

    RETURN jsonb_build_object(
        'status',  'ok',
        'action',  v_token.action,
        'summary', format(
            '%s gegen %s am %s um %s Uhr',
            v_team,
            COALESCE(NULLIF(v_match.opponent, ''), 'unbekannt'),
            to_char(v_match.dtstart AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
            to_char(v_match.dtstart AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_describe_action_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_describe_action_token(UUID) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Sicht auf laufende Anfragen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_substitute_requests
WITH (security_invoker = true) AS
SELECT
    sr.id,
    sr.match_id,
    sr.match_version,
    sr.profile_id,
    sr.rank,
    sr.status,
    sr.created_by,
    sr.requested_at,
    sr.expires_at,
    sr.answered_at,
    p.full_name,
    -- Gilt die Anfrage noch zur aktuellen Fassung des Termins?
    (sr.match_version = m.version) AS current_version
FROM public.substitute_requests sr
JOIN public.profiles p ON p.id = sr.profile_id
JOIN public.matches  m ON m.id = sr.match_id;

GRANT SELECT ON public.v_substitute_requests TO authenticated;
