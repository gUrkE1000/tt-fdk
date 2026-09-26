-- ============================================================================
-- Schlüsselverwaltung entfernt (Vereinsentscheidung 26.09.2026)
--
-- Wer welchen Schlüssel hat und an wen er ihn weitergibt (`keys`,
-- `key_handovers`, Übergabe per `rpc_hand_over_key`) wird nicht mehr gepflegt.
-- Wer die Halle auf- und zuschließt, regelt der Schlüsseldienst
-- (`key_duty_weekdays`, `key_duty_overrides`); wer zu einem Training den Schlüssel
-- bringt, steht weiter am Termin (`training_session_keys`).
--
-- Aus `v_session_keys` fallen die Spalten weg, die aus der Schlüsselverwaltung
-- kamen (`has_key_holder`, `holder_name`), aus der Erinnerung an die Trainer die
-- Liste der Schlüsselinhaber.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Die Terminkarte ohne Schlüsselinhaber
-- ----------------------------------------------------------------------------

-- Spalten fallen weg — das geht nur mit DROP und CREATE, nicht mit REPLACE.
DROP VIEW IF EXISTS public.v_session_keys;

CREATE VIEW public.v_session_keys AS
SELECT
    s.id AS session_id,
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

REVOKE ALL ON public.v_session_keys FROM anon;
GRANT SELECT ON public.v_session_keys TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Erinnerung an die Trainer ohne Schlüsselinhaber
-- ----------------------------------------------------------------------------

UPDATE public.notification_templates
   SET body_tpl   = E'Hallo {{first_name}},\n\nfür {{training}} am {{date}} um {{time}} Uhr{{venue_text}} hat sich noch niemand eingetragen, der den Hallenschlüssel bringt, und es ist kein Schlüsseldienst eingeteilt.\n\n{{link}}',
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
    v_count   INTEGER := 0;
BEGIN
    FOR v_session IN
        SELECT s.id, s.training_id
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

        v_payload := public.training_page_payload(v_session.id);

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
-- 3. Schlüsselverwaltung entfernen
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.v_keys;
DROP FUNCTION IF EXISTS public.rpc_hand_over_key(UUID, UUID, TEXT);
DROP TABLE IF EXISTS public.key_handovers;
DROP TABLE IF EXISTS public.keys;
DROP FUNCTION IF EXISTS public.may_hand_over_key(UUID);
