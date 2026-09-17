-- ============================================================================
-- Abwesenheiten (Zielbild 3.5) und Selbstlöschung des eigenen Kontos.
--
-- Abwesenheiten sind der stille Held der Aufstellungsplanung: Wer im Urlaub ist,
-- taucht gar nicht erst als Kandidat auf, und der Mannschaftsführer muss nicht
-- nachfragen. Deshalb sehen Verantwortliche die Zeiträume — aber nie den Grund.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.absences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    -- Im TT-Planer ausdrücklich beschriftet mit „nur für dich sichtbar".
    comment_private TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT absences_range_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS absences_profile_idx ON public.absences (profile_id);
CREATE INDEX IF NOT EXISTS absences_range_idx ON public.absences (start_date, end_date);

DROP TRIGGER IF EXISTS absences_updated_at ON public.absences;
CREATE TRIGGER absences_updated_at
    BEFORE UPDATE ON public.absences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Wer darf Abwesenheiten anderer sehen?
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_see_absences()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid()
           AND deleted_at IS NULL
           AND status = 'active'
           AND role IN ('admin', 'team_leader', 'trainer')
    );
$$;

REVOKE ALL ON FUNCTION public.can_see_absences() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_absences() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absences TO authenticated;

DROP POLICY IF EXISTS absences_select ON public.absences;
CREATE POLICY absences_select ON public.absences
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.can_see_absences());

-- Anlegen, ändern und löschen darf jeder für sich; ein Admin auch für andere
-- (im TT-Planer legt der Admin Abwesenheiten im Vereinskalender mit an).
DROP POLICY IF EXISTS absences_write ON public.absences;
CREATE POLICY absences_write ON public.absences
    FOR ALL TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin())
    WITH CHECK (profile_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- Sicht für Verantwortliche: Zeiträume ja, Gründe nein
--
-- Der Kommentar ist eine Spalten-, keine Zeilenfrage — deshalb eine View.
-- security_invoker: die Policy oben gilt weiterhin.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_absences
WITH (security_invoker = true) AS
SELECT
    a.id,
    a.profile_id,
    a.start_date,
    a.end_date,
    CASE WHEN a.profile_id = auth.uid() THEN a.comment_private END AS comment_private,
    a.created_at,
    a.updated_at
FROM public.absences a;

GRANT SELECT ON public.v_absences TO authenticated;

-- ----------------------------------------------------------------------------
-- Spaltenschutz erweitern: deleted_at
--
-- Mit der Selbstlöschung wird deleted_at zu einer sicherheitsrelevanten Spalte.
-- Die Regel ist einfach: Du darfst dich löschen, aber nicht wiederbeleben.
-- Ohne diesen Zusatz könnte ein gelöschtes Konto sein eigenes deleted_at über die
-- API wieder auf NULL setzen und wäre zurück im Verein.
--
-- Die Funktion stammt aus der eingefrorenen Baseline und wird hier ersetzt, nicht
-- dort geändert.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;   -- Migrationen und Edge Functions mit service_role
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

-- ----------------------------------------------------------------------------
-- Selbstlöschung
--
-- Soft-Delete statt DELETE: Rückmeldungen und Aufstellungen vergangener Spiele
-- sollen lesbar bleiben. Ein Job räumt nach 30 Tagen endgültig auf (Aufgabe 8.4).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_delete_my_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_last_admin BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Nicht angemeldet.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Ohne diese Bremse könnte sich der letzte Administrator selbst aussperren und
    -- niemand käme mehr an die Vereinsverwaltung.
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND role = 'admin'
    ) AND (
        SELECT count(*) FROM public.profiles
         WHERE role = 'admin' AND deleted_at IS NULL
    ) <= 1
    INTO v_is_last_admin;

    IF v_is_last_admin THEN
        RAISE EXCEPTION
            'Du bist der letzte Administrator. Bitte zuerst jemand anderen zum Administrator machen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Nur deleted_at: der Status bleibt, wie er war. Ob jemand zum Verein gehört,
    -- entscheidet deleted_at, nicht der Status.
    UPDATE public.profiles
       SET deleted_at = NOW()
     WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_my_account() TO authenticated;
