-- ============================================================================
-- Erinnerung „kein Schlüsseldienst" an die Trainer
--
-- Wer den Schlüssel bringt, trägt man nicht mehr am Trainingstermin ein; der
-- Schlüsseldienst wird nur noch im Reiter „Schlüsseldienst" geändert. Text und Link
-- der Erinnerung folgen dem: Sie meldet einen Trainingstag ohne Schlüsseldienst und
-- führt direkt zu diesem Tag im Schlüsseldienst.
-- ============================================================================

UPDATE public.notification_templates
   SET label       = 'Kein Schlüsseldienst eingeteilt (Trainer)',
       subject_tpl = 'Kein Schlüsseldienst: {{training}} am {{date}}',
       body_tpl    = E'Hallo {{first_name}},\n\nfür {{training}} am {{date}} um {{time}} Uhr{{venue_text}} ist noch kein Schlüsseldienst eingeteilt. Wer die Halle aufschließt, trägst du im Schlüsseldienst ein.\n\n{{link}}',
       updated_at  = NOW()
 WHERE type = 'training_key_missing';

CREATE OR REPLACE FUNCTION public.enqueue_key_reminders()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_trainer RECORD;
    v_payload JSONB;
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

        -- Der Link führt zum Tag im Schlüsseldienst statt zur Trainingsseite.
        v_payload := public.training_page_payload(v_session.id)
            || jsonb_build_object(
                'link',
                COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
                    || '/?tab=keys&date=' || v_session.session_date::text
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
