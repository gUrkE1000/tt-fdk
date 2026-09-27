-- ============================================================================
-- Kalender „Für mich relevant": Spiele auch für Administratoren richtig
--
-- Die Spalte `mine` der Sicht `v_calendar_items` hing bei Spielen an
-- `can_see_match`. Das heißt „gehört dazu", schließt aber jeden Administrator
-- ein — für ihn war damit jedes Spiel des Vereins „für mich relevant".
--
-- `is_my_match` stellt dieselbe Frage ohne diese Ausnahme: eigene Mannschaft
-- (Kader oder Mannschaftsführung), für das Spiel angefragt oder aufgestellt,
-- oder eine Ersatzanfrage bekommen. Was ein Administrator sehen und tun darf,
-- ändert sich dadurch nicht; es geht nur um den Filter.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_my_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.matches m
         WHERE m.id = p_match_id AND public.belongs_to_team(m.team_id)
    )
    OR EXISTS (
        SELECT 1 FROM public.match_participations
         WHERE match_id = p_match_id AND profile_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.substitute_requests
         WHERE match_id = p_match_id AND profile_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_my_match(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_match(UUID) TO authenticated;

CREATE OR REPLACE VIEW public.v_calendar_items
WITH (security_invoker = true) AS

-- Trainingstermine
SELECT
    'training'::TEXT AS kind,
    s.id             AS id,
    t.name           AS title,
    s.starts_at      AS starts_at,
    COALESCE(s.ends_at, s.starts_at + INTERVAL '2 hours') AS ends_at,
    false            AS all_day,
    NULL::TEXT       AS color,
    COALESCE(t.venue_id, public.club_default_venue()) AS venue_id,
    NULL::BOOLEAN    AS is_home,
    s.cancelled      AS cancelled,
    public.is_my_training_session(s.id) AS mine
FROM public.training_sessions s
JOIN public.trainings t ON t.id = s.training_id
WHERE NOT t.hide_in_calendar

UNION ALL

-- Spieltermine, in der Farbe ihrer Mannschaft
SELECT
    'match'::TEXT,
    m.id,
    tm.name || ' – ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt'),
    m.dtstart,
    COALESCE(m.dtend, m.dtstart + INTERVAL '4 hours'),
    false,
    tm.color,
    m.venue_id,
    m.is_home,
    NOT m.active,
    public.is_my_match(m.id)
FROM public.matches m
JOIN public.teams tm ON tm.id = m.team_id

UNION ALL

-- Vereinstermine
SELECT
    'event'::TEXT,
    e.id,
    e.name,
    e.starts_at,
    COALESCE(e.ends_at, e.starts_at + INTERVAL '2 hours'),
    e.full_day,
    NULL,
    NULL,
    NULL,
    false,
    NOT EXISTS (
        SELECT 1 FROM public.event_participations ep
         WHERE ep.event_id = e.id AND ep.profile_id = auth.uid() AND ep.status = 'no'
    )
FROM public.club_events e
WHERE NOT e.exclude_calendar

UNION ALL

-- Gesperrte Hallen: ganztägig, über den ganzen Zeitraum
SELECT
    'venue_blocked'::TEXT,
    c.id,
    COALESCE(v.name, 'Halle') || ' gesperrt'
        || CASE WHEN c.reason <> '' THEN ' (' || c.reason || ')' ELSE '' END,
    c.from_date::timestamptz,
    (c.to_date + 1)::timestamptz,
    true,
    NULL,
    c.venue_id,
    NULL,
    false,
    true
FROM public.training_cancellations c
LEFT JOIN public.venues v ON v.id = c.venue_id
WHERE c.venue_id IS NOT NULL

UNION ALL

-- Schlüsseldienst: ganztägig an jedem Tag, an dem die Halle gebraucht wird
-- Die ID ist je Tag eindeutig (der Kalender braucht das); die Person steht im Titel.
SELECT
    'key_duty'::TEXT,
    md5('key_duty:' || k.duty_date::text)::uuid,
    'Schlüsseldienst: ' || COALESCE(k.full_name, '?')
        || CASE WHEN k.is_override THEN ' (Vertretung)' ELSE '' END,
    k.duty_date::timestamptz,
    (k.duty_date + 1)::timestamptz,
    true,
    NULL,
    NULL,
    NULL,
    false,
    k.profile_id = auth.uid()
FROM public.v_key_duty_dates k;

REVOKE ALL ON public.v_calendar_items FROM anon;
GRANT SELECT ON public.v_calendar_items TO authenticated;
