-- ============================================================================
-- Merkposten für Erinnerungen (Aufgabe 4.5)
--
-- Der Erinnerungslauf läuft alle zehn Minuten. Ohne Gedächtnis würde er dieselbe
-- Erinnerung sechsmal pro Stunde verschicken. Diese beiden Tabellen sind dieses
-- Gedächtnis — und zwar getrennt vom Postfach, weil eine verschickte Nachricht
-- irgendwann aufgeräumt wird, der Merkposten aber bleiben muss.
-- ============================================================================

-- Je Spiel, Person und Fassung höchstens eine Erinnerung. Die Fassung gehört in den
-- Schlüssel: Wird ein Spiel verlegt, ist die alte Erinnerung überholt und es gibt
-- zur neuen Fassung wieder eine.
CREATE TABLE IF NOT EXISTS public.match_reminders (
    match_id      UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    match_version INTEGER NOT NULL,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (match_id, profile_id, match_version)
);

-- Der Sammelhinweis geht höchstens einmal am Tag. `sent_on` ist ein Kalendertag in
-- Ortszeit, kein Zeitpunkt — „einmal täglich" ist eine Tagesfrage.
CREATE TABLE IF NOT EXISTS public.open_reminder_log (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sent_on    DATE NOT NULL,
    PRIMARY KEY (profile_id, sent_on)
);

ALTER TABLE public.match_reminders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_reminder_log  ENABLE ROW LEVEL SECURITY;

-- Beide Tabellen gehören dem Hintergrundlauf. Niemand sonst liest oder schreibt sie;
-- sie enthalten nichts, was in der Oberfläche vorkommt.

-- ----------------------------------------------------------------------------
-- Offene Rückmeldungen
-- ----------------------------------------------------------------------------

-- Wer hat zu welchem Termin noch nicht geantwortet? Ab Phase 6 und 7 kommen
-- Trainings und Vereinstermine als weitere Zeilen dazu; die Spalte `kind`
-- steht deshalb schon hier.
CREATE OR REPLACE VIEW public.v_open_participations
WITH (security_invoker = true) AS
SELECT
    mp.profile_id,
    'match'::TEXT AS kind,
    m.id          AS id,
    m.dtstart     AS starts_at,
    t.name || ' gegen ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt') AS title
FROM public.match_participations mp
JOIN public.matches m ON m.id = mp.match_id
JOIN public.teams   t ON t.id = m.team_id
JOIN public.profiles p ON p.id = mp.profile_id
WHERE m.active
  AND m.dtstart > NOW()
  AND p.deleted_at IS NULL
  AND NOT p.no_games
  AND NOT mp.removed
  -- Offen heißt: keine Antwort, oder eine Antwort zu einer überholten Fassung.
  AND (mp.response = 'none' OR COALESCE(mp.version_responded, 0) < m.version);

GRANT SELECT ON public.v_open_participations TO authenticated;

-- ----------------------------------------------------------------------------
-- Einreihen aus dem Hintergrundlauf
-- ----------------------------------------------------------------------------

-- Der Lauf kennt nur Spiel und Person; die Werte für die Vorlage holt die Datenbank
-- selbst. So muss die Edge Function nichts über Vorlagen oder Zeitzonen wissen.
CREATE OR REPLACE FUNCTION public.enqueue_match_reminder(p_match_id UUID, p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.enqueue_notification(
        p_profile_id,
        'match_reminder',
        public.match_payload(p_match_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_match_reminder(UUID, UUID) FROM PUBLIC;

-- Die Hintergrundläufe rufen beides über den `service_role`-Schlüssel. Ohne diese
-- Rechte scheitert der Aufruf still an der fehlenden Berechtigung.
GRANT EXECUTE ON FUNCTION public.enqueue_match_reminder(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(UUID, TEXT, JSONB, BOOLEAN, TIMESTAMPTZ)
    TO service_role;
GRANT SELECT, INSERT ON public.match_reminders, public.open_reminder_log TO service_role;

-- ----------------------------------------------------------------------------
-- Cron: alle zehn Minuten
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.trigger_enqueue_reminders()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, public, pg_temp
AS $$
DECLARE
    v_base   TEXT;
    v_secret TEXT;
BEGIN
    SELECT value INTO v_base   FROM private.cron_config WHERE key = 'functions_base_url';
    SELECT value INTO v_secret FROM private.cron_config WHERE key = 'cron_secret';

    IF COALESCE(v_base, '') = '' OR COALESCE(v_secret, '') = '' THEN
        RAISE NOTICE 'Erinnerungslauf übersprungen: functions_base_url oder cron_secret ist leer.';
        RETURN;
    END IF;

    IF to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') IS NULL THEN
        RAISE NOTICE 'Erinnerungslauf übersprungen: pg_net ist nicht installiert.';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_base || '/enqueue-reminders',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', v_secret
        ),
        body    := '{}'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_enqueue_reminders() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron nicht vorhanden — der Erinnerungslauf wird nicht eingeplant.';
        RETURN;
    END IF;

    PERFORM cron.unschedule('enqueue-reminders')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enqueue-reminders');

    PERFORM cron.schedule(
        'enqueue-reminders',
        '*/10 * * * *',
        $job$ SELECT private.trigger_enqueue_reminders(); $job$
    );
END $$;
