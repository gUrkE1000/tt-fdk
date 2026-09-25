-- ============================================================================
-- Rückmeldungsrunde mit den Mitgliedern (25.09.2026)
--
--   1. Hallensperre trifft auch Trainings ohne Ort: Ohne Ort gilt der Standardort
--      des Vereins (oder die einzige aktive Halle).
--   2. Spiele sehen alle spielenden Mitglieder wieder — zusagen, sich melden und
--      mitfahren weiterhin nur, wer zur Mannschaft gehört oder angefragt ist
--      (E-1 wird in diesem Punkt zurückgenommen).
--   3. Heimspiel an einem Tag, an dem die Halle gesperrt ist: Nachricht an die
--      Mannschaftsführung, dass das Spiel verlegt werden muss.
--   4. Fahrdienst: „Ich bringe etwas mit" entfällt, „Ich fahre direkt" kommt dazu.
--   5. Schlüsseldienst: Kennzeichen am Mitglied, feste Person je Wochentag,
--      Vertretung für einen einzelnen Tag.
--   6. Systemtraining: Teilnehmer werden je Termin von Hand zugeteilt.
--   7. Neue Trainings sind standardmäßig offen.
--   8. Kalender: ohne Geburtstage, mit Schlüsseldienst und der Spalte `mine`
--      für den Filter „Für mich relevant".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Standardort
-- ----------------------------------------------------------------------------

-- Der Ort, an dem ein Training oder Heimspiel ohne eigenen Ort stattfindet: der in
-- den Vereinsdaten gewählte Standardort, sonst die einzige aktive Halle. Gibt es
-- mehrere Hallen und keinen Standardort, bleibt es NULL — dann lässt sich nicht
-- sagen, wo das Training ist.
CREATE OR REPLACE FUNCTION public.club_default_venue()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT v.id
           FROM public.venues v
           JOIN public.club_settings c ON c.key = 'default_venue_id' AND c.value = v.id::text),
        (SELECT CASE WHEN count(*) = 1 THEN (array_agg(id))[1] END
           FROM public.venues WHERE active)
    );
$$;

REVOKE ALL ON FUNCTION public.club_default_venue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_default_venue() TO authenticated, service_role;

-- Der Hallenausfall benachrichtigt jetzt auch die Trainings ohne Ort.
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
        -- Ein Hallenausfall trifft jedes Training, das dort stattfindet — auch das
        -- ohne eigenen Ort, wenn die Halle der Standardort ist.
        FOR v_training IN
            SELECT id FROM public.trainings
             WHERE COALESCE(venue_id, public.club_default_venue()) = NEW.venue_id
               AND active
        LOOP
            PERFORM public.notify_training_cancelled(
                v_training.id, NEW.from_date, NEW.to_date, NEW.reason, NEW.notify_email
            );
        END LOOP;

        PERFORM public.notify_home_matches_blocked(NEW.id);
    END IF;

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Spiele sehen
--
-- `can_see_match` bleibt, was es seit E-1 heißt: „gehört dazu" (Mannschaft,
-- angefragt, Ersatzanfrage). Daran hängen Zusage, „Ich hätte Zeit", Fahrdienst,
-- Terminumfrage und Nachrichten am Spiel. Nur das Lesen der Spiele selbst, ihrer
-- Rückmeldungen und des Fahrdienstes ist wieder für alle spielenden Mitglieder.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches
    FOR SELECT TO authenticated
    USING (public.is_playing_member());

DROP POLICY IF EXISTS match_participations_select ON public.match_participations;
CREATE POLICY match_participations_select ON public.match_participations
    FOR SELECT TO authenticated
    USING (public.is_playing_member());

DROP POLICY IF EXISTS match_volunteers_select ON public.match_volunteers;
CREATE POLICY match_volunteers_select ON public.match_volunteers
    FOR SELECT TO authenticated
    USING (public.is_playing_member());

