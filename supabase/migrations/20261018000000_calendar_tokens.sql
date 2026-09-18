-- ============================================================================
-- Kalender-Abo je Mitglied (Aufgabe 7.4, Zielbild 3.6/3.7)
--
-- Ein Abo-Link ist ein Dauerausweis: Wer ihn hat, liest die Termine dieses Mitglieds,
-- ohne sich anzumelden — ein Kalenderprogramm kann sich nicht anmelden. Daraus folgen
-- drei Dinge:
--
--   1. Der Token ist ein Zufallswert, kein ableitbarer Wert.
--   2. Er steckt in einer eigenen Tabelle, die **niemand** über die API lesen kann.
--      Herausgegeben wird er nur an den Eigentümer, über eine Funktion.
--   3. Er lässt sich neu erzeugen. Wer seinen Link versehentlich geteilt hat, braucht
--      einen Weg, ihn wertlos zu machen.
--
-- Der Feed enthält nur **zugesagte** Termine. Das ist auch die Erwartung: Ein
-- Kalendereintrag heißt „da bin ich", nicht „das findet statt".
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_tokens (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id)
                   ON UPDATE CASCADE ON DELETE CASCADE,
    token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Bewusst ohne jede Policy: Wer den Token abfragen könnte, könnte fremde Kalender lesen.
-- Der Zugriff läuft ausschließlich über die beiden Funktionen unten.

GRANT SELECT ON public.calendar_tokens TO service_role;

-- ----------------------------------------------------------------------------
-- 1. Den eigenen Token holen — und dabei anlegen, falls es noch keinen gibt
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_my_calendar_token()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me    UUID := auth.uid();
    v_token UUID;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder haben einen Kalender.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.calendar_tokens (profile_id)
    VALUES (v_me)
    ON CONFLICT (profile_id) DO NOTHING;

    SELECT token INTO v_token FROM public.calendar_tokens WHERE profile_id = v_me;
    RETURN v_token;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Neu erzeugen: der alte Link ist damit wertlos
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_reset_calendar_token()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me    UUID := auth.uid();
    v_token UUID;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder haben einen Kalender.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.calendar_tokens (profile_id, token)
    VALUES (v_me, gen_random_uuid())
    ON CONFLICT (profile_id) DO UPDATE SET token = gen_random_uuid()
    RETURNING token INTO v_token;

    RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_my_calendar_token()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_reset_calendar_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_my_calendar_token()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reset_calendar_token() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Meine Termine (Zielbild 3.7)
--
-- Eine Zeile je Termin, an dem das Mitglied beteiligt ist, mit dem eigenen Status.
-- Grundlage für „Meine Termine", das Dashboard und den ICS-Feed — damit alle drei
-- dieselbe Antwort bekommen und nicht jede für sich rechnet.
-- ----------------------------------------------------------------------------

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
JOIN public.club_events e ON e.id = ep.event_id;

GRANT SELECT ON public.v_my_upcoming TO authenticated;
GRANT SELECT ON public.v_my_upcoming TO service_role;
