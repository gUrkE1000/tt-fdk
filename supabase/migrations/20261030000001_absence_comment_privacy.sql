-- ============================================================================
-- Privater Abwesenheitsgrund (Code-Review H-2)
--
-- comment_private ist „nur für dich sichtbar". Ausgeblendet hat ihn bisher nur die
-- View v_absences; die Tabelle selbst gab ihn Admin, Mannschaftsführern und Trainern
-- (can_see_absences) mit allen Spalten her.
--
-- Jetzt fehlt das Leserecht auf die Spalte. v_absences läuft als Eigentümer, trägt
-- die Zeilenregel der Policy selbst und zeigt den Grund nur der Person, der er gehört.
-- Schreiben (anlegen, ändern, löschen) bleibt unverändert über die Tabelle.
-- ============================================================================

REVOKE SELECT ON public.absences FROM anon, authenticated;
GRANT SELECT (id, profile_id, start_date, end_date, created_at, updated_at)
    ON public.absences TO authenticated;

DROP VIEW IF EXISTS public.v_absences;
CREATE VIEW public.v_absences
WITH (security_barrier = true) AS
SELECT
    a.id,
    a.profile_id,
    a.start_date,
    a.end_date,
    CASE WHEN a.profile_id = auth.uid() THEN a.comment_private END AS comment_private,
    a.created_at,
    a.updated_at
FROM public.absences a
WHERE a.profile_id = auth.uid() OR public.can_see_absences();

REVOKE ALL ON public.v_absences FROM anon;
GRANT SELECT ON public.v_absences TO authenticated;
