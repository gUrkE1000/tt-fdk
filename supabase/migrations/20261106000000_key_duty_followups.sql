-- ============================================================================
-- Nacharbeiten zur Rückmeldungsrunde (Migration feedback_round)
--
--   1. Schlüsseldienst-Tage bekommen eine Uhrzeit: von der ersten bis zur letzten
--      Belegung der Halle an diesem Tag.
--   2. Der eigene Schlüsseldienst steht in `v_my_upcoming` — damit in „Meine
--      Termine" und im Kalender-Abo.
--   3. Den festen Wochentag bekommt nur, wer Schlüsseldienst hat. Verliert jemand
--      das Kennzeichen oder wird das Konto gelöscht, fallen seine Wochentage und
--      künftigen Vertretungen weg.
--   4. Heimspiel in gesperrter Halle: Die Mannschaftsführung erfährt es auch dann,
--      wenn das Spiel erst nach der Sperre dorthin kommt (Import, Verlegung).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Uhrzeit des Schlüsseldienstes
-- ----------------------------------------------------------------------------

-- Die Belegung der Halle an einem Tag: Trainings, die stattfinden, und Heimspiele.
-- Ohne Belegung (nur eine Vertretung eingetragen) bleibt beides NULL.
CREATE OR REPLACE VIEW public.v_key_duty_dates
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
LEFT JOIN public.profiles p ON p.id = COALESCE(o.profile_id, w.profile_id)
WHERE COALESCE(o.profile_id, w.profile_id) IS NOT NULL;

REVOKE ALL ON public.v_key_duty_dates FROM anon;
GRANT SELECT ON public.v_key_duty_dates TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. „Meine Termine" und Kalender-Abo
-- ----------------------------------------------------------------------------

-- Wie bisher, dazu der eigene Schlüsseldienst. Ohne Belegung der Halle steht er als
-- 18 Uhr bis 22 Uhr da — ein Kalendereintrag braucht eine Zeit, und das ist die
-- übliche Trainingszeit.
CREATE OR REPLACE VIEW public.v_my_upcoming
WITH (security_invoker = true) AS

SELECT
    mp.profile_id,
    'match'::TEXT AS kind,
    m.id          AS id,
    m.dtstart     AS starts_at,
    m.dtend       AS ends_at,
    t.name || ' gegen ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt') AS title,
    COALESCE(v.name, NULLIF(m.location_text, '')) AS location,
    mp.response::TEXT AS my_status,
    m.active     AS active
FROM public.match_participations mp
JOIN public.matches m ON m.id = mp.match_id
JOIN public.teams   t ON t.id = m.team_id
LEFT JOIN public.venues v ON v.id = m.venue_id
WHERE NOT mp.removed

UNION ALL

SELECT
    a.profile_id,
    'training'::TEXT,
    s.id,
    s.starts_at,
    s.ends_at,
    tr.name,
    v.name,
    a.status::TEXT,
    NOT s.cancelled
FROM public.training_attendance a
JOIN public.training_sessions s ON s.id = a.session_id
JOIN public.trainings tr        ON tr.id = s.training_id
LEFT JOIN public.venues v       ON v.id = tr.venue_id

UNION ALL

SELECT
    ep.profile_id,
    'event'::TEXT,
    e.id,
    e.starts_at,
    e.ends_at,
    e.name,
    NULLIF(e.address, ''),
    ep.status::TEXT,
    true
FROM public.event_participations ep
JOIN public.club_events e ON e.id = ep.event_id

UNION ALL

SELECT
    k.profile_id,
    'key_duty'::TEXT,
    md5('key_duty:' || k.duty_date::text)::uuid,
    COALESCE(k.starts_at, (k.duty_date + TIME '18:00') AT TIME ZONE 'Europe/Berlin'),
    COALESCE(k.ends_at, (k.duty_date + TIME '22:00') AT TIME ZONE 'Europe/Berlin'),
    'Schlüsseldienst' || CASE WHEN k.is_override THEN ' (Vertretung)' ELSE '' END,
    (SELECT name FROM public.venues WHERE id = public.club_default_venue()),
    'yes',
    true
FROM public.v_key_duty_dates k;

GRANT SELECT ON public.v_my_upcoming TO authenticated;
GRANT SELECT ON public.v_my_upcoming TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Stimmigkeit
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_key_duty_weekday()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = NEW.profile_id AND key_service AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Einen festen Wochentag bekommt nur, wer Schlüsseldienst hat.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_key_duty_weekday() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS key_duty_weekdays_check ON public.key_duty_weekdays;
CREATE TRIGGER key_duty_weekdays_check
    BEFORE INSERT OR UPDATE ON public.key_duty_weekdays
    FOR EACH ROW EXECUTE FUNCTION public.check_key_duty_weekday();

