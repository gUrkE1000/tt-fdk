-- ============================================================================
-- Benachrichtigungen führen auch auf die Seite des Termins
-- (Vereinsentscheidung 27.09.2026, docs/offene-entscheidungen.md E-2, Möglichkeit 1)
--
-- Der Antwort-Link `/r/…` gilt einmal. Wer nach der Antwort noch einmal tippt, etwa
-- um nachzusehen, wer fährt, las bisher „Über diesen Link wurde schon geantwortet"
-- und musste das Spiel selbst suchen. Jetzt:
--
--   1. Die Nutzlasten von Spiel, Trainingstermin und Vereinstermin tragen `page`,
--      die Adresse der Seite (`/match/…`, `/training/…`, `/event/…`).
--   2. E-Mails mit Antwort-Link bekommen darunter eine Zeile „Ansehen: …".
--   3. Benachrichtigungen ohne Antwort (Ausfall, Nachricht am Termin, Ersatz
--      gefunden …) führen auf die Seite statt auf die Startseite.
--   4. Das Antippen einer Push-Nachricht öffnet die Seite (`pushMessage.ts`), der
--      Verlauf der Mitteilungen ebenso (`history.ts`). Dort lässt sich angemeldet
--      genauso antworten, und die Seite gilt auch nach der Antwort noch.
--
-- Die Vorlagen bleiben unverändert: Die zweite Zeile hängt `enqueue_notification`
-- an, damit keine Vorlage sie vergessen kann.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nutzlasten mit Seitenadresse
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_payload(p_match_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'team',      t.name,
        'opponent',  NULLIF(m.opponent, ''),
        'league',    NULLIF(m.league, ''),
        'home_away', CASE WHEN m.is_home THEN 'Heimspiel' ELSE 'Auswärtsspiel' END,
        'date',      to_char(m.dtstart AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
        'time',      to_char(m.dtstart AT TIME ZONE 'Europe/Berlin', 'HH24:MI'),
        'action',    'match_response',
        'target_id', m.id,
        -- Der Antwortlink ist nach dem Spiel wertlos.
        'expires_at', m.dtstart,
        'page',      COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
                         || '/match/' || m.id::text
    )
    FROM public.matches m
    JOIN public.teams t ON t.id = m.team_id
    WHERE m.id = p_match_id;
$$;

CREATE OR REPLACE FUNCTION public.training_payload(p_session_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'training', t.name,
        'date',     to_char(s.starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
        'time',     to_char(s.starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI'),
        'venue',    COALESCE(v.name, ''),
        'page',     COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
                        || '/training/' || s.id::text
    )
    FROM public.training_sessions s
    JOIN public.trainings t ON t.id = s.training_id
    LEFT JOIN public.venues v ON v.id = t.venue_id
    WHERE s.id = p_session_id;
$$;

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
        'expires_at', e.starts_at,
        'page',       COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
                          || '/event/' || e.id::text
    )
    FROM public.club_events e
    WHERE e.id = p_event_id;
$$;

-- ----------------------------------------------------------------------------
-- 2. Nachricht am Termin: auf die Seite des Termins
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_object_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_title    TEXT;
    v_starts   TIMESTAMPTZ;
    v_profile  UUID;
    v_page     TEXT;
BEGIN
    IF NEW.object_type = 'match' THEN
        SELECT t.name || ' gegen ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt'), m.dtstart
          INTO v_title, v_starts
          FROM public.matches m JOIN public.teams t ON t.id = m.team_id
         WHERE m.id = NEW.object_id;
        v_page := '/match/';

    ELSIF NEW.object_type = 'session' THEN
        SELECT tr.name, s.starts_at
          INTO v_title, v_starts
          FROM public.training_sessions s JOIN public.trainings tr ON tr.id = s.training_id
         WHERE s.id = NEW.object_id;
        v_page := '/training/';

    ELSE
        SELECT e.name, e.starts_at
          INTO v_title, v_starts
          FROM public.club_events e
         WHERE e.id = NEW.object_id;
        v_page := '/event/';
    END IF;

    -- Zu einem Termin, der vorbei ist, muss niemand mehr geweckt werden.
    IF v_starts IS NULL OR v_starts < NOW() THEN
        RETURN NEW;
    END IF;

    v_page := COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
              || v_page || NEW.object_id::text;

    FOR v_profile IN
        SELECT DISTINCT profile_id FROM (
            SELECT mp.profile_id
              FROM public.match_participations mp
             WHERE NEW.object_type = 'match'
               AND mp.match_id = NEW.object_id
               AND NOT mp.removed

            UNION

            SELECT a.profile_id
              FROM public.training_attendance a
             WHERE NEW.object_type = 'session'
               AND a.session_id = NEW.object_id
               AND a.status IN ('yes', 'late')

            UNION

            SELECT ep.profile_id
              FROM public.event_participations ep
             WHERE NEW.object_type = 'event'
               AND ep.event_id = NEW.object_id
               -- `event_status` kennt nur yes/no, kein „später".
               AND ep.status = 'yes'
        ) beteiligte
         WHERE profile_id <> NEW.author_id
    LOOP
        PERFORM public.enqueue_notification(
            v_profile,
            'object_message',
            jsonb_build_object('title', COALESCE(v_title, 'Termin'), 'page', v_page)
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Einreihen: Link auf die Seite, wo kein Antwort-Link ist; sonst zweite Zeile
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_notification(
    p_profile     UUID,
    p_type        TEXT,
    p_payload     JSONB DEFAULT '{}'::jsonb,
    p_force_email BOOLEAN DEFAULT false,
    p_scheduled   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_template public.notification_templates%ROWTYPE;
    v_profile  public.profiles%ROWTYPE;
    v_email    BOOLEAN;
    v_push     BOOLEAN;
    v_payload  JSONB;
    v_token    UUID;
    v_app_url  TEXT;
    v_page     TEXT;
    v_subject  TEXT;
    v_body     TEXT;
    v_count    INTEGER := 0;
BEGIN
    SELECT * INTO v_template FROM public.notification_templates WHERE type = p_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unbekannter Benachrichtigungstyp: %', p_type
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN 0;   -- gelöschte Mitglieder bekommen nichts mehr
    END IF;

    -- Fehlende Zeile heißt „beides an".
    SELECT np.email, np.push INTO v_email, v_push
      FROM public.notification_preferences np
     WHERE np.profile_id = p_profile AND np.type = p_type;

    v_email := COALESCE(v_email, true) OR p_force_email;
    v_push  := COALESCE(v_push, true);

    -- Eine Direkt-E-Mail ist nicht abwählbar, ein Hinweis in der App schon.
    IF NOT v_template.in_matrix THEN
        v_email := true;
    END IF;

    v_payload := COALESCE(p_payload, '{}'::jsonb);
    v_payload := v_payload || jsonb_build_object('first_name', v_profile.first_name);

    -- Kopie-Adressen der Person (typisch: Eltern).
    IF array_length(v_profile.emails_copies, 1) > 0 THEN
        v_payload := v_payload || jsonb_build_object('cc', to_jsonb(v_profile.emails_copies));
    END IF;

    SELECT value INTO v_app_url FROM public.club_settings WHERE key = 'app_url';
    v_page := NULLIF(v_payload ->> 'page', '');

    -- Ein Aktions-Token macht aus dem Link eine Antwortmöglichkeit ohne Anmeldung.
    IF v_payload ? 'action' AND v_payload ? 'target_id' THEN
        INSERT INTO public.action_tokens (profile_id, action, target_id, expires_at)
        VALUES (
            p_profile,
            (v_payload ->> 'action')::public.action_token_kind,
            (v_payload ->> 'target_id')::UUID,
            COALESCE((v_payload ->> 'expires_at')::TIMESTAMPTZ, NOW() + INTERVAL '30 days')
        )
        RETURNING token INTO v_token;

        v_payload := v_payload || jsonb_build_object(
            'link', COALESCE(v_app_url, '') || '/r/' || v_token::text,
            'token', v_token
        );
    -- Ohne eigenes Ziel führte der Link bisher auf die Startseite. Gehört die
    -- Nachricht zu einem Termin, ist dessen Seite das bessere Ziel.
    ELSIF NOT (v_payload ? 'link')
          OR v_payload ->> 'link' IN (COALESCE(v_app_url, ''), COALESCE(v_app_url, '') || '/') THEN
        v_payload := v_payload || jsonb_build_object('link', COALESCE(v_page, v_app_url, ''));
    END IF;

    v_subject := public.render_template(v_template.subject_tpl, v_payload);
    v_body    := public.render_template(v_template.body_tpl, v_payload);

    -- Der Antwort-Link gilt einmal, die Seite immer. Führt der Link schon auf die
    -- Seite, wäre die Zeile doppelt.
    IF v_page IS NOT NULL AND v_page IS DISTINCT FROM v_payload ->> 'link' THEN
        v_body := v_body || E'\n\nAnsehen: ' || v_page;
    END IF;

    IF v_email AND v_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications
            (profile_id, channel, type, subject, body_text, payload, scheduled_for)
        VALUES (p_profile, 'email', p_type, v_subject, v_body, v_payload, p_scheduled);
        v_count := v_count + 1;
    END IF;

    IF v_push THEN
        INSERT INTO public.notifications
            (profile_id, channel, type, subject, body_text, payload, scheduled_for)
        VALUES (p_profile, 'push', p_type, v_subject, v_body, v_payload, p_scheduled);
        v_count := v_count + 1;
    END IF;

    RETURN v_count;
END;
$$;
