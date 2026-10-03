-- ============================================================================
-- Schlüsseldienst planen nur noch Administrator und Kennzeichen
--
-- Bisher durften auch der Inhaber eines festen Wochentags und wer an einem Tag
-- eingeteilt ist, eine Vertretung eintragen — über den Reiter „Schlüsseldienst" der
-- Übersicht. Den gibt es nicht mehr: Geplant wird nur noch unter „Orte &
-- Schlüsseldienst", und die Seite sehen der Administrator und wer das Kennzeichen hat.
-- Die Datenbank folgt dem, sonst stünde dieselbe Regel an zwei Stellen verschieden.
--
-- Die Links der Benachrichtigungen zeigen nicht mehr auf `/?tab=keys`:
--   · „Du hast Schlüsseldienst" geht an jedes aktive Mitglied und führt zur
--     Trainingsseite, wo der Schlüsseldienst an jedem Termin steht.
--   · „Kein Schlüsseldienst" geht an die Trainer. Wer planen darf, kommt direkt zum
--     Tag im Schlüsseldienst, alle anderen zum Trainingstermin.
-- ============================================================================

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
         WHERE id = p_profile_id AND deleted_at IS NULL AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Vertreten kann nur ein aktives Mitglied.'
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
                               || '/trainings'
            )
        );
    END IF;
END;
$$;

UPDATE public.notification_templates
   SET body_tpl   = E'Hallo {{first_name}},\n\nfür {{training}} am {{date}} um {{time}} Uhr{{venue_text}} ist noch kein Schlüsseldienst eingeteilt. Eingeteilt wird er unter „Orte & Schlüsseldienst" — vom Administrator oder vom Schlüsseldienst.\n\n{{link}}',
       updated_at = NOW()
 WHERE type = 'training_key_missing';

CREATE OR REPLACE FUNCTION public.enqueue_key_reminders()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_trainer RECORD;
    v_payload JSONB;
    v_app_url TEXT := COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '');
    v_count   INTEGER := 0;
BEGIN
    FOR v_session IN
        SELECT s.id, s.training_id, s.session_date
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

        -- Der Link der Trainingsseite: zum Termin.
        v_payload := public.training_page_payload(v_session.id);

        FOR v_trainer IN
            SELECT tt.profile_id, (p.role = 'admin' OR p.key_service) AS plans
              FROM public.training_trainers tt
              JOIN public.profiles p ON p.id = tt.profile_id
             WHERE tt.training_id = v_session.training_id
               AND p.deleted_at IS NULL
               AND p.status = 'active'
        LOOP
            PERFORM public.enqueue_notification(
                v_trainer.profile_id,
                'training_key_missing',
                CASE WHEN v_trainer.plans
                     -- Wer planen darf, kommt direkt zum Tag im Schlüsseldienst.
                     THEN v_payload || jsonb_build_object(
                              'link', v_app_url || '/venues?date=' || v_session.session_date::text)
                     ELSE v_payload
                END
            );
        END LOOP;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;
