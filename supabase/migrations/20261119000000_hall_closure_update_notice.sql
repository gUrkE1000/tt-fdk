-- ============================================================================
-- Hallensperrung ändern: auch dann benachrichtigen
--
-- Bisher meldete sich eine Hallensperrung nur beim Anlegen. Wird sie geändert
-- (verlängert, verschoben, andere Halle), erfahren es jetzt auch die Mitglieder der
-- betroffenen Trainings und die Mannschaftsführung betroffener Heimspiele — aber nur
-- für das, was neu dazukommt. Wer für einen Tag schon Bescheid bekam, bekommt keine
-- zweite Nachricht. Ein geänderter Grund allein ist keine Nachricht wert.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_cancellation_update_notice()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_today    DATE := public.berlin_today();
    v_range    RECORD;
    v_training RECORD;
    v_match    RECORD;
BEGIN
    -- Nur Hallensperrungen; frühere Ausfälle einzelner Trainings ändert die
    -- Oberfläche nicht mehr.
    IF NEW.venue_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Die neu betroffenen Tage: bei anderer Halle der ganze Zeitraum, sonst, was vor
    -- dem alten Beginn und nach dem alten Ende dazukommt. Vergangenes nicht.
    FOR v_range IN
        SELECT GREATEST(r.f, v_today) AS f, r.t
          FROM (
                SELECT NEW.from_date AS f, NEW.to_date AS t
                 WHERE NEW.venue_id IS DISTINCT FROM OLD.venue_id
                UNION ALL
                SELECT NEW.from_date, LEAST(NEW.to_date, OLD.from_date - 1)
                 WHERE NEW.venue_id IS NOT DISTINCT FROM OLD.venue_id
                   AND NEW.from_date < OLD.from_date
                UNION ALL
                SELECT GREATEST(NEW.from_date, OLD.to_date + 1), NEW.to_date
                 WHERE NEW.venue_id IS NOT DISTINCT FROM OLD.venue_id
                   AND NEW.to_date > OLD.to_date
               ) r
         WHERE GREATEST(r.f, v_today) <= r.t
    LOOP
        FOR v_training IN
            SELECT id FROM public.trainings
             WHERE COALESCE(venue_id, public.club_default_venue()) = NEW.venue_id
               AND active
        LOOP
            PERFORM public.notify_training_cancelled(
                v_training.id, v_range.f, v_range.t, NEW.reason, NEW.notify_email
            );
        END LOOP;
    END LOOP;

    -- Heimspiele, die jetzt in der Sperre liegen und vorher nicht.
    FOR v_match IN
        SELECT m.id
          FROM public.matches m
         WHERE m.dtstart > NOW()
           AND public.venue_block_for(m.is_home, m.active, m.dtstart, m.venue_id) = NEW.id
           AND NOT (
                OLD.venue_id IS NOT DISTINCT FROM COALESCE(m.venue_id, public.club_default_venue())
                AND (m.dtstart AT TIME ZONE 'Europe/Berlin')::date
                    BETWEEN OLD.from_date AND OLD.to_date
           )
    LOOP
        PERFORM public.notify_match_venue_blocked(v_match.id, NEW.id);
    END LOOP;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_cancellation_update_notice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS training_cancellations_update_notify ON public.training_cancellations;
CREATE TRIGGER training_cancellations_update_notify
    AFTER UPDATE OF venue_id, from_date, to_date ON public.training_cancellations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_cancellation_update_notice();