-- Kennzeichen weg oder Konto gelöscht: keine festen Tage, keine künftigen
-- Vertretungen mehr. Vergangene Vertretungen bleiben als Verlauf stehen.
CREATE OR REPLACE FUNCTION public.clear_key_duty_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF (OLD.key_service AND NOT NEW.key_service)
       OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        DELETE FROM public.key_duty_weekdays WHERE profile_id = NEW.id;
        DELETE FROM public.key_duty_overrides
         WHERE profile_id = NEW.id AND duty_date >= public.berlin_today();
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_key_duty_on_leave() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_clear_key_duty ON public.profiles;
CREATE TRIGGER profiles_clear_key_duty
    AFTER UPDATE OF key_service, deleted_at ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.clear_key_duty_on_leave();

-- ----------------------------------------------------------------------------
-- 4. Heimspiel kommt in eine gesperrte Halle
-- ----------------------------------------------------------------------------

-- Die Sperre, die ein Heimspiel an seinem Tag trifft (oder NULL).
CREATE OR REPLACE FUNCTION public.venue_block_for(
    p_is_home  BOOLEAN,
    p_active   BOOLEAN,
    p_dtstart  TIMESTAMPTZ,
    p_venue_id UUID
)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT c.id
      FROM public.training_cancellations c
     WHERE p_is_home AND p_active AND p_dtstart IS NOT NULL
       AND c.venue_id IS NOT NULL
       AND c.venue_id = COALESCE(p_venue_id, public.club_default_venue())
       AND (p_dtstart AT TIME ZONE 'Europe/Berlin')::date BETWEEN c.from_date AND c.to_date
     ORDER BY c.from_date
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.venue_block_for(BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID)
    FROM PUBLIC, anon, authenticated;

-- Eine Nachricht an die Mannschaftsführung eines Spiels. Gibt die Zahl der
-- Empfänger zurück.
CREATE OR REPLACE FUNCTION public.notify_match_venue_blocked(
    p_match_id        UUID,
    p_cancellation_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_reason  TEXT;
    v_team    UUID;
    v_payload JSONB;
    v_leader  RECORD;
    v_count   INTEGER := 0;
BEGIN
    SELECT btrim(COALESCE(reason, '')) INTO v_reason
      FROM public.training_cancellations WHERE id = p_cancellation_id;
    SELECT team_id INTO v_team FROM public.matches WHERE id = p_match_id;

    v_payload := public.match_page_payload(p_match_id)
        || jsonb_build_object(
            'reason', CASE WHEN COALESCE(v_reason, '') = '' THEN '' ELSE ' (' || v_reason || ')' END
        );

    FOR v_leader IN
        SELECT tl.profile_id
          FROM public.team_leaders tl
          JOIN public.profiles p ON p.id = tl.profile_id
         WHERE tl.team_id = v_team
           AND p.deleted_at IS NULL
           AND p.status = 'active'
    LOOP
        PERFORM public.enqueue_notification(v_leader.profile_id, 'match_venue_blocked', v_payload);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_venue_blocked(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Die Sperre wird eingetragen: alle künftigen Heimspiele darin (wie bisher, jetzt
-- über dieselbe Nachricht wie unten).
CREATE OR REPLACE FUNCTION public.notify_home_matches_blocked(p_cancellation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_match RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_match IN
        SELECT m.id
          FROM public.matches m
         WHERE m.dtstart > NOW()
           AND public.venue_block_for(m.is_home, m.active, m.dtstart, m.venue_id) = p_cancellation_id
    LOOP
        v_count := v_count + public.notify_match_venue_blocked(v_match.id, p_cancellation_id);
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_home_matches_blocked(UUID) FROM PUBLIC, anon, authenticated;

-- Das Spiel kommt in die Sperre: neu angelegt, verlegt, zum Heimspiel gemacht,
-- in eine andere Halle gelegt oder wieder aktiv. War es vorher schon betroffen,
-- wurde bereits gemeldet.
CREATE OR REPLACE FUNCTION public.notify_match_moved_into_block()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_new UUID;
BEGIN
    IF NEW.dtstart IS NULL OR NEW.dtstart <= NOW() THEN
        RETURN NEW;
    END IF;

    v_new := public.venue_block_for(NEW.is_home, NEW.active, NEW.dtstart, NEW.venue_id);
    IF v_new IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND public.venue_block_for(OLD.is_home, OLD.active, OLD.dtstart, OLD.venue_id) IS NOT NULL THEN
        RETURN NEW;
    END IF;

    PERFORM public.notify_match_venue_blocked(NEW.id, v_new);
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_moved_into_block() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_venue_blocked_notice ON public.matches;
CREATE TRIGGER matches_venue_blocked_notice
    AFTER INSERT OR UPDATE OF dtstart_external, dtstart_override, venue_id, is_home, active
    ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.notify_match_moved_into_block();
