-- ============================================================================
-- Schlüsseldienst ohne eigene Rolle
--
-- Bisher kennzeichnete `profiles.key_service` die Personen, die Schlüsseldienst
-- übernehmen dürfen; nur sie standen in den Auswahllisten. Das Kennzeichen fällt weg:
-- Den festen Wochentag und die Vertretung für einen einzelnen Tag bekommt jedes aktive
-- Mitglied — ausgewählt direkt im Schlüsseldienst.
--
--   1. `key_service` und `is_key_service()` entfallen, der Spaltenschutz kennt sie
--      nicht mehr.
--   2. Vertretungen tragen der Administrator, wer einen festen Wochentag hat, und wer
--      an dem Tag eingeteilt ist, ein. Vertreten kann jedes aktive Mitglied.
--   3. `v_key_duty_days` listet jeden Hallentag, auch ohne Schlüsseldienst — damit
--      man auch dort jemanden eintragen kann. `v_key_duty_dates` bleibt bei den Tagen
--      mit Person (Kalender).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kennzeichen entfernen
-- ----------------------------------------------------------------------------

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
    THEN
        RAISE EXCEPTION
            'Rolle, Status, QTTR, Mitgliedsnummer und die Kennzeichnung als Mannschaftsspieler darf nur ein Administrator ändern.'
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

-- Konto gelöscht: keine festen Tage, keine künftigen Vertretungen mehr. Vergangene
-- Vertretungen bleiben als Verlauf stehen.
CREATE OR REPLACE FUNCTION public.clear_key_duty_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        DELETE FROM public.key_duty_weekdays WHERE profile_id = NEW.id;
        DELETE FROM public.key_duty_overrides
         WHERE profile_id = NEW.id AND duty_date >= public.berlin_today();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_clear_key_duty ON public.profiles;
CREATE TRIGGER profiles_clear_key_duty
    AFTER UPDATE OF deleted_at ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.clear_key_duty_on_leave();

-- Einen festen Wochentag bekommt jedes aktive Mitglied.
CREATE OR REPLACE FUNCTION public.check_key_duty_weekday()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = NEW.profile_id AND deleted_at IS NULL AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Schlüsseldienst übernehmen nur aktive Mitglieder.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.is_key_service();
ALTER TABLE public.profiles DROP COLUMN IF EXISTS key_service;

-- ----------------------------------------------------------------------------
-- 2. Vertretung
-- ----------------------------------------------------------------------------

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
       OR NOT (public.is_admin()
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

-- ----------------------------------------------------------------------------
-- 3. Alle Hallentage
-- ----------------------------------------------------------------------------

-- Wie `v_key_duty_dates` (Stand 20261106000000_key_duty_followups), aber mit den
-- Tagen, an denen niemand eingeteilt ist (`profile_id` NULL).
CREATE OR REPLACE VIEW public.v_key_duty_days
WITH (security_invoker = true) AS
WITH usage AS (
    SELECT s.session_date AS duty_date,
           s.starts_at,
           COALESCE(s.ends_at, s.starts_at + INTERVAL '2 hours') AS ends_at
      FROM public.training_sessions s
      JOIN public.trainings t ON t.id = s.training_id
     WHERE NOT s.cancelled AND t.active
    UNION ALL
    SELECT (m.dtstart AT TIME ZONE 'Europe/Berlin')::date,
           m.dtstart,
           COALESCE(m.dtend, m.dtstart + INTERVAL '4 hours')
      FROM public.matches m
     WHERE m.active AND m.is_home AND m.dtstart IS NOT NULL
),
days AS (
    SELECT duty_date, min(starts_at) AS starts_at, max(ends_at) AS ends_at
      FROM usage
     GROUP BY duty_date
    UNION ALL
    SELECT o.duty_date, NULL, NULL
      FROM public.key_duty_overrides o
     WHERE NOT EXISTS (SELECT 1 FROM usage u WHERE u.duty_date = o.duty_date)
)
SELECT
    d.duty_date,
    EXTRACT(ISODOW FROM d.duty_date)::SMALLINT AS weekday,
    COALESCE(o.profile_id, w.profile_id)        AS profile_id,
    p.full_name                                 AS full_name,
    (o.profile_id IS NOT NULL)                  AS is_override,
    w.profile_id                                AS regular_id,
    d.starts_at                                 AS starts_at,
    d.ends_at                                   AS ends_at
FROM days d
LEFT JOIN public.key_duty_overrides o ON o.duty_date = d.duty_date
LEFT JOIN public.key_duty_weekdays w ON w.weekday = EXTRACT(ISODOW FROM d.duty_date)::SMALLINT
LEFT JOIN public.profiles p ON p.id = COALESCE(o.profile_id, w.profile_id);

REVOKE ALL ON public.v_key_duty_days FROM anon;
GRANT SELECT ON public.v_key_duty_days TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_key_duty_dates
WITH (security_invoker = true) AS
SELECT * FROM public.v_key_duty_days WHERE profile_id IS NOT NULL;
