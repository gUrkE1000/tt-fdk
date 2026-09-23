-- ============================================================================
-- Verbesserungen aus Mitgliedersicht
--
--   1. Bemerkung beim Training („komme erst 19:30") — wie bei der Spielrückmeldung.
--   2. Antwort-Link für die Trainings-Erinnerung: zusagen ohne Anmeldung, wie bei
--      Spielen und Vereinsterminen.
--   3. Der Link der Terminumfrage (Spielverlegung) führt nicht mehr ins Leere: Die
--      Beschreibung kennt ihn wieder, die Seite schickt in die App.
--   4. `v_my_open_polls`: Umfragen, bei denen die eigene Stimme noch fehlt — für die
--      Liste „Offen für dich".
--   5. Neue Umfrage und neue Neuigkeit werden gemeldet, wenn der Veranstalter es will.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bemerkung beim Training
-- ----------------------------------------------------------------------------

ALTER TABLE public.training_attendance
    ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'training_attendance_comment_length'
    ) THEN
        ALTER TABLE public.training_attendance
            ADD CONSTRAINT training_attendance_comment_length CHECK (length(comment) <= 500);
    END IF;
END $$;

-- Spalte hinten angehängt: CREATE OR REPLACE VIEW erlaubt nur das.
CREATE OR REPLACE VIEW public.v_session_participants
WITH (security_invoker = true) AS
SELECT
    a.session_id,
    s.training_id,
    a.profile_id,
    p.full_name,
    a.status,
    a.guests,
    a.source,
    a.updated_at,
    a.comment
  FROM public.training_attendance a
  JOIN public.training_sessions s ON s.id = a.session_id
  JOIN public.profiles p          ON p.id = a.profile_id;

GRANT SELECT ON public.v_session_participants TO authenticated;

-- Neuer Parameter am Ende. Die alte Signatur muss weg, sonst gäbe es zwei Funktionen
-- gleichen Namens und PostgREST wüsste nicht, welche gemeint ist.
DROP FUNCTION IF EXISTS public.rpc_set_training_attendance(UUID, public.attendance_status, INTEGER, UUID);

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

-- ----------------------------------------------------------------------------
-- 2. Antwort-Link für die Trainings-Erinnerung
-- ----------------------------------------------------------------------------

