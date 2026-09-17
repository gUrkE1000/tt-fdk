-- ============================================================================
-- Antworten ohne Anmeldung (Aufgabe 4.6)
--
-- Der Link in einer E-Mail soll funktionieren, ohne dass jemand erst ein Passwort
-- sucht. Das ist der Unterschied zwischen einer Rückmeldequote von 50 % und 90 %.
--
-- Damit das kein Scheunentor wird, ist der Token eng gefasst:
--   * ein Zufallswert von 128 Bit, nicht zu erraten,
--   * gültig für genau eine Person, eine Handlung und ein Objekt,
--   * einmal benutzbar,
--   * spätestens zum Spielbeginn abgelaufen,
--   * für niemanden über die API lesbar.
--
-- Er ersetzt keine Anmeldung: mehr als diese eine Antwort kann man damit nicht.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_answer_action_token(p_token UUID, p_answer TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_token  public.action_tokens%ROWTYPE;
    v_match  public.matches%ROWTYPE;
    v_team   public.teams%ROWTYPE;
    v_name   TEXT;
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

        -- Dieselbe Wirkung wie `rpc_set_match_response`, nur im Namen des Tokens.
        -- `source = 'link'` hält fest, woher die Antwort kam.
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

    -- substitute_answer, event_response und poll_vote folgen in ihren Phasen.
    RETURN jsonb_build_object('status', 'not_supported');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) FROM PUBLIC;
-- Bewusst auch für `anon`: der ganze Sinn ist, dass man nicht angemeldet sein muss.
GRANT EXECUTE ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) TO anon, authenticated;

-- Zeigt, worum es bei einem Token geht, ohne ihn zu verbrauchen — damit die Seite
-- „Zusage für 1. Herren gegen TTC Nachbarstadt?" fragen kann, statt blind zu handeln.
CREATE OR REPLACE FUNCTION public.rpc_describe_action_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_token public.action_tokens%ROWTYPE;
    v_match public.matches%ROWTYPE;
    v_team  TEXT;
BEGIN
    SELECT * INTO v_token FROM public.action_tokens WHERE token = p_token;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown'); END IF;
    IF v_token.used_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'used'); END IF;
    IF v_token.expires_at < NOW() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

    IF v_token.action = 'match_response' THEN
        SELECT * INTO v_match FROM public.matches WHERE id = v_token.target_id;
        IF NOT FOUND OR NOT v_match.active THEN
            RETURN jsonb_build_object('status', 'gone');
        END IF;

        SELECT name INTO v_team FROM public.teams WHERE id = v_match.team_id;

        RETURN jsonb_build_object(
            'status',  'ok',
            'action',  'match_response',
            'summary', format(
                '%s gegen %s am %s um %s Uhr',
                v_team,
                COALESCE(NULLIF(v_match.opponent, ''), 'unbekannt'),
                to_char(v_match.dtstart AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
                to_char(v_match.dtstart AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
            )
        );
    END IF;

    RETURN jsonb_build_object('status', 'not_supported');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_describe_action_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_describe_action_token(UUID) TO anon, authenticated;
