-- ============================================================================
-- Terminumfrage: abstimmen nur, wer zum Spiel gehört
--
-- `rpc_vote_reschedule` prüfte nur, ob man aktives Mitglied ist. Die App zeigt
-- die Abstimmung zwar nur Angefragten und der eigenen Mannschaft, über die
-- Schnittstelle konnte aber jedes Mitglied bei jedem Spiel mitstimmen — und
-- seine Stimme zählte im Ergebnis mit.
--
-- Jetzt gilt dieselbe Regel wie im Kalender (`is_my_match`): eigene Mannschaft,
-- angefragt oder aufgestellt, oder eine Ersatzanfrage. Auch für Administratoren:
-- Wer ein Spiel nur verwaltet, sieht das Ergebnis, stimmt aber nicht mit.
-- Der Abstimmungslink aus der E-Mail läuft über `apply_reschedule_vote` direkt
-- und ist davon nicht betroffen — er geht ohnehin nur an den Kader.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_vote_reschedule(
    p_poll_id      UUID,
    p_option_index INTEGER,
    p_available    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können abstimmen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT public.is_my_match(
        (SELECT match_id FROM public.reschedule_polls WHERE id = p_poll_id)
    ) THEN
        RAISE EXCEPTION 'Abstimmen kann nur, wer zu diesem Spiel gehört.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN public.apply_reschedule_vote(p_poll_id, auth.uid(), p_option_index, p_available);
END;
$$;
