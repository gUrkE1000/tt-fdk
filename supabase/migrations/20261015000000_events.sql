-- ============================================================================
-- Vereinstermine (Aufgabe 7.1, Zielbild 3.5)
--
-- Clubmeisterschaft, Sommerfest, Jahreshauptversammlung: Termine, die den ganzen
-- Verein angehen und zu denen man sich anmeldet.
--
-- Zwei Dinge unterscheiden sie vom Spieltermin:
--
--   1. Es gibt eine **Anmeldefrist** (`participate_until`) und oft eine
--      Teilnehmergrenze. Beides muss zusammen mit der Antwort geprüft werden —
--      deshalb geht auch hier jede Änderung durch eine Funktion und nicht durch
--      eine Policy.
--   2. Es gibt **Gäste**. Wer zum Sommerfest zwei Leute mitbringt, belegt drei
--      Plätze; die Grenze zählt sie deshalb mit.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Aufzählung
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
        -- Nur zwei Antworten, anders als beim Spiel: „unsicher" hilft beim Grillfest
        -- niemandem weiter, weil man nicht nachbesetzen kann.
        CREATE TYPE public.event_status AS ENUM ('yes', 'no');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tabellen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,

    full_day          BOOLEAN NOT NULL DEFAULT false,
    starts_at         TIMESTAMPTZ NOT NULL,
    ends_at           TIMESTAMPTZ,

    -- Anmeldefrist. NULL heißt: bis zum Beginn.
    participate_until DATE,
    max_participants  INTEGER,

    address           TEXT NOT NULL DEFAULT '',
    -- Einfacher Rich-Text (fett, kursiv, Listen, Links). Bewusst kein beliebiges
    -- HTML: die Anzeige bereinigt, was hier steht.
    description_html  TEXT NOT NULL DEFAULT '',

    hide_in_my_club   BOOLEAN NOT NULL DEFAULT false,
    exclude_calendar  BOOLEAN NOT NULL DEFAULT false,

    created_by        UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    reminder_sent_at  TIMESTAMPTZ,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT club_events_range_check CHECK (ends_at IS NULL OR ends_at >= starts_at),
    CONSTRAINT club_events_max_check   CHECK (max_participants IS NULL OR max_participants > 0)
);

CREATE INDEX IF NOT EXISTS club_events_starts_idx ON public.club_events (starts_at);

DROP TRIGGER IF EXISTS club_events_updated_at ON public.club_events;
CREATE TRIGGER club_events_updated_at
    BEFORE UPDATE ON public.club_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.event_participations (
    event_id   UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status     public.event_status NOT NULL,
    guests     INTEGER NOT NULL DEFAULT 0,
    source     public.attendance_source NOT NULL DEFAULT 'self',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (event_id, profile_id),
    CONSTRAINT event_participations_guests_check CHECK (guests BETWEEN 0 AND 20)
);

CREATE INDEX IF NOT EXISTS event_participations_profile_idx
    ON public.event_participations (profile_id);

