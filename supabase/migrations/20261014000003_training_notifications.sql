-- ============================================================================
-- Benachrichtigungen rund ums Training (Aufgabe 6.6)
--
-- Drei Anlässe:
--
--   1. Die Erinnerung an einen Trainingstermin, `reminder_hours` vorher. Der
--      Hintergrundlauf entscheidet, wer sie bekommt; hier steht nur, wie sie
--      aussieht.
--   2. Ein eingetragener Ausfall. Der trifft alle, die zu dem Training gehören —
--      bei einem Hallenausfall auch mehrere Trainings auf einmal.
--   3. Ein Termin, den `auto_cancel_no_trainers` absagt, weil alle Trainer abgesagt
--      haben. Das ist der Fall, in dem eine Benachrichtigung am meisten wert ist:
--      Sonst stünden zehn Leute vor einer verschlossenen Halle.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nutzlast und Empfängerkreis
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.training_payload(p_session_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'training', t.name,
        'date',     to_char(s.starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
        'time',     to_char(s.starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI'),
        'venue',    COALESCE(v.name, '')
    )
    FROM public.training_sessions s
    JOIN public.trainings t ON t.id = s.training_id
    LEFT JOIN public.venues v ON v.id = t.venue_id
    WHERE s.id = p_session_id;
$$;

/*
 * Wer zu einem Training gehört und deshalb etwas darüber erfahren soll.
 *
 * Bei einem offenen Training sind das alle aktiven Mitglieder — so steht es im
 * Zielbild und so macht es der TT-Planer. Wem das zu viel ist, schränkt über
 * `training_reminder_filter` ein; das ist der Sinn dieser Tabelle.
 */
CREATE OR REPLACE FUNCTION public.training_audience(p_training_id UUID)
RETURNS TABLE (profile_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT p.id
      FROM public.profiles p
     WHERE p.deleted_at IS NULL
       AND p.status = 'active'
       AND (
           EXISTS (
               SELECT 1 FROM public.training_members tm
                WHERE tm.training_id = p_training_id AND tm.profile_id = p.id
           )
           OR EXISTS (
               SELECT 1 FROM public.training_trainers tt
                WHERE tt.training_id = p_training_id AND tt.profile_id = p.id
           )
           OR EXISTS (
               SELECT 1 FROM public.trainings t
                WHERE t.id = p_training_id AND t.is_open
           )
       );
$$;

REVOKE ALL ON FUNCTION public.training_payload(UUID)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.training_audience(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.training_payload(UUID)  TO service_role;
GRANT EXECUTE ON FUNCTION public.training_audience(UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Erinnerung an einen Termin
-- ----------------------------------------------------------------------------

-- Wie beim Spiel: Der Hintergrundlauf kennt nur Termin und Person, die Werte für
-- die Vorlage holt die Datenbank selbst.
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
        public.training_payload(p_session_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_training_reminder(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_training_reminder(UUID, UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Ausfall melden
-- ----------------------------------------------------------------------------

/*
 * Ein Ausfall betrifft einen Zeitraum, keine einzelne Zeile. `date` in der Vorlage
 * nennt deshalb entweder den einen Tag oder die Spanne — eine E-Mail je betroffenem
 * Termin wäre bei zwei Wochen Hallensperrung eine Lawine.
 */
CREATE OR REPLACE FUNCTION public.notify_training_cancelled(
    p_training_id UUID,
    p_from        DATE,
    p_to          DATE,
    p_reason      TEXT,
    p_force_email BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_name    TEXT;
    v_when    TEXT;
    v_payload JSONB;
    v_person  RECORD;
    v_count   INTEGER := 0;
BEGIN
    SELECT name INTO v_name FROM public.trainings WHERE id = p_training_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    v_when := CASE
        WHEN p_to IS NULL OR p_to = p_from THEN to_char(p_from, 'DD.MM.YYYY')
        ELSE to_char(p_from, 'DD.MM.YYYY') || ' bis ' || to_char(p_to, 'DD.MM.YYYY')
    END;

    v_payload := jsonb_build_object(
        'training', v_name,
        'date',     v_when,
        'reason',   COALESCE(NULLIF(p_reason, ''), 'ohne Angabe')
    );

    FOR v_person IN SELECT profile_id FROM public.training_audience(p_training_id) LOOP
        v_count := v_count + public.enqueue_notification(
            v_person.profile_id, 'training_cancelled', v_payload, p_force_email
        );
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_training_cancelled(UUID, DATE, DATE, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_training_cancelled(UUID, DATE, DATE, TEXT, BOOLEAN)
    TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_cancellation_notice()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_training RECORD;
BEGIN
    IF NEW.training_id IS NOT NULL THEN
        PERFORM public.notify_training_cancelled(
            NEW.training_id, NEW.from_date, NEW.to_date, NEW.reason, NEW.notify_email
        );
    ELSE
        -- Ein Hallenausfall trifft jedes Training, das dort stattfindet.
        FOR v_training IN
            SELECT id FROM public.trainings WHERE venue_id = NEW.venue_id AND active
        LOOP
            PERFORM public.notify_training_cancelled(
                v_training.id, NEW.from_date, NEW.to_date, NEW.reason, NEW.notify_email
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_cancellation_notice() FROM PUBLIC;

DROP TRIGGER IF EXISTS training_cancellations_notify ON public.training_cancellations;
CREATE TRIGGER training_cancellations_notify
    AFTER INSERT ON public.training_cancellations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_cancellation_notice();

-- ----------------------------------------------------------------------------
-- 4. Automatische Absage, wenn alle Trainer absagen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_trainers_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_session  public.training_sessions%ROWTYPE;
    v_training public.trainings%ROWTYPE;
    v_trainers INTEGER;
    v_declined INTEGER;
BEGIN
    IF NEW.status <> 'no' THEN RETURN NEW; END IF;

    SELECT * INTO v_session FROM public.training_sessions WHERE id = NEW.session_id;
    IF NOT FOUND OR v_session.cancelled THEN RETURN NEW; END IF;

    SELECT * INTO v_training FROM public.trainings WHERE id = v_session.training_id;
    IF NOT FOUND OR NOT v_training.auto_cancel_no_trainers THEN RETURN NEW; END IF;

    SELECT count(*) INTO v_trainers
      FROM public.training_trainers WHERE training_id = v_training.id;

    -- Ohne Trainer gibt es niemanden, dessen Absage den Termin kippen könnte.
    IF v_trainers = 0 THEN RETURN NEW; END IF;

    SELECT count(*) INTO v_declined
      FROM public.training_trainers tt
      JOIN public.training_attendance a
        ON a.profile_id = tt.profile_id AND a.session_id = NEW.session_id
     WHERE tt.training_id = v_training.id AND a.status = 'no';

    IF v_declined < v_trainers THEN RETURN NEW; END IF;

    UPDATE public.training_sessions
       SET cancelled     = true,
           cancel_reason = 'Alle Trainer haben abgesagt.',
           -- Von Hand abgesagt, nicht aus einem Ausfall-Zeitraum: Der Erzeugungs-Job
           -- nimmt diese Absage deshalb nicht wieder zurück.
           cancellation_id = NULL
     WHERE id = NEW.session_id;

    PERFORM public.notify_training_cancelled(
        v_training.id, v_session.session_date, v_session.session_date,
        'Alle Trainer haben abgesagt.', false
    );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_trainers_cancelled() FROM PUBLIC;

DROP TRIGGER IF EXISTS training_attendance_auto_cancel ON public.training_attendance;
CREATE TRIGGER training_attendance_auto_cancel
    AFTER INSERT OR UPDATE ON public.training_attendance
    FOR EACH ROW EXECUTE FUNCTION public.check_trainers_cancelled();

-- ----------------------------------------------------------------------------
-- 5. Offene Rückmeldungen um Trainings erweitern
--
-- Der tägliche Sammelhinweis nennt jetzt auch Trainingstermine. Bewusst nur die
-- zugeordneten: Ein offenes Training verpflichtet niemanden, und wer nie zusagt,
-- soll deswegen nicht jeden Abend eine E-Mail bekommen.
-- ----------------------------------------------------------------------------

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
JOIN public.trainings tr      ON tr.id = s.training_id
JOIN public.training_members tm ON tm.training_id = tr.id
JOIN public.profiles p        ON p.id = tm.profile_id
WHERE tr.active
  AND NOT s.cancelled
  AND s.starts_at > NOW()
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.training_attendance a
       WHERE a.session_id = s.id AND a.profile_id = tm.profile_id
  );

GRANT SELECT ON public.v_open_participations TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Rechte für den Hintergrundlauf
-- ----------------------------------------------------------------------------

GRANT SELECT, UPDATE ON public.training_sessions TO service_role;
GRANT SELECT ON public.trainings, public.training_members, public.training_trainers,
                 public.training_attendance, public.training_reminder_filter
    TO service_role;