-- ----------------------------------------------------------------------------
-- 3. Heimspiel in gesperrter Halle
-- ----------------------------------------------------------------------------

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('match_venue_blocked', 'Heimspiel in gesperrter Halle (Mannschaftsführung)',
     'Halle gesperrt: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\ndie Halle ist am {{date}} gesperrt{{reason}}. Dein Heimspiel {{team}} gegen {{opponent}} um {{time}} Uhr kann dort nicht stattfinden — bitte kümmere dich um eine Verlegung.\n\n{{link}}', 21, true)
ON CONFLICT (type) DO NOTHING;

-- Aktive Heimspiele, die in den Zeitraum einer Hallensperre fallen. Ein Spiel ohne
-- eigenen Ort findet im Standardort statt.
CREATE OR REPLACE FUNCTION public.notify_home_matches_blocked(p_cancellation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_cancel  public.training_cancellations%ROWTYPE;
    v_match   RECORD;
    v_leader  RECORD;
    v_payload JSONB;
    v_count   INTEGER := 0;
BEGIN
    SELECT * INTO v_cancel FROM public.training_cancellations WHERE id = p_cancellation_id;
    IF NOT FOUND OR v_cancel.venue_id IS NULL THEN
        RETURN 0;
    END IF;

    FOR v_match IN
        SELECT m.id, m.team_id
          FROM public.matches m
         WHERE m.active
           AND m.is_home
           AND m.dtstart > NOW()
           AND (m.dtstart AT TIME ZONE 'Europe/Berlin')::date BETWEEN v_cancel.from_date AND v_cancel.to_date
           AND COALESCE(m.venue_id, public.club_default_venue()) = v_cancel.venue_id
    LOOP
        v_payload := public.match_page_payload(v_match.id)
            || jsonb_build_object(
                'reason', CASE WHEN btrim(COALESCE(v_cancel.reason, '')) = '' THEN ''
                               ELSE ' (' || btrim(v_cancel.reason) || ')' END
            );

        FOR v_leader IN
            SELECT tl.profile_id
              FROM public.team_leaders tl
              JOIN public.profiles p ON p.id = tl.profile_id
             WHERE tl.team_id = v_match.team_id
               AND p.deleted_at IS NULL
               AND p.status = 'active'
        LOOP
            PERFORM public.enqueue_notification(v_leader.profile_id, 'match_venue_blocked', v_payload);
            v_count := v_count + 1;
        END LOOP;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_home_matches_blocked(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Fahrdienst: ohne Verpflegung, mit „Ich fahre direkt"
-- ----------------------------------------------------------------------------

-- Die Verpflegung gibt es nicht mehr. Die alten Einträge haben keine Anzeige mehr
-- und würden nur still weiterleben.
DELETE FROM public.match_volunteers WHERE kind = 'catering';

-- „Ich fahre direkt" gibt es nur bei Auswärtsspielen und schließt „Ich kann fahren"
-- aus: Wer direkt fährt, ist nicht am Treffpunkt und nimmt dort niemanden mit.
-- Das Eintragen des einen nimmt das andere zurück, statt einen Fehler zu melden.
CREATE OR REPLACE FUNCTION public.check_match_volunteer()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.kind = 'catering' THEN
        RAISE EXCEPTION 'Die Verpflegung wird nicht mehr eingetragen.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF NEW.kind = 'direct' AND EXISTS (
        SELECT 1 FROM public.matches WHERE id = NEW.match_id AND is_home
    ) THEN
        RAISE EXCEPTION '„Ich fahre direkt" gibt es nur bei Auswärtsspielen.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    DELETE FROM public.match_volunteers
     WHERE match_id = NEW.match_id
       AND profile_id = NEW.profile_id
       AND kind = CASE NEW.kind WHEN 'direct' THEN 'driver'::public.volunteer_kind
                                WHEN 'driver' THEN 'direct'::public.volunteer_kind END;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_match_volunteer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS match_volunteers_check ON public.match_volunteers;
CREATE TRIGGER match_volunteers_check
    BEFORE INSERT ON public.match_volunteers
    FOR EACH ROW EXECUTE FUNCTION public.check_match_volunteer();

-- ----------------------------------------------------------------------------
-- 5. Schlüsseldienst
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS key_service BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.key_service IS
    'Übernimmt Schließdienste in der Halle. Setzt nur der Administrator.';

GRANT SELECT (key_service) ON public.profiles TO authenticated;

-- Wie bisher, dazu `key_service`: Den Schlüsseldienst vergibt der Administrator.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;   -- Migrationen, Auth-Dienst und Edge Functions mit service_role
    END IF;

    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.qttr IS DISTINCT FROM OLD.qttr
       OR NEW.member_number IS DISTINCT FROM OLD.member_number
       OR NEW.no_games IS DISTINCT FROM OLD.no_games
       OR NEW.key_service IS DISTINCT FROM OLD.key_service
    THEN
        RAISE EXCEPTION
            'Rolle, Status, QTTR, Mitgliedsnummer, Schlüsseldienst und die Kennzeichnung als Mannschaftsspieler darf nur ein Administrator ändern.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION
            'Die E-Mail-Adresse änderst du über „Anmeldeadresse ändern" – sie muss bestätigt werden.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.auth_linked_at IS DISTINCT FROM OLD.auth_linked_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'Diese Angaben verwaltet die Anwendung selbst.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Selbstlöschung ist erlaubt, das Zurücknehmen nicht.
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       AND NOT (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    THEN
        RAISE EXCEPTION 'Ein gelöschtes Konto kann nur ein Administrator wiederherstellen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
END;
$$;

-- Wer an welchem Wochentag den Schlüsseldienst hat (1 = Montag … 7 = Sonntag).
CREATE TABLE IF NOT EXISTS public.key_duty_weekdays (
    weekday    SMALLINT PRIMARY KEY CHECK (weekday BETWEEN 1 AND 7),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vertretung für genau einen Tag. Folgetermine bleiben beim Wochentag.
CREATE TABLE IF NOT EXISTS public.key_duty_overrides (
    duty_date  DATE PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    set_by     UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    set_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS key_duty_weekdays_profile_idx ON public.key_duty_weekdays (profile_id);
CREATE INDEX IF NOT EXISTS key_duty_overrides_profile_idx ON public.key_duty_overrides (profile_id);

ALTER TABLE public.key_duty_weekdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_duty_overrides ENABLE ROW LEVEL SECURITY;

-- Supabase gibt neuen Tabellen alle Rechte an anon und authenticated; hier nur, was
-- gebraucht wird. Vertretungen schreibt ausschließlich die RPC.
REVOKE ALL ON public.key_duty_weekdays, public.key_duty_overrides FROM anon, authenticated;
GRANT SELECT ON public.key_duty_weekdays, public.key_duty_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.key_duty_weekdays TO authenticated;

-- Den Plan sieht jedes aktive Mitglied: Wer aufschließt, soll man wissen.
DROP POLICY IF EXISTS key_duty_weekdays_select ON public.key_duty_weekdays;
CREATE POLICY key_duty_weekdays_select ON public.key_duty_weekdays
    FOR SELECT TO authenticated
    USING (public.is_active_member());

-- Die festen Tage vergibt der Administrator.
DROP POLICY IF EXISTS key_duty_weekdays_write ON public.key_duty_weekdays;
CREATE POLICY key_duty_weekdays_write ON public.key_duty_weekdays
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Vertretungen nur über die RPC, damit Rechte und Benachrichtigung zusammenbleiben.
DROP POLICY IF EXISTS key_duty_overrides_select ON public.key_duty_overrides;
CREATE POLICY key_duty_overrides_select ON public.key_duty_overrides
    FOR SELECT TO authenticated
    USING (public.is_active_member());

-- Wer am Tag den Schlüsseldienst hat: die Vertretung, sonst der Wochentag.
CREATE OR REPLACE FUNCTION public.key_duty_for(p_date DATE)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT profile_id FROM public.key_duty_overrides WHERE duty_date = p_date),
        (SELECT profile_id FROM public.key_duty_weekdays
          WHERE weekday = EXTRACT(ISODOW FROM p_date)::SMALLINT)
    );
$$;

-- Auch für authenticated: v_session_keys ruft sie, und Funktionen in einer Sicht
-- laufen mit den Rechten des Aufrufers.
REVOKE ALL ON FUNCTION public.key_duty_for(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.key_duty_for(DATE) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_key_service()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND key_service AND deleted_at IS NULL AND status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_key_service() FROM PUBLIC, anon, authenticated;

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('key_duty_assigned', 'Du übernimmst den Schlüsseldienst',
     'Schlüsseldienst am {{date}}',
     E'Hallo {{first_name}},\n\n{{by}} hat dich eingetragen: Du übernimmst am {{weekday}}, {{date}} den Schlüsseldienst in der Halle.\n\nKannst du nicht, trag in der App eine andere Vertretung ein.\n\n{{link}}', 22, true)
ON CONFLICT (type) DO NOTHING;

-- Vertretung für einen Tag setzen (p_profile_id) oder zurücknehmen (NULL).
-- Dürfen: der Administrator und jeder mit Schlüsseldienst. Vertreten kann nur, wer
-- selbst Schlüsseldienst hat.
CREATE OR REPLACE FUNCTION public.rpc_set_key_duty_override(p_date DATE, p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me      UUID := auth.uid();
    v_regular UUID;
    v_by      TEXT;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member()
       OR NOT (public.is_admin() OR public.is_key_service()) THEN
        RAISE EXCEPTION 'Den Schlüsseldienst tragen nur der Administrator und der Schlüsseldienst ein.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_date IS NULL OR p_date < public.berlin_today() THEN
        RAISE EXCEPTION 'Dieser Tag ist vorbei.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT profile_id INTO v_regular
      FROM public.key_duty_weekdays WHERE weekday = EXTRACT(ISODOW FROM p_date)::SMALLINT;

    -- Zurück zum Wochentag: keine Vertretung mehr.
    IF p_profile_id IS NULL OR p_profile_id IS NOT DISTINCT FROM v_regular THEN
        DELETE FROM public.key_duty_overrides WHERE duty_date = p_date;
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = p_profile_id AND key_service AND deleted_at IS NULL AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Vertreten kann nur, wer Schlüsseldienst hat.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.key_duty_overrides
         WHERE duty_date = p_date AND profile_id = p_profile_id
    ) THEN
        RETURN;
    END IF;

    INSERT INTO public.key_duty_overrides (duty_date, profile_id, set_by, set_at)
    VALUES (p_date, p_profile_id, v_me, NOW())
    ON CONFLICT (duty_date) DO UPDATE
       SET profile_id = EXCLUDED.profile_id,
           set_by     = EXCLUDED.set_by,
           set_at     = EXCLUDED.set_at;

    IF p_profile_id <> v_me THEN
        SELECT full_name INTO v_by FROM public.profiles WHERE id = v_me;
        PERFORM public.enqueue_notification(
            p_profile_id,
            'key_duty_assigned',
            jsonb_build_object(
                'date',    to_char(p_date, 'DD.MM.YYYY'),
                'weekday', (ARRAY['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag',
                                  'Samstag', 'Sonntag'])[EXTRACT(ISODOW FROM p_date)::int],
                'by',      COALESCE(NULLIF(v_by, ''), 'Jemand'),
                'link',    COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
                               || '/?tab=keys'
            )
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_key_duty_override(DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_key_duty_override(DATE, UUID) TO authenticated;

-- Die Tage mit Schlüsseldienst: jeder Tag, an dem die Halle gebraucht wird (ein
-- Training findet statt oder ein Heimspiel), dazu jeder Tag mit Vertretung.
CREATE OR REPLACE VIEW public.v_key_duty_dates
WITH (security_invoker = true) AS
WITH days AS (
    SELECT s.session_date AS duty_date
      FROM public.training_sessions s
      JOIN public.trainings t ON t.id = s.training_id
     WHERE NOT s.cancelled AND t.active
    UNION
    SELECT (m.dtstart AT TIME ZONE 'Europe/Berlin')::date
      FROM public.matches m
     WHERE m.active AND m.is_home AND m.dtstart IS NOT NULL
    UNION
    SELECT duty_date FROM public.key_duty_overrides
)
SELECT
    d.duty_date,
    EXTRACT(ISODOW FROM d.duty_date)::SMALLINT AS weekday,
    COALESCE(o.profile_id, w.profile_id)        AS profile_id,
    p.full_name                                 AS full_name,
    (o.profile_id IS NOT NULL)                  AS is_override,
    w.profile_id                                AS regular_id
FROM days d
LEFT JOIN public.key_duty_overrides o ON o.duty_date = d.duty_date
LEFT JOIN public.key_duty_weekdays w ON w.weekday = EXTRACT(ISODOW FROM d.duty_date)::SMALLINT
LEFT JOIN public.profiles p ON p.id = COALESCE(o.profile_id, w.profile_id)
WHERE COALESCE(o.profile_id, w.profile_id) IS NOT NULL;

REVOKE ALL ON public.v_key_duty_dates FROM anon;
GRANT SELECT ON public.v_key_duty_dates TO authenticated;

-- Die Terminkarte zeigt den Schlüsseldienst des Tages; die Halle eines Trainings
-- ohne Ort ist der Standardort.
CREATE OR REPLACE VIEW public.v_session_keys AS
SELECT
    s.id AS session_id,
    EXISTS (
        SELECT 1
          FROM public.training_attendance a
          JOIN public.keys k ON k.holder_id = a.profile_id
         WHERE a.session_id = s.id
           AND a.status IN ('yes', 'late')
           AND k.active
           AND k.venue_id = COALESCE(t.venue_id, public.club_default_venue())
    ) AS has_key_holder,
    CASE WHEN public.may_see_session_roster(s.id) THEN (
        SELECT p.full_name
          FROM public.training_attendance a
          JOIN public.keys k     ON k.holder_id = a.profile_id
          JOIN public.profiles p ON p.id = a.profile_id
         WHERE a.session_id = s.id
           AND a.status IN ('yes', 'late')
           AND k.active
           AND k.venue_id = COALESCE(t.venue_id, public.club_default_venue())
         ORDER BY p.full_name
         LIMIT 1
    ) END AS holder_name,
    (sk.session_id IS NOT NULL) AS has_bearer,
    CASE WHEN sk.profile_id = auth.uid() OR public.may_see_session_roster(s.id)
         THEN sk.profile_id END AS bearer_id,
    CASE WHEN sk.profile_id = auth.uid() OR public.may_see_session_roster(s.id)
         THEN bp.full_name END AS bearer_name,
    public.key_duty_for(s.session_date) AS duty_id,
    dp.full_name AS duty_name
FROM public.training_sessions s
JOIN public.trainings t ON t.id = s.training_id
LEFT JOIN public.training_session_keys sk ON sk.session_id = s.id
LEFT JOIN public.profiles bp ON bp.id = sk.profile_id
LEFT JOIN public.profiles dp ON dp.id = public.key_duty_for(s.session_date)
WHERE public.can_see_training(t.id);

GRANT SELECT ON public.v_session_keys TO authenticated;

-- Hat der Tag einen Schlüsseldienst, fehlt kein Schlüssel: keine Erinnerung.
CREATE OR REPLACE FUNCTION public.enqueue_key_reminders()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_trainer RECORD;
    v_holders TEXT;
    v_payload JSONB;
    v_count   INTEGER := 0;
BEGIN
    FOR v_session IN
        SELECT s.id, s.training_id, COALESCE(t.venue_id, public.club_default_venue()) AS venue_id
          FROM public.training_sessions s
          JOIN public.trainings t ON t.id = s.training_id
         WHERE NOT s.cancelled
           AND t.active
           AND s.starts_at > NOW()
           AND s.starts_at <= NOW() + INTERVAL '24 hours'
           AND public.key_duty_for(s.session_date) IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.training_session_keys sk WHERE sk.session_id = s.id)
           AND NOT EXISTS (SELECT 1 FROM public.training_key_reminders r WHERE r.session_id = s.id)
         ORDER BY s.starts_at
    LOOP
        INSERT INTO public.training_key_reminders (session_id) VALUES (v_session.id)
        ON CONFLICT (session_id) DO NOTHING;
        IF NOT FOUND THEN
            CONTINUE;   -- ein paralleler Lauf war schneller
        END IF;

        SELECT string_agg(DISTINCT p.full_name, ', ' ORDER BY p.full_name)
          INTO v_holders
          FROM public.keys k
          JOIN public.profiles p ON p.id = k.holder_id
         WHERE k.active AND k.venue_id = v_session.venue_id AND p.deleted_at IS NULL;

        v_payload := public.training_page_payload(v_session.id)
            || jsonb_build_object(
                'holders',
                CASE WHEN v_holders IS NULL THEN ''
                     ELSE E'\n\nEinen Schlüssel für die Halle haben: ' || v_holders || '.' END
            );

        FOR v_trainer IN
            SELECT tt.profile_id
              FROM public.training_trainers tt
              JOIN public.profiles p ON p.id = tt.profile_id
             WHERE tt.training_id = v_session.training_id
               AND p.deleted_at IS NULL
               AND p.status = 'active'
        LOOP
            PERFORM public.enqueue_notification(v_trainer.profile_id, 'training_key_missing', v_payload);
        END LOOP;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_key_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_key_reminders() TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Systemtraining
-- ----------------------------------------------------------------------------

ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.trainings.is_system IS
    'Systemtraining: Teilnehmer werden je Termin zugeteilt (training_session_participants). Nie offen.';

-- 7. Neue Trainings sind standardmäßig offen. Ein Systemtraining ist es nie.
ALTER TABLE public.trainings ALTER COLUMN is_open SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.system_training_not_open()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.is_system THEN
        NEW.is_open := false;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.system_training_not_open() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trainings_system_not_open ON public.trainings;
CREATE TRIGGER trainings_system_not_open
    BEFORE INSERT OR UPDATE OF is_system, is_open ON public.trainings
    FOR EACH ROW EXECUTE FUNCTION public.system_training_not_open();

CREATE TABLE IF NOT EXISTS public.training_session_participants (
    session_id  UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, profile_id)
);

CREATE INDEX IF NOT EXISTS training_session_participants_profile_idx
    ON public.training_session_participants (profile_id);

ALTER TABLE public.training_session_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_session_participants FROM anon, authenticated;
GRANT SELECT ON public.training_session_participants TO authenticated;

-- Wer zugeteilt ist, sieht es; die Liste sieht, wer auch die Teilnehmer sieht.
DROP POLICY IF EXISTS training_session_participants_select ON public.training_session_participants;
CREATE POLICY training_session_participants_select ON public.training_session_participants
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.may_see_session_roster(session_id));

-- Ist die Person diesem Termin zugeteilt?
CREATE OR REPLACE FUNCTION public.is_session_participant(p_session_id UUID, p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.training_session_participants
         WHERE session_id = p_session_id AND profile_id = p_profile_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_session_participant(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_participant(UUID, UUID) TO service_role;

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('training_session_assigned', 'Für einen Trainingstermin eingeteilt',
     'Eingeteilt: {{training}} am {{date}}',
     E'Hallo {{first_name}},\n\ndu bist für {{training}} am {{date}} um {{time}} Uhr{{venue_text}} eingeteilt.\n\n{{link}}', 23, true)
ON CONFLICT (type) DO NOTHING;

-- Die Teilnehmer eines Termins festlegen: Die Liste ersetzt die bisherige. Neu
-- Eingeteilte bekommen eine Nachricht. Gibt die Zahl der neu Eingeteilten zurück.
CREATE OR REPLACE FUNCTION public.rpc_set_session_participants(
    p_session_id  UUID,
    p_profile_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me       UUID := auth.uid();
    v_session  public.training_sessions%ROWTYPE;
    v_training public.trainings%ROWTYPE;
    v_profile  UUID;
    v_count    INTEGER := 0;
    v_inserted INTEGER;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können das.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_session FROM public.training_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diesen Trainingstermin gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    SELECT * INTO v_training FROM public.trainings WHERE id = v_session.training_id;

    IF NOT (public.is_admin() OR public.trains(v_training.id)) THEN
        RAISE EXCEPTION 'Teilnehmer teilen nur Trainer und Administratoren zu.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT v_training.is_system THEN
        RAISE EXCEPTION 'Teilnehmer je Termin gibt es nur beim Systemtraining.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    DELETE FROM public.training_session_participants
     WHERE session_id = p_session_id
       AND NOT (profile_id = ANY (COALESCE(p_profile_ids, '{}')));

    FOR v_profile IN
        SELECT p.id
          FROM public.profiles p
         WHERE p.id = ANY (COALESCE(p_profile_ids, '{}'))
           AND p.deleted_at IS NULL
           AND p.status = 'active'
    LOOP
        INSERT INTO public.training_session_participants (session_id, profile_id, assigned_by)
        VALUES (p_session_id, v_profile, v_me)
        ON CONFLICT (session_id, profile_id) DO NOTHING;

        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        IF v_inserted = 0 THEN
            CONTINUE;
        END IF;

        v_count := v_count + 1;

        IF v_profile <> v_me AND NOT v_session.cancelled AND v_session.starts_at > NOW() THEN
            PERFORM public.enqueue_notification(
                v_profile, 'training_session_assigned', public.training_page_payload(p_session_id)
            );
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_session_participants(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_session_participants(UUID, UUID[]) TO authenticated;

-- Wer beim Ausfall benachrichtigt wird: wie bisher, dazu die Zugeteilten künftiger
-- Termine eines Systemtrainings.
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
           OR EXISTS (
               SELECT 1
                 FROM public.training_session_participants sp
                 JOIN public.training_sessions s ON s.id = sp.session_id
                WHERE s.training_id = p_training_id
                  AND sp.profile_id = p.id
                  AND s.starts_at > NOW()
           )
       );
$$;

-- Teilnahme: wie bisher, zusätzlich dürfen die Zugeteilten eines Termins antworten.
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

-- Antwort über den Link: dieselbe Zuordnungsregel.
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
       )
       AND NOT public.is_session_participant(p_session_id, p_profile_id) THEN
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

-- ----------------------------------------------------------------------------
-- 8. Kalender
--
-- Geburtstage fallen weg. Neu: der Schlüsseldienst je Tag und die Spalte `mine`
-- für „Für mich relevant" — Spiele der eigenen Mannschaft oder mit Anfrage,
-- eigene Trainings, Vereinstermine ohne eigene Absage, der eigene Schlüsseldienst.
-- Hallensperren betreffen alle.
-- ----------------------------------------------------------------------------

-- Ist der Angemeldete bei diesem Training dabei (offen, zugeordnet, Trainer, oder
-- bei einem Systemtraining genau diesem Termin zugeteilt)?
CREATE OR REPLACE FUNCTION public.is_my_training_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.training_sessions s
          JOIN public.trainings t ON t.id = s.training_id
         WHERE s.id = p_session_id
           AND (
               EXISTS (SELECT 1 FROM public.training_trainers tt
                        WHERE tt.training_id = t.id AND tt.profile_id = auth.uid())
               OR (t.is_system AND public.is_session_participant(s.id, auth.uid()))
               OR (NOT t.is_system AND (
                   t.is_open
                   OR EXISTS (SELECT 1 FROM public.training_members tm
                               WHERE tm.training_id = t.id AND tm.profile_id = auth.uid())
               ))
           )
    );
$$;

REVOKE ALL ON FUNCTION public.is_my_training_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_training_session(UUID) TO authenticated;

CREATE OR REPLACE VIEW public.v_calendar_items
WITH (security_invoker = true) AS

-- Trainingstermine
SELECT
    'training'::TEXT AS kind,
    s.id             AS id,
    t.name           AS title,
    s.starts_at      AS starts_at,
    COALESCE(s.ends_at, s.starts_at + INTERVAL '2 hours') AS ends_at,
    false            AS all_day,
    NULL::TEXT       AS color,
    COALESCE(t.venue_id, public.club_default_venue()) AS venue_id,
    NULL::BOOLEAN    AS is_home,
    s.cancelled      AS cancelled,
    public.is_my_training_session(s.id) AS mine
FROM public.training_sessions s
JOIN public.trainings t ON t.id = s.training_id
WHERE NOT t.hide_in_calendar

UNION ALL

-- Spieltermine, in der Farbe ihrer Mannschaft
SELECT
    'match'::TEXT,
    m.id,
    tm.name || ' – ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt'),
    m.dtstart,
    COALESCE(m.dtend, m.dtstart + INTERVAL '4 hours'),
    false,
    tm.color,
    m.venue_id,
    m.is_home,
    NOT m.active,
    public.can_see_match(m.id)
FROM public.matches m
JOIN public.teams tm ON tm.id = m.team_id

UNION ALL

-- Vereinstermine
SELECT
    'event'::TEXT,
    e.id,
    e.name,
    e.starts_at,
    COALESCE(e.ends_at, e.starts_at + INTERVAL '2 hours'),
    e.full_day,
    NULL,
    NULL,
    NULL,
    false,
    NOT EXISTS (
        SELECT 1 FROM public.event_participations ep
         WHERE ep.event_id = e.id AND ep.profile_id = auth.uid() AND ep.status = 'no'
    )
FROM public.club_events e
WHERE NOT e.exclude_calendar

UNION ALL

-- Gesperrte Hallen: ganztägig, über den ganzen Zeitraum
SELECT
    'venue_blocked'::TEXT,
    c.id,
    COALESCE(v.name, 'Halle') || ' gesperrt'
        || CASE WHEN c.reason <> '' THEN ' (' || c.reason || ')' ELSE '' END,
    c.from_date::timestamptz,
    (c.to_date + 1)::timestamptz,
    true,
    NULL,
    c.venue_id,
    NULL,
    false,
    true
FROM public.training_cancellations c
LEFT JOIN public.venues v ON v.id = c.venue_id
WHERE c.venue_id IS NOT NULL

UNION ALL

-- Schlüsseldienst: ganztägig an jedem Tag, an dem die Halle gebraucht wird
-- Die ID ist je Tag eindeutig (der Kalender braucht das); die Person steht im Titel.
SELECT
    'key_duty'::TEXT,
    md5('key_duty:' || k.duty_date::text)::uuid,
    'Schlüsseldienst: ' || COALESCE(k.full_name, '?')
        || CASE WHEN k.is_override THEN ' (Vertretung)' ELSE '' END,
    k.duty_date::timestamptz,
    (k.duty_date + 1)::timestamptz,
    true,
    NULL,
    NULL,
    NULL,
    false,
    k.profile_id = auth.uid()
FROM public.v_key_duty_dates k;

REVOKE ALL ON public.v_calendar_items FROM anon;
GRANT SELECT ON public.v_calendar_items TO authenticated;
