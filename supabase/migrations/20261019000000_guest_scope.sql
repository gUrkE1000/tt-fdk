-- ============================================================================
-- Was ein Gast sieht (Nachbesserung zu Aufgabe 3.1)
--
-- Zielbild 3.1 hält am Rollen-Enum fest: „Gast: sieht nur offene Trainings und
-- Vereinstermine". Die Policies aus Aufgabe 3.1 prüfen aber nur `is_active_member()`
-- — und ein Gast ist ein aktives Mitglied. Damit sah er Mannschaften, Spieltermine
-- und Rückmeldungen mit.
--
-- Aufgefallen ist es erst beim Kalender (Aufgabe 7.3): Dort stand plötzlich der
-- ganze Spielplan in einer Ansicht, die auch ein Gast öffnen darf. Die View war
-- nicht das Problem, sie hat nur sichtbar gemacht, was schon galt.
--
-- Diese Migration zieht die Grenze dort, wo sie hingehört: in den Policies der
-- Tabellen. Am Kalender ändert sich dadurch nichts — er erbt sie.
-- ============================================================================

-- Ein Mitglied, das am Spielbetrieb teilnimmt: aktiv und kein Gast.
CREATE OR REPLACE FUNCTION public.is_playing_member()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid()
           AND deleted_at IS NULL
           AND status = 'active'
           AND role <> 'guest'
    );
$$;

REVOKE ALL ON FUNCTION public.is_playing_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_playing_member() TO authenticated;

-- --- Mannschaften ------------------------------------------------------------
DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
    FOR SELECT TO authenticated
    USING (public.is_playing_member());

DROP POLICY IF EXISTS team_leaders_select ON public.team_leaders;
CREATE POLICY team_leaders_select ON public.team_leaders
    FOR SELECT TO authenticated
    USING (public.is_playing_member());

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
    FOR SELECT TO authenticated
    USING (public.is_playing_member());

-- --- Spieltermine ------------------------------------------------------------
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

-- --- Ersatzkette und Verlegung ----------------------------------------------
DROP POLICY IF EXISTS reschedule_polls_select ON public.reschedule_polls;
CREATE POLICY reschedule_polls_select ON public.reschedule_polls
    FOR SELECT TO authenticated
    USING (public.is_playing_member());

DROP POLICY IF EXISTS reschedule_votes_select ON public.reschedule_votes;
CREATE POLICY reschedule_votes_select ON public.reschedule_votes
    FOR SELECT TO authenticated
    USING (public.is_playing_member());