-- Die Erinnerung bekommt jetzt einen Einmal-Link. Die Nutzlast des Ausfalls
-- (`training_cancelled`) bleibt ohne: Auf einen Ausfall gibt es nichts zu antworten.
CREATE OR REPLACE FUNCTION public.enqueue_training_reminder(
    p_session_id UUID,
    p_profile_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.enqueue_notification(
        p_profile_id,
        'training_attendance_request',
        public.training_payload(p_session_id) || (
            SELECT jsonb_build_object(
                'action',     'training_response',
                'target_id',  s.id,
                -- Nach Beginn ist der Link wertlos: dann nimmt auch die App keine
                -- Rückmeldung mehr an.
                'expires_at', s.starts_at
            )
            FROM public.training_sessions s
            WHERE s.id = p_session_id
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_training_reminder(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_training_reminder(UUID, UUID) TO service_role;

/*
 * Eine Trainingsrückmeldung über den Link.
 *
 * Dieselben Regeln wie `rpc_set_training_attendance` für ein Mitglied, das für sich
 * selbst antwortet — nur als Statuswert statt als Fehler, weil die Link-Seite ohne
 * Anmeldung eine verständliche Antwort braucht und keinen Fehlercode. Gäste und
 * Bemerkung bleiben, wie sie waren: Die gibt man in der App an.
 */
CREATE OR REPLACE FUNCTION public.apply_training_answer(
    p_session_id UUID,
    p_profile_id UUID,
    p_answer     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_session  public.training_sessions%ROWTYPE;
    v_training public.trainings%ROWTYPE;
    v_guests   INTEGER;
    v_taken    INTEGER;
BEGIN
    IF p_answer NOT IN ('yes', 'late', 'no') THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    SELECT * INTO v_session FROM public.training_sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'gone');
    END IF;

    SELECT * INTO v_training FROM public.trainings WHERE id = v_session.training_id;
    IF NOT FOUND OR NOT v_training.active THEN
        RETURN jsonb_build_object('status', 'gone');
    END IF;

    IF v_session.cancelled THEN
        RETURN jsonb_build_object('status', 'cancelled');
    END IF;

    IF v_session.starts_at <= NOW() THEN
        RETURN jsonb_build_object('status', 'started');
    END IF;

    IF NOT v_training.is_open
       AND NOT EXISTS (
           SELECT 1 FROM public.training_members
            WHERE training_id = v_training.id AND profile_id = p_profile_id
       )
       AND NOT EXISTS (
           SELECT 1 FROM public.training_trainers
            WHERE training_id = v_training.id AND profile_id = p_profile_id
       ) THEN
        RETURN jsonb_build_object('status', 'not_assigned');
    END IF;

    SELECT guests INTO v_guests
      FROM public.training_attendance
     WHERE session_id = p_session_id AND profile_id = p_profile_id;
    v_guests := COALESCE(v_guests, 0);

    IF v_training.max_participants IS NOT NULL AND p_answer IN ('yes', 'late') THEN
        SELECT COALESCE(SUM(1 + guests), 0) INTO v_taken
          FROM public.training_attendance
         WHERE session_id = p_session_id
           AND status IN ('yes', 'late')
           AND profile_id <> p_profile_id;

        IF v_taken + 1 + v_guests > v_training.max_participants THEN
            RETURN jsonb_build_object('status', 'full');
        END IF;
    END IF;

    INSERT INTO public.training_attendance
        (session_id, profile_id, status, guests, source, updated_by)
    VALUES
        (p_session_id, p_profile_id, p_answer::public.attendance_status, v_guests,
         'link', p_profile_id)
    ON CONFLICT (session_id, profile_id) DO UPDATE
       SET status     = EXCLUDED.status,
           source     = 'link',
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW();

    RETURN jsonb_build_object(
        'status',  'ok',
        'answer',  p_answer,
        'summary', public.training_session_summary(p_session_id)
    );
END;
$$;

-- „Jugendtraining am 03.11.2026 um 18:00 Uhr" — für die Link-Seite.
CREATE OR REPLACE FUNCTION public.training_session_summary(p_session_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT format(
        '%s am %s um %s Uhr',
        t.name,
        to_char(s.starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
        to_char(s.starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
    )
    FROM public.training_sessions s
    JOIN public.trainings t ON t.id = s.training_id
    WHERE s.id = p_session_id;
$$;

REVOKE ALL ON FUNCTION public.apply_training_answer(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.training_session_summary(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2b. Die beiden Link-Funktionen, jetzt mit Training und Terminumfrage
--
-- Abgeschrieben aus 20261030000002_integrity.sql (Antwort) und
-- 20261015000000_events.sql (Beschreibung); neu sind nur die markierten Zweige.
-- ----------------------------------------------------------------------------

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

    -- Neu: Training.
    IF v_token.action = 'training_response' THEN
        v_result := public.apply_training_answer(v_token.target_id, v_token.profile_id, p_answer);

        IF v_result ->> 'status' = 'ok' THEN
            UPDATE public.action_tokens SET used_at = NOW() WHERE token = p_token;
        END IF;

        RETURN v_result;
    END IF;

    RETURN jsonb_build_object('status', 'not_supported');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_describe_action_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_token   public.action_tokens%ROWTYPE;
    v_match   public.matches%ROWTYPE;
    v_team    TEXT;
    v_request public.substitute_requests%ROWTYPE;
    v_event   public.club_events%ROWTYPE;
    v_session public.training_sessions%ROWTYPE;
    v_poll_match UUID;
BEGIN
    SELECT * INTO v_token FROM public.action_tokens WHERE token = p_token;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown'); END IF;
    IF v_token.used_at IS NOT NULL THEN RETURN jsonb_build_object('status', 'used'); END IF;
    IF v_token.expires_at < NOW() THEN RETURN jsonb_build_object('status', 'expired'); END IF;

    IF v_token.action = 'event_response' THEN
        SELECT * INTO v_event FROM public.club_events WHERE id = v_token.target_id;
        IF NOT FOUND THEN RETURN jsonb_build_object('status', 'gone'); END IF;

        RETURN jsonb_build_object(
            'status',  'ok',
            'action',  'event_response',
            'summary', format(
                '%s am %s%s',
                v_event.name,
                to_char(v_event.starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
                CASE WHEN v_event.full_day THEN ''
                     ELSE ' um ' ||
                          to_char(v_event.starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
                          || ' Uhr' END
            )
        );
    END IF;

    -- Neu: Training.
    IF v_token.action = 'training_response' THEN
        SELECT * INTO v_session FROM public.training_sessions WHERE id = v_token.target_id;
        IF NOT FOUND THEN RETURN jsonb_build_object('status', 'gone'); END IF;
        IF v_session.cancelled THEN RETURN jsonb_build_object('status', 'cancelled'); END IF;

        RETURN jsonb_build_object(
            'status',  'ok',
            'action',  'training_response',
            'summary', public.training_session_summary(v_session.id)
        );
    END IF;

    -- Neu: Terminumfrage zur Spielverlegung. Sie hat mehrere Vorschläge und lässt
    -- sich deshalb nicht mit einem Knopf beantworten — die Seite schickt in die App.
    -- Bisher kam hier „wird nicht unterstützt", obwohl die E-Mail den Link enthält.
    IF v_token.action = 'poll_vote' THEN
        SELECT match_id INTO v_poll_match FROM public.reschedule_polls WHERE id = v_token.target_id;
        IF NOT FOUND THEN RETURN jsonb_build_object('status', 'gone'); END IF;

        SELECT * INTO v_match FROM public.matches WHERE id = v_poll_match;
        IF NOT FOUND OR NOT v_match.active THEN
            RETURN jsonb_build_object('status', 'gone');
        END IF;
    ELSIF v_token.action = 'substitute_answer' THEN
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

-- ----------------------------------------------------------------------------
-- 3. Offene Umfragen
--
-- security_invoker: `is_poll_target` und die Policy auf `poll_votes` rechnen mit dem
-- Angemeldeten. Die eigene Stimme sieht jeder, auch bei verborgenen Ergebnissen.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_my_open_polls
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.title,
    p.type,
    p.expires_at,
    p.created_at
  FROM public.polls p
 WHERE (p.expires_at IS NULL OR p.expires_at > NOW())
   AND public.is_poll_target(p.id)
   AND NOT EXISTS (
       SELECT 1
         FROM public.poll_votes v
         JOIN public.poll_options o ON o.id = v.option_id
        WHERE o.poll_id = p.id
          AND v.profile_id = auth.uid()
   );

GRANT SELECT ON public.v_my_open_polls TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Neue Umfrage und neue Neuigkeit melden
--
-- Bewusst kein Trigger beim Einfügen: Eine Umfrage entsteht in drei Schritten
-- (Umfrage, Zielgruppen, Antworten), und erst danach steht fest, wer gemeint ist.
-- Bei Neuigkeiten entscheidet der Verfasser, ob sie eine Meldung wert sind — wer
-- beim Umzug zwanzig alte Neuigkeiten abschreibt, soll nicht zwanzig E-Mails
-- auslösen. Deshalb je ein Aufruf nach dem Speichern, mit Häkchen im Dialog.
--
-- `announced_at` verhindert eine zweite Meldung derselben Sache.
-- ----------------------------------------------------------------------------

ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ;
ALTER TABLE public.news  ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ;

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('poll_created', 'Neue Umfrage',
     'Neue Umfrage: {{title}}',
     E'Hallo {{first_name}},\n\nes gibt eine neue Umfrage: „{{title}}"{{until}}.\n\nHier kannst du abstimmen:\n{{link}}', 16, true),

    ('news_published', 'Neuigkeit aus dem Verein',
     'Neuigkeit: {{title}}',
     E'Hallo {{first_name}},\n\nim Verein gibt es eine Neuigkeit: „{{title}}".\n\nHier kannst du sie lesen:\n{{link}}', 17, true)
ON CONFLICT (type) DO NOTHING;

-- Wen eine Umfrage meint — dieselbe Regel wie `is_poll_target`, aber für jede Person
-- statt nur für den Angemeldeten.
CREATE OR REPLACE FUNCTION public.poll_audience(p_poll_id UUID)
RETURNS TABLE (profile_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT p.id
      FROM public.profiles p
     WHERE p.deleted_at IS NULL
       AND p.status = 'active'
       AND (
           NOT EXISTS (SELECT 1 FROM public.poll_targets WHERE poll_id = p_poll_id)
           OR EXISTS (
               SELECT 1
                 FROM public.poll_targets pt
                 JOIN public.team_members tm ON tm.team_id = pt.team_id
                WHERE pt.poll_id = p_poll_id AND tm.profile_id = p.id
           )
           OR EXISTS (
               SELECT 1
                 FROM public.poll_targets pt
                 JOIN public.group_members gm ON gm.group_id = pt.group_id
                WHERE pt.poll_id = p_poll_id AND gm.profile_id = p.id
           )
       );
$$;

REVOKE ALL ON FUNCTION public.poll_audience(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_announce_poll(p_poll_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_poll    public.polls%ROWTYPE;
    v_app_url TEXT;
    v_payload JSONB;
    v_member  RECORD;
    v_count   INTEGER := 0;
BEGIN
    IF NOT public.is_organizer_or_admin() THEN
        RAISE EXCEPTION 'Nur Veranstalter und Administratoren melden Umfragen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_poll FROM public.polls WHERE id = p_poll_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diese Umfrage gibt es nicht.' USING ERRCODE = 'no_data_found';
    END IF;

    -- Schon gemeldet oder schon vorbei: nichts zu tun.
    IF v_poll.announced_at IS NOT NULL
       OR (v_poll.expires_at IS NOT NULL AND v_poll.expires_at <= NOW()) THEN
        RETURN 0;
    END IF;

    SELECT value INTO v_app_url FROM public.club_settings WHERE key = 'app_url';

    v_payload := jsonb_build_object(
        'title', v_poll.title,
        'until', CASE WHEN v_poll.expires_at IS NULL THEN ''
                      ELSE ' (bis ' ||
                           to_char(v_poll.expires_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY, HH24:MI')
                           || ' Uhr)' END,
        'link',  COALESCE(v_app_url, '') || '/votes'
    );

    FOR v_member IN SELECT profile_id FROM public.poll_audience(p_poll_id) LOOP
        PERFORM public.enqueue_notification(v_member.profile_id, 'poll_created', v_payload);
        v_count := v_count + 1;
    END LOOP;

    UPDATE public.polls SET announced_at = NOW() WHERE id = p_poll_id;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_announce_news(p_news_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_news    public.news%ROWTYPE;
    v_app_url TEXT;
    v_payload JSONB;
    v_member  RECORD;
    v_count   INTEGER := 0;
BEGIN
    IF NOT public.is_organizer_or_admin() THEN
        RAISE EXCEPTION 'Nur Veranstalter und Administratoren melden Neuigkeiten.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_news FROM public.news WHERE id = p_news_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diese Neuigkeit gibt es nicht.' USING ERRCODE = 'no_data_found';
    END IF;

    IF v_news.announced_at IS NOT NULL THEN
        RETURN 0;
    END IF;

    SELECT value INTO v_app_url FROM public.club_settings WHERE key = 'app_url';

    v_payload := jsonb_build_object(
        'title', v_news.title,
        'link',  COALESCE(v_app_url, '') || '/my-club?tab=news'
    );

    -- Eine vordatierte Neuigkeit wird erst gemeldet, wenn sie sichtbar wird.
    FOR v_member IN
        SELECT p.id
          FROM public.profiles p
         WHERE p.deleted_at IS NULL AND p.status = 'active'
    LOOP
        PERFORM public.enqueue_notification(
            v_member.id, 'news_published', v_payload, false,
            GREATEST(v_news.published_at, NOW())
        );
        v_count := v_count + 1;
    END LOOP;

    UPDATE public.news SET announced_at = NOW() WHERE id = p_news_id;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_announce_poll(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_announce_news(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_announce_poll(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_announce_news(UUID) TO authenticated;
