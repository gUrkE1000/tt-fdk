-- ============================================================================
-- Trainingsstatistik (Aufgabe 9.9)
--
-- Wer war wie oft da? Die Zahl interessiert Trainer für die Planung und den
-- Verein für die Ehrungen am Jahresende.
--
-- **Wer sie sehen darf, steht am Training** (`statistics_visibility`, seit
-- Aufgabe 6.1): `admins` (Voreinstellung), `all` oder `groups` — dann nur die
-- Mitglieder der unter `training_statistics_groups` hinterlegten Gruppen.
--
-- Die Regel gehört in die Datenbank und nicht in die Oberfläche: Anwesenheit ist
-- eine Aussage über eine Person, und wer sie sehen darf, hat der Verein
-- entschieden. Eine Oberfläche, die es nur nicht anzeigt, wäre keine Grenze.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.may_see_training_statistics(p_training_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.is_admin()
        OR public.trains(p_training_id)
        OR EXISTS (
            SELECT 1 FROM public.trainings t
             WHERE t.id = p_training_id
               AND (
                    t.statistics_visibility = 'all'
                 OR (
                        t.statistics_visibility = 'groups'
                    AND EXISTS (
                        SELECT 1
                          FROM public.training_statistics_groups g
                          JOIN public.group_members gm ON gm.group_id = g.group_id
                         WHERE g.training_id = t.id
                           AND gm.profile_id = auth.uid()
                    )
                 )
               )
        );
$$;

REVOKE ALL ON FUNCTION public.may_see_training_statistics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.may_see_training_statistics(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- Beteiligung je Training und Mitglied
--
-- Gezählt werden nur **vergangene, nicht abgesagte** Termine: Ein Training in der
-- Zukunft sagt nichts über Anwesenheit, und ein ausgefallenes schon gar nicht —
-- sonst stünde bei jedem eine Absage, die niemand zu verantworten hat.
--
-- „Abwesend" heißt hier: eingetragen, aber ohne Rückmeldung. Das ist etwas
-- anderes als eine Absage, und beides zusammenzuwerfen wäre unfair gegenüber
-- denen, die immer absagen, wenn sie nicht können.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_training_statistics AS
SELECT
    tr.id                                   AS training_id,
    tr.name                                 AS training_name,
    tm.profile_id,
    p.full_name,
    s.session_date,
    COALESCE(a.status::TEXT, 'none')        AS status
FROM public.trainings tr
JOIN public.training_members tm  ON tm.training_id = tr.id
JOIN public.profiles p           ON p.id = tm.profile_id AND p.deleted_at IS NULL
JOIN public.training_sessions s  ON s.training_id = tr.id
LEFT JOIN public.training_attendance a
       ON a.session_id = s.id AND a.profile_id = tm.profile_id
WHERE NOT s.cancelled
  AND s.starts_at < NOW()
  AND public.may_see_training_statistics(tr.id);

GRANT SELECT ON public.v_training_statistics TO authenticated;