DROP TRIGGER IF EXISTS event_participations_updated_at ON public.event_participations;
CREATE TRIGGER event_participations_updated_at
    BEFORE UPDATE ON public.event_participations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Nutzlast für Benachrichtigungen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.event_payload(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'event',      e.name,
        'date',       to_char(e.starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
        'time',       CASE WHEN e.full_day THEN 'ganztägig'
                           ELSE to_char(e.starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') END,
        'address',    NULLIF(e.address, ''),
        'action',     'event_response',
        'target_id',  e.id,
        -- Nach dem Termin ist der Antwortlink wertlos.
        'expires_at', e.starts_at
    )
    FROM public.club_events e
    WHERE e.id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.event_payload(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_payload(UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Antworten
--
-- Wie bei der Ersatzanfrage nimmt die Funktion die handelnde Person als Parameter.
-- So gehen die Oberfläche und der Link aus der E-Mail denselben Weg, und die
-- Prüfungen stehen genau einmal da.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_event_answer(
    p_event_id   UUID,
    p_profile_id UUID,
    p_answer     TEXT,
    p_guests     INTEGER DEFAULT 0,
    p_source     public.attendance_source DEFAULT 'self'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_event  public.club_events%ROWTYPE;
    v_guests INTEGER := GREATEST(COALESCE(p_guests, 0), 0);
    v_taken  INTEGER;
BEGIN
    IF p_answer NOT IN ('yes', 'no') THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    SELECT * INTO v_event FROM public.club_events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'gone');
    END IF;

    IF v_event.starts_at <= NOW() THEN
        RETURN jsonb_build_object('status', 'closed');
    END IF;

    IF v_event.participate_until IS NOT NULL
       AND CURRENT_DATE > v_event.participate_until THEN
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

CREATE OR REPLACE FUNCTION public.rpc_set_event_participation(
    p_event_id UUID,
    p_status   public.event_status,
    p_guests   INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können sich zu Vereinsterminen melden.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN public.apply_event_answer(p_event_id, auth.uid(), p_status::TEXT, p_guests, 'self');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_event_answer(UUID, UUID, TEXT, INTEGER, public.attendance_source)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_set_event_participation(UUID, public.event_status, INTEGER)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_event_answer(UUID, UUID, TEXT, INTEGER, public.attendance_source)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_set_event_participation(UUID, public.event_status, INTEGER)
    TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Einladung und Erinnerung
-- ----------------------------------------------------------------------------

/*
 * Der TT-Planer hat im Anlegen-Dialog keine Adressatenauswahl, kennt aber den Typ
 * „Einladung für Vereinstermin". Eingeladen wird deshalb der ganze Verein — ein
 * Vereinstermin geht alle an. Wer keine Einladungen will, schaltet den Typ in seiner
 * Matrix ab; dafür ist sie da.
 */
CREATE OR REPLACE FUNCTION public.notify_event_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_payload JSONB;
    v_person  RECORD;
BEGIN
    -- Beim ersten Import einer laufenden Saison kämen sonst Einladungen zu Terminen,
    -- die längst vorbei sind.
    IF NEW.starts_at < NOW() THEN RETURN NEW; END IF;

    v_payload := public.event_payload(NEW.id);

    FOR v_person IN
        SELECT id FROM public.profiles WHERE deleted_at IS NULL AND status = 'active'
    LOOP
        PERFORM public.enqueue_notification(v_person.id, 'event_invitation', v_payload);
    END LOOP;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_event_created() FROM PUBLIC;

DROP TRIGGER IF EXISTS club_events_invite ON public.club_events;
CREATE TRIGGER club_events_invite
    AFTER INSERT ON public.club_events
    FOR EACH ROW EXECUTE FUNCTION public.notify_event_created();

-- Die Erinnerung geht an die Zusagenden: Wer abgesagt hat, braucht keine.
CREATE OR REPLACE FUNCTION public.enqueue_event_reminder(p_event_id UUID, p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.enqueue_notification(
        p_profile_id, 'event_reminder', public.event_payload(p_event_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_event_reminder(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_event_reminder(UUID, UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Antwort über den Link aus der E-Mail
--
-- `rpc_answer_action_token` um den Fall `event_response` ergänzt.
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

REVOKE ALL ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_answer_action_token(UUID, TEXT) TO anon, authenticated;

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
-- 7. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.club_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.club_events, public.event_participations
    TO authenticated;

-- Ein Vereinstermin geht alle an, auch Gäste — anders als ein Spieltermin.
DROP POLICY IF EXISTS club_events_select ON public.club_events;
CREATE POLICY club_events_select ON public.club_events
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS club_events_write ON public.club_events;
CREATE POLICY club_events_write ON public.club_events
    FOR ALL TO authenticated
    USING (public.is_organizer_or_admin())
    WITH CHECK (public.is_organizer_or_admin());

-- Lesen dürfen alle, schreiben direkt niemand: jede Antwort geht durch
-- `rpc_set_event_participation` oder den Link aus der E-Mail.
DROP POLICY IF EXISTS event_participations_select ON public.event_participations;
CREATE POLICY event_participations_select ON public.event_participations
    FOR SELECT TO authenticated
    USING (public.is_active_member());

GRANT SELECT, UPDATE ON public.club_events TO service_role;
GRANT SELECT ON public.event_participations TO service_role;

-- ----------------------------------------------------------------------------
-- 8. Sichten
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_event_participants
WITH (security_invoker = true) AS
SELECT
    ep.event_id,
    ep.profile_id,
    p.full_name,
    ep.status,
    ep.guests,
    ep.updated_at
FROM public.event_participations ep
JOIN public.profiles p ON p.id = ep.profile_id;

GRANT SELECT ON public.v_event_participants TO authenticated;

-- Offene Rückmeldungen jetzt auch für Vereinstermine. „Offen" heißt hier: gar keine
-- Zeile — wer abgesagt hat, hat geantwortet.
CREATE OR REPLACE VIEW public.v_open_participations
WITH (security_invoker = true) AS
SELECT
    mp.profile_id,
    'match'::TEXT AS kind,
    m.id          AS id,
    m.dtstart     AS starts_at,
    t.name || ' gegen ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt') AS title
FROM public.match_participations mp
JOIN public.matches m ON m.id = mp.match_id
JOIN public.teams   t ON t.id = m.team_id
JOIN public.profiles p ON p.id = mp.profile_id
WHERE m.active
  AND m.dtstart > NOW()
  AND p.deleted_at IS NULL
  AND NOT p.no_games
  AND NOT mp.removed
  AND (mp.response = 'none' OR COALESCE(mp.version_responded, 0) < m.version)

UNION ALL

SELECT
    tm.profile_id,
    'training'::TEXT AS kind,
    s.id             AS id,
    s.starts_at      AS starts_at,
    tr.name          AS title
FROM public.training_sessions s
JOIN public.trainings tr        ON tr.id = s.training_id
JOIN public.training_members tm ON tm.training_id = tr.id
JOIN public.profiles p          ON p.id = tm.profile_id
WHERE tr.active
  AND NOT s.cancelled
  AND s.starts_at > NOW()
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.training_attendance a
       WHERE a.session_id = s.id AND a.profile_id = tm.profile_id
  )

UNION ALL

SELECT
    p.id        AS profile_id,
    'event'::TEXT AS kind,
    e.id        AS id,
    e.starts_at AS starts_at,
    e.name      AS title
FROM public.club_events e
CROSS JOIN public.profiles p
WHERE e.starts_at > NOW()
  AND p.deleted_at IS NULL
  AND p.status = 'active'
  AND (e.participate_until IS NULL OR e.participate_until >= CURRENT_DATE)
  AND NOT EXISTS (
      SELECT 1 FROM public.event_participations ep
       WHERE ep.event_id = e.id AND ep.profile_id = p.id
  );

GRANT SELECT ON public.v_open_participations TO authenticated;
