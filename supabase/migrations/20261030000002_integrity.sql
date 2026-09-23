-- ============================================================================
-- Nebenläufigkeit, Zeitzone und Spaltenschutz (Code-Review M-6, N-1, N-3, N-4, N-9)
--
--   1. Teilnehmergrenzen und Einmal-Token: Zeilensperre vor der Prüfung
--   2. Fristen nach deutscher Zeit (berlin_today statt CURRENT_DATE)
--   3. Mannschaftsführer ändern keine Abgleich-Spalten eines Spiels
--   4. Nachrichten bleiben an dem Objekt, an dem sie geschrieben wurden
--   5. Umfrage: doppelte und unbekannte Optionen sauber behandeln
--
-- Die Funktionen sind aus ihrer letzten Fassung übernommen; geändert sind nur die
-- kommentierten Stellen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. + 2. Sperren und Fristen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_set_training_attendance(p_session_id uuid, p_status attendance_status, p_guests integer DEFAULT 0, p_profile_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_me       UUID := auth.uid();
    v_target   UUID := COALESCE(p_profile_id, auth.uid());
    v_session  public.training_sessions%ROWTYPE;
    v_training public.trainings%ROWTYPE;
    v_manages  BOOLEAN;
    v_guests   INTEGER := COALESCE(p_guests, 0);
    v_taken    INTEGER;
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

    v_manages := public.is_admin() OR public.trains(v_training.id);

    -- Für andere melden dürfen nur Trainer und Admin.
    IF v_target <> v_me AND NOT v_manages THEN
        RAISE EXCEPTION 'Nur Trainer und Administratoren melden andere zum Training.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_session.cancelled THEN
        RAISE EXCEPTION 'Dieser Trainingstermin fällt aus.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Zuordnung: entweder das Training ist offen, oder die Person gehört dazu.
    IF NOT v_manages
       AND NOT v_training.is_open
       AND NOT EXISTS (
           SELECT 1 FROM public.training_members
            WHERE training_id = v_training.id AND profile_id = v_target
       ) THEN
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

    INSERT INTO public.training_attendance
        (session_id, profile_id, status, guests, source, updated_by)
    VALUES
        (p_session_id, v_target, p_status, v_guests,
         CASE WHEN v_target = v_me THEN 'self' ELSE 'trainer' END::public.attendance_source,
         v_me)
    ON CONFLICT (session_id, profile_id) DO UPDATE
       SET status     = EXCLUDED.status,
           guests     = EXCLUDED.guests,
           source     = EXCLUDED.source,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_event_answer(p_event_id uuid, p_profile_id uuid, p_answer text, p_guests integer DEFAULT 0, p_source attendance_source DEFAULT 'self'::attendance_source)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_event  public.club_events%ROWTYPE;
    v_guests INTEGER := GREATEST(COALESCE(p_guests, 0), 0);
    v_taken  INTEGER;
BEGIN
    IF p_answer NOT IN ('yes', 'no') THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    SELECT * INTO v_event FROM public.club_events WHERE id = p_event_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'gone');
    END IF;

    IF v_event.starts_at <= NOW() THEN
        RETURN jsonb_build_object('status', 'closed');
    END IF;

    IF v_event.participate_until IS NOT NULL
       AND public.berlin_today() > v_event.participate_until THEN
        RETURN jsonb_build_object('status', 'closed');
    END IF;

    -- Teilnehmergrenze: Gäste zählen mit, die eigene alte Zusage nicht.
    IF v_event.max_participants IS NOT NULL AND p_answer = 'yes' THEN
        SELECT COALESCE(SUM(1 + guests), 0) INTO v_taken
          FROM public.event_participations
         WHERE event_id = p_event_id AND status = 'yes' AND profile_id <> p_profile_id;

        IF v_taken + 1 + v_guests > v_event.max_participants THEN
            RETURN jsonb_build_object('status', 'full', 'taken', v_taken,
                                      'max', v_event.max_participants);
        END IF;
    END IF;

    INSERT INTO public.event_participations (event_id, profile_id, status, guests, source)
    VALUES (p_event_id, p_profile_id, p_answer::public.event_status, v_guests, p_source)
    ON CONFLICT (event_id, profile_id) DO UPDATE
       SET status     = EXCLUDED.status,
           guests     = EXCLUDED.guests,
           source     = EXCLUDED.source,
           updated_at = NOW();

    RETURN jsonb_build_object(
        'status',  'ok',
        'answer',  p_answer,
        'summary', format(
            '%s am %s%s',
            v_event.name,
            to_char(v_event.starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
            CASE WHEN v_event.full_day THEN ''
                 ELSE ' um ' || to_char(v_event.starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
                      || ' Uhr' END
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_answer_action_token(p_token uuid, p_answer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_token  public.action_tokens%ROWTYPE;
    v_match  public.matches%ROWTYPE;
    v_team   public.teams%ROWTYPE;
    v_name   TEXT;
    v_result JSONB;
BEGIN
    -- FOR UPDATE: „einmal benutzbar" gilt auch bei zwei gleichzeitigen Klicks.
    SELECT * INTO v_token FROM public.action_tokens WHERE token = p_token FOR UPDATE;

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
           AND public.berlin_today() > v_team.block_participants_after THEN
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

    IF v_token.action = 'event_response' THEN
        -- Gäste lassen sich über einen Link nicht angeben; wer welche mitbringt, sagt
        -- das in der Anwendung. Eine bestehende Gästezahl bleibt dabei erhalten.
        v_result := public.apply_event_answer(
            v_token.target_id,
            v_token.profile_id,
            p_answer,
            COALESCE((
                SELECT guests FROM public.event_participations
                 WHERE event_id = v_token.target_id AND profile_id = v_token.profile_id
            ), 0),
            'link'
        );

        IF v_result ->> 'status' = 'ok' THEN
            UPDATE public.action_tokens SET used_at = NOW() WHERE token = p_token;
        END IF;

        RETURN v_result;
    END IF;

    RETURN jsonb_build_object('status', 'not_supported');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_set_match_response(p_match_id uuid, p_response participation_response, p_comment text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_me       UUID := auth.uid();
    v_match    public.matches%ROWTYPE;
    v_team     public.teams%ROWTYPE;
    v_old      public.participation_response;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können zu- oder absagen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND OR NOT v_match.active THEN
        RAISE EXCEPTION 'Diesen Spieltermin gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_match.team_id;

    -- Meldeschluss der Mannschaft.
    IF v_team.block_participants_after IS NOT NULL
       AND public.berlin_today() > v_team.block_participants_after THEN
        RAISE EXCEPTION
            'Für diese Mannschaft ist die Rückmeldung seit dem % geschlossen. Bitte wende dich an deinen Mannschaftsführer.',
            to_char(v_team.block_participants_after, 'DD.MM.YYYY')
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT response INTO v_old
      FROM public.match_participations
     WHERE match_id = p_match_id AND profile_id = v_me;

    INSERT INTO public.match_participations AS mp
        (match_id, profile_id, response, version_responded, comment, source, updated_by)
    VALUES
        (p_match_id, v_me, p_response, v_match.version, COALESCE(p_comment, ''), 'self', v_me)
    ON CONFLICT (match_id, profile_id) DO UPDATE
       SET response          = EXCLUDED.response,
           version_responded = EXCLUDED.version_responded,
           comment           = EXCLUDED.comment,
           source            = 'self',
           updated_by        = v_me,
           -- Eine eigene Zusage hebt die Entfernung durch den MF nicht auf.
           removed           = mp.removed;

    INSERT INTO public.match_changes (match_id, change_type, old_value, new_value, actor)
    VALUES (
        p_match_id,
        'response',
        jsonb_build_object('profile_id', v_me, 'response', v_old),
        jsonb_build_object('profile_id', v_me, 'response', p_response),
        v_me
    );

    PERFORM public.recompute_lineup(p_match_id);
END;
$$;

CREATE OR REPLACE VIEW public.v_open_participations
WITH (security_invoker = true) AS
SELECT mp.profile_id,
    'match'::text AS kind,
    m.id,
    m.dtstart AS starts_at,
    (t.name || ' gegen '::text) || COALESCE(NULLIF(m.opponent, ''::text), 'unbekannt'::text) AS title
   FROM match_participations mp
     JOIN matches m ON m.id = mp.match_id
     JOIN teams t ON t.id = m.team_id
     JOIN profiles p ON p.id = mp.profile_id
  WHERE m.active AND m.dtstart > now() AND p.deleted_at IS NULL AND NOT p.no_games AND NOT mp.removed AND (mp.response = 'none'::participation_response OR COALESCE(mp.version_responded, 0) < m.version)
UNION ALL
 SELECT tm.profile_id,
    'training'::text AS kind,
    s.id,
    s.starts_at,
    tr.name AS title
   FROM training_sessions s
     JOIN trainings tr ON tr.id = s.training_id
     JOIN training_members tm ON tm.training_id = tr.id
     JOIN profiles p ON p.id = tm.profile_id
  WHERE tr.active AND NOT s.cancelled AND s.starts_at > now() AND p.deleted_at IS NULL AND NOT (EXISTS ( SELECT 1
           FROM training_attendance a
          WHERE a.session_id = s.id AND a.profile_id = tm.profile_id))
UNION ALL
 SELECT p.id AS profile_id,
    'event'::text AS kind,
    e.id,
    e.starts_at,
    e.name AS title
   FROM club_events e
     CROSS JOIN profiles p
  WHERE e.starts_at > now() AND p.deleted_at IS NULL AND p.status = 'active'::member_status AND (e.participate_until IS NULL OR e.participate_until >= public.berlin_today()) AND NOT (EXISTS ( SELECT 1
           FROM event_participations ep
          WHERE ep.event_id = e.id AND ep.profile_id = p.id));

-- ----------------------------------------------------------------------------
-- 3. Abgleich-Spalten eines Spiels
--
-- matches_update erlaubt Mannschaftsführern das Ändern ihrer Spiele — bisher jeder
-- Spalte. Ein zurückgesetztes `version` ließe alte Zusagen wieder gelten, eine
-- geänderte `external_uid` oder `source` risse das Spiel aus dem Kalenderabgleich.
--
-- Bewusst SECURITY INVOKER: current_user ist dann `authenticated` bei einem Aufruf
-- über die API, aber der Eigentümer, wenn eine SECURITY-DEFINER-Funktion (Verlegung,
-- Aufstellung) das Spiel ändert. Nur der direkte Weg wird eingeschränkt.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_match_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_user <> 'authenticated' OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.version IS DISTINCT FROM OLD.version
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.external_uid IS DISTINCT FROM OLD.external_uid
       OR NEW.last_synced_at IS DISTINCT FROM OLD.last_synced_at
    THEN
        RAISE EXCEPTION
            'Fassung, Herkunft und Abgleichsdaten eines Spiels ändert nur der Kalenderabgleich oder ein Administrator.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_protect_columns ON public.matches;
CREATE TRIGGER matches_protect_columns
    BEFORE UPDATE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.protect_match_columns();

-- ----------------------------------------------------------------------------
-- 4. Nachrichten
--
-- Beim Bearbeiten prüfte die Policy nur den Autor. Über object_type/object_id ließ
-- sich eine Nachricht an ein Objekt hängen, das man gar nicht sehen darf.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS object_messages_update ON public.object_messages;
CREATE POLICY object_messages_update ON public.object_messages
    FOR UPDATE TO authenticated
    USING (author_id = auth.uid())
    WITH CHECK (
        author_id = auth.uid()
        AND public.can_see_message_object(object_type, object_id)
    );

-- ----------------------------------------------------------------------------
-- 5. Umfrage
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_vote_poll(p_option_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_me      UUID := auth.uid();
    v_options UUID[];
    v_polls   UUID[];
    v_poll    public.polls%ROWTYPE;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können abstimmen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Nur Optionen, die es gibt, und jede nur einmal: Doppelte IDs zählten sonst
    -- doppelt gegen max_answers, unbekannte endeten in einem Fremdschlüsselfehler.
    SELECT COALESCE(array_agg(DISTINCT o.id), ARRAY[]::UUID[]) INTO v_options
      FROM public.poll_options o
     WHERE o.id = ANY (COALESCE(p_option_ids, ARRAY[]::UUID[]));

    IF cardinality(v_options) < cardinality(ARRAY(SELECT DISTINCT unnest(COALESCE(p_option_ids, ARRAY[]::UUID[])))) THEN
        RETURN jsonb_build_object('status', 'unknown_option');
    END IF;

    SELECT array_agg(DISTINCT o.poll_id) INTO v_polls
      FROM public.poll_options o
     WHERE o.id = ANY (v_options);

    -- Eine leere Auswahl zieht die eigene Stimme zurück. Dafür muss aber klar sein,
    -- aus welcher Umfrage — deshalb geht es nur mit mindestens einer Option.
    IF v_polls IS NULL OR array_length(v_polls, 1) IS NULL THEN
        RETURN jsonb_build_object('status', 'unknown_option');
    END IF;

    IF array_length(v_polls, 1) > 1 THEN
        RETURN jsonb_build_object('status', 'mixed_polls');
    END IF;

    SELECT * INTO v_poll FROM public.polls WHERE id = v_polls[1];
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'gone');
    END IF;

    IF v_poll.expires_at IS NOT NULL AND v_poll.expires_at < NOW() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    IF NOT public.is_poll_target(v_poll.id) THEN
        RETURN jsonb_build_object('status', 'not_invited');
    END IF;

    IF array_length(v_options, 1) > v_poll.max_answers THEN
        RETURN jsonb_build_object(
            'status', 'too_many', 'max', v_poll.max_answers
        );
    END IF;

    -- Die Stimme wird ersetzt, nicht ergänzt: Wer umentscheidet, soll nicht erst
    -- abwählen müssen.
    DELETE FROM public.poll_votes v
     USING public.poll_options o
     WHERE v.option_id = o.id
       AND o.poll_id = v_poll.id
       AND v.profile_id = v_me;

    INSERT INTO public.poll_votes (option_id, profile_id)
    SELECT unnest(v_options), v_me
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('status', 'ok', 'count', array_length(v_options, 1));
END;
$$;
