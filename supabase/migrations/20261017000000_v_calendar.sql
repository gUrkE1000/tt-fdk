-- ============================================================================
-- Kalender (Aufgabe 7.3, Zielbild 3.7)
--
-- Eine View über alles, was im Vereinskalender steht: Trainingstermine, Spiele,
-- Vereinstermine, Geburtstage und gesperrte Hallen.
--
-- Bewusst eine View und nicht fünf Abfragen im Browser: Die Regeln, was im Kalender
-- auftaucht (`hide_in_calendar`, `exclude_calendar`, `hide_birthday`), gehören dorthin,
-- wo auch die Rechte stehen. `security_invoker` sorgt dafür, dass jeder Teil weiterhin
-- der RLS seiner Tabelle folgt: Ein Gast sieht hier genau das, was er auch sonst sieht.
-- ============================================================================

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
    t.venue_id       AS venue_id,
    NULL::BOOLEAN    AS is_home,
    s.cancelled      AS cancelled
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
    NOT m.active
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
    false
FROM public.club_events e
WHERE NOT e.exclude_calendar

UNION ALL

-- Geburtstage: der nächste, innerhalb eines Jahres. Ein wiederkehrender Termin als
-- Datenzeile wäre eine Tabelle mit 365 Einträgen je Mitglied — hier reicht die
-- Rechnung „nächster Jahrestag ab heute".
SELECT
    'birthday'::TEXT,
    p.id,
    p.full_name,
    (
        (p.birthday
            + ((EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday))::int
               + CASE
                   WHEN (p.birthday + ((EXTRACT(YEAR FROM CURRENT_DATE)
                                        - EXTRACT(YEAR FROM p.birthday))::int
                                       * INTERVAL '1 year')) < CURRENT_DATE
                   THEN 1 ELSE 0
                 END) * INTERVAL '1 year')
    )::timestamptz,
    (
        (p.birthday
            + ((EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday))::int
               + CASE
                   WHEN (p.birthday + ((EXTRACT(YEAR FROM CURRENT_DATE)
                                        - EXTRACT(YEAR FROM p.birthday))::int
                                       * INTERVAL '1 year')) < CURRENT_DATE
                   THEN 1 ELSE 0
                 END) * INTERVAL '1 year')
    )::timestamptz,
    true,
    NULL,
    NULL,
    NULL,
    false
FROM public.profiles p
WHERE p.birthday IS NOT NULL
  AND NOT p.hide_birthday
  AND p.deleted_at IS NULL
  AND p.status = 'active'

UNION ALL

-- Gesperrte Hallen: ganztägig, über den ganzen Zeitraum
SELECT
    'venue_blocked'::TEXT,
    c.id,
    COALESCE(v.name, 'Halle') || ' nicht verfügbar'
        || CASE WHEN c.reason <> '' THEN ' (' || c.reason || ')' ELSE '' END,
    c.from_date::timestamptz,
    (c.to_date + 1)::timestamptz,
    true,
    NULL,
    c.venue_id,
    NULL,
    false
FROM public.training_cancellations c
LEFT JOIN public.venues v ON v.id = c.venue_id
WHERE c.venue_id IS NOT NULL;

GRANT SELECT ON public.v_calendar_items TO authenticated;
