-- ============================================================================
-- Kennzeichen „Schlüsseldienst" wieder da — als Recht, nicht als Auswahlgrenze
--
-- Wer das Kennzeichen hat (setzt nur der Administrator), sieht „Orte &
-- Schlüsseldienst" und plant dort den Schlüsseldienst: feste Wochentage und einzelne
-- Tage. Eingeteilt werden kann weiterhin jedes aktive Mitglied
-- (20261116000000_key_duty_without_role). Orte ändert weiter nur der Administrator.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS key_service BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.key_service IS
    'Plant den Schlüsseldienst (Wochentage, einzelne Tage). Setzt nur der Administrator.';
GRANT SELECT (key_service) ON public.profiles TO authenticated;

-- Wer heute einen festen Wochentag hat, plant bisher schon mit — er behält das Recht.
UPDATE public.profiles SET key_service = true
 WHERE id IN (SELECT profile_id FROM public.key_duty_weekdays);

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

CREATE OR REPLACE FUNCTION public.is_key_service()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND key_service AND deleted_at IS NULL AND status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_key_service() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_key_service() TO authenticated;

-- Die festen Tage vergeben der Administrator und der Schlüsseldienst.
DROP POLICY IF EXISTS key_duty_weekdays_write ON public.key_duty_weekdays;
CREATE POLICY key_duty_weekdays_write ON public.key_duty_weekdays
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.is_key_service())
    WITH CHECK (public.is_admin() OR public.is_key_service());

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
       OR NOT (public.is_admin() OR public.is_key_service()
               OR EXISTS (SELECT 1 FROM public.key_duty_weekdays WHERE profile_id = v_me)
               OR public.key_duty_for(p_date) IS NOT DISTINCT FROM v_me) THEN
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
                               || '/?tab=keys'
            )
        );
    END IF;
END;
$$;
