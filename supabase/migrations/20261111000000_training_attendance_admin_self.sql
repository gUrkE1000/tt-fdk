-- ============================================================================
-- Trainings: der Administrator meldet sich selbst nach denselben Regeln an
--
-- `rpc_set_training_attendance` behandelte jeden Administrator wie den Trainer
-- des Trainings. Für die eigene Anmeldung hieß das: jedes Training, auch ohne
-- Zuordnung, auch nach Beginn und über die Teilnehmergrenze hinaus.
--
-- Die Ausnahmen gelten jetzt so:
--   * Der Trainer des Trainings: wie bisher, für sich und andere (Nachtragen,
--     Korrigieren nach Beginn).
--   * Ein Administrator, der **andere** meldet oder korrigiert: wie bisher.
--   * Ein Administrator für **sich selbst**: dieselben Regeln wie für alle —
--     Zuordnung, Anmeldeschluss, Teilnehmergrenze.
--
-- Alles andere ist unverändert aus 20261105000001_feedback_round.sql übernommen.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_set_training_attendance(
    p_session_id UUID,
    p_status     public.attendance_status,
    p_guests     INTEGER DEFAULT 0,
    p_profile_id UUID DEFAULT NULL,
    -- NULL = die bisherige Bemerkung bleibt. So löscht eine Zusage per Knopf nicht,
    -- was jemand vorher hineingeschrieben hat.
    p_comment    TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me       UUID := auth.uid();
    v_target   UUID := COALESCE(p_profile_id, auth.uid());
    v_session  public.training_sessions%ROWTYPE;
    v_training public.trainings%ROWTYPE;
    v_manages  BOOLEAN;
    v_guests   INTEGER := COALESCE(p_guests, 0);
    v_taken    INTEGER;
    v_comment  TEXT := NULLIF(btrim(COALESCE(p_comment, '')), '');
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können sich zum Training melden.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- FOR UPDATE: Zwei gleichzeitige Zusagen für den letzten Platz warten aufeinander,
    -- statt beide die Grenze zu unterschreiten.
    SELECT * INTO v_session FROM public.training_sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diesen Trainingstermin gibt es nicht (mehr).'
            USING ERRCODE = 'no_data_found';
    END IF;

    SELECT * INTO v_training FROM public.trainings WHERE id = v_session.training_id;

    -- Trainer immer; ein Administrator nur, wenn er jemand anderen meldet.
    v_manages := public.trains(v_training.id) OR (public.is_admin() AND v_target <> v_me);

    -- Für andere melden dürfen nur Trainer und Admin.
    IF v_target <> v_me AND NOT v_manages THEN
        RAISE EXCEPTION 'Nur Trainer und Administratoren melden andere zum Training.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_session.cancelled THEN
        RAISE EXCEPTION 'Dieser Trainingstermin fällt aus.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Zuordnung: das Training ist offen, die Person gehört dazu, oder sie ist genau
    -- diesem Termin zugeteilt (Systemtraining).
    IF NOT v_manages
       AND NOT v_training.is_open
       AND NOT EXISTS (
           SELECT 1 FROM public.training_members
            WHERE training_id = v_training.id AND profile_id = v_target
       )
       AND NOT public.is_session_participant(p_session_id, v_target) THEN
        RAISE EXCEPTION 'Du bist diesem Training nicht zugeordnet.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Anmeldeschluss ist der Beginn. Trainer dürfen danach noch nachtragen —
    -- sonst ließe sich die Anwesenheit nie korrigieren.
    IF v_session.starts_at <= NOW() AND NOT v_manages THEN
        RAISE EXCEPTION 'Dieser Trainingstermin hat bereits begonnen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_guests < 0 THEN
        v_guests := 0;
    END IF;

    IF p_comment IS NOT NULL AND length(p_comment) > 500 THEN
        RAISE EXCEPTION 'Die Bemerkung darf höchstens 500 Zeichen lang sein.'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Teilnehmergrenze. Gäste zählen mit, die eigene alte Zusage nicht.
    IF v_training.max_participants IS NOT NULL
       AND p_status IN ('yes', 'late')
       AND NOT v_manages THEN
        SELECT COALESCE(SUM(1 + guests), 0) INTO v_taken
          FROM public.training_attendance
         WHERE session_id = p_session_id
           AND status IN ('yes', 'late')
           AND profile_id <> v_target;

        IF v_taken + 1 + v_guests > v_training.max_participants THEN
            RAISE EXCEPTION
                'Für dieses Training sind nur % Plätze vorgesehen, davon sind schon % vergeben.',
                v_training.max_participants, v_taken
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    INSERT INTO public.training_attendance AS ta
        (session_id, profile_id, status, guests, source, updated_by, comment)
    VALUES
        (p_session_id, v_target, p_status, v_guests,
         CASE WHEN v_target = v_me THEN 'self' ELSE 'trainer' END::public.attendance_source,
         v_me, COALESCE(v_comment, ''))
    ON CONFLICT (session_id, profile_id) DO UPDATE
       SET status     = EXCLUDED.status,
           guests     = EXCLUDED.guests,
           source     = EXCLUDED.source,
           updated_by = EXCLUDED.updated_by,
           comment    = CASE WHEN p_comment IS NULL THEN ta.comment
                             ELSE EXCLUDED.comment END,
           updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_training_attendance(UUID, public.attendance_status, INTEGER, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_training_attendance(UUID, public.attendance_status, INTEGER, UUID, TEXT) TO authenticated;
