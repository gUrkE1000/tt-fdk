-- ============================================================================
-- Mannschaftsführer legen Mannschaften an und löschen sie (Vereinsentscheidung
-- 27.09.2026)
--
-- Bisher war die Tabelle `teams` ganz in der Hand des Administrators. Ab hier:
--
--   1. Anlegen und Löschen darf jeder mit der Rolle „Mannschaftsführer" — jede
--      Mannschaft, nicht nur die eigene. Vor dem Löschen verlangt die Oberfläche,
--      dass der Name der Mannschaft eingetippt wird.
--   2. Ändern darf der Mannschaftsführer die Mannschaften, die er führt. Wer
--      löschen und neu anlegen darf, darf erst recht einen Tippfehler beheben.
--   3. Wer eine Mannschaft anlegt, führt sie auch. Sonst stünde er nach dem
--      Anlegen vor einer Mannschaft, deren Kader und Spiele er nicht pflegen darf.
--
-- Wer eine bestehende Mannschaft führt (`team_leaders`), legt weiter nur der
-- Administrator fest.
-- ============================================================================

-- Hat der Angemeldete die Rolle Mannschaftsführer (und ist aktiv)?
CREATE OR REPLACE FUNCTION public.has_team_leader_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid()
           AND deleted_at IS NULL
           AND status = 'active'
           AND role = 'team_leader'
    );
$$;

REVOKE ALL ON FUNCTION public.has_team_leader_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_team_leader_role() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Policies auf teams: statt einer für alles je eine für Anlegen, Ändern, Löschen
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS teams_write ON public.teams;

DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert ON public.teams
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.has_team_leader_role());

DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update ON public.teams
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.leads_team(id))
    WITH CHECK (public.is_admin() OR public.leads_team(id));

DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete ON public.teams
    FOR DELETE TO authenticated
    USING (public.is_admin() OR public.has_team_leader_role());

-- ----------------------------------------------------------------------------
-- Wer anlegt, führt
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER, weil `team_leaders` nur der Administrator schreibt. Der
-- Administrator selbst wird nicht eingetragen: Er legt Mannschaften meist für
-- andere an und wählt die Führung im selben Dialog.
CREATE OR REPLACE FUNCTION public.team_creator_leads()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF public.has_team_leader_role() THEN
        INSERT INTO public.team_leaders (team_id, profile_id)
        VALUES (NEW.id, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.team_creator_leads() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_creator_leads() TO service_role;

DROP TRIGGER IF EXISTS teams_creator_leads ON public.teams;
CREATE TRIGGER teams_creator_leads
    AFTER INSERT ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.team_creator_leads();
