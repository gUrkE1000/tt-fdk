-- ============================================================================
-- Umfragen (Aufgabe 7.2, Zielbild 3.5)
--
-- „Wer kann beim Aufbau helfen?", „Welches Datum passt für die Weihnachtsfeier?".
--
-- Drei Entscheidungen prägen das Schema:
--
--   1. **Adressierung über Zielzeilen.** Keine Zeile in `poll_targets` heißt: der
--      ganze Verein. Mannschaften und Gruppen lassen sich mischen — genau wie im
--      TT-Planer.
--   2. **Eine Zeile je Stimme**, nicht ein Feld je Person. Bei
--      `max_answers > 1` gibt jemand mehrere Stimmen ab; eine Spalte müsste dann
--      eine Liste halten, und Listen in Spalten lassen sich nicht auszählen.
--   3. **`hide_results` ist eine Rechtefrage.** Wer die Ergebnisse nicht sehen soll,
--      darf sie auch nicht abfragen können. Das entscheidet die RLS, nicht die
--      Oberfläche.
--
-- Die Terminumfrage zur Spielverlegung (Aufgabe 5.5) ist bewusst ein eigener
-- Mechanismus und läuft **nicht** hierüber: Dort geht es um „wann kannst du",
-- nicht um „was willst du", und daran hängt eine Verlegung.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poll_type') THEN
        CREATE TYPE public.poll_type AS ENUM (
            'vote',    -- Umfrage/Abstimmung: gezählt wird
            'persons'  -- Personen: aufgelistet wird, wer sich einträgt
        );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Tabellen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.polls (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         TEXT NOT NULL,
    details_html  TEXT NOT NULL DEFAULT '',
    type          public.poll_type NOT NULL DEFAULT 'vote',
    -- 1 = Einfachauswahl, größer = Mehrfachauswahl.
    max_answers   INTEGER NOT NULL DEFAULT 1,
    expires_at    TIMESTAMPTZ,
    hide_results  BOOLEAN NOT NULL DEFAULT false,
    created_by    UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT polls_max_answers_check CHECK (max_answers BETWEEN 1 AND 50)
);

DROP TRIGGER IF EXISTS polls_updated_at ON public.polls;
CREATE TRIGGER polls_updated_at
    BEFORE UPDATE ON public.polls
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Keine Zeile = der ganze Verein.
CREATE TABLE IF NOT EXISTS public.poll_targets (
    poll_id  UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    team_id  UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,

    CONSTRAINT poll_targets_one_check CHECK ((team_id IS NULL) <> (group_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_targets_team_unique
    ON public.poll_targets (poll_id, team_id) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS poll_targets_group_unique
    ON public.poll_targets (poll_id, group_id) WHERE group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.poll_options (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id  UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS poll_options_poll_idx ON public.poll_options (poll_id, position);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    option_id  UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (option_id, profile_id)
);

CREATE INDEX IF NOT EXISTS poll_votes_profile_idx ON public.poll_votes (profile_id);

-- ----------------------------------------------------------------------------
-- 2. Rechte-Helfer
-- ----------------------------------------------------------------------------

-- Ist der Angemeldete gemeint? Ohne Zielzeilen ist es der ganze Verein.
CREATE OR REPLACE FUNCTION public.is_poll_target(p_poll_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.is_active_member() AND (
        NOT EXISTS (SELECT 1 FROM public.poll_targets WHERE poll_id = p_poll_id)
        OR EXISTS (
            SELECT 1
              FROM public.poll_targets pt
              JOIN public.team_members tm
                ON tm.team_id = pt.team_id AND tm.profile_id = auth.uid()
             WHERE pt.poll_id = p_poll_id
        )
        OR EXISTS (
            SELECT 1
              FROM public.poll_targets pt
              JOIN public.group_members gm
                ON gm.group_id = pt.group_id AND gm.profile_id = auth.uid()
             WHERE pt.poll_id = p_poll_id
        )
    );
$$;

-- Darf der Angemeldete die Ergebnisse sehen? „Antworten für Mitglieder nicht
-- anzeigen" gilt für Mitglieder, nicht für den, der die Umfrage führt.
CREATE OR REPLACE FUNCTION public.may_see_poll_results(p_poll_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.is_organizer_or_admin() OR EXISTS (
        SELECT 1 FROM public.polls p
         WHERE p.id = p_poll_id
           AND NOT p.hide_results
           AND public.is_poll_target(p_poll_id)
    );
$$;

REVOKE ALL ON FUNCTION public.is_poll_target(UUID)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.may_see_poll_results(UUID)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_poll_target(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.may_see_poll_results(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Abstimmen
--
-- Eine Funktion statt einer Policy, weil drei Dinge zusammen geprüft werden
-- müssen: ob die Umfrage noch läuft, ob die Person gemeint ist, und ob sie nicht
-- mehr Kreuze macht als erlaubt. Eine Policy sieht immer nur eine Zeile und könnte
-- die dritte Frage gar nicht beantworten.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_vote_poll(p_option_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me      UUID := auth.uid();
    v_options UUID[] := COALESCE(p_option_ids, ARRAY[]::UUID[]);
    v_polls   UUID[];
    v_poll    public.polls%ROWTYPE;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können abstimmen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT array_agg(DISTINCT o.poll_id) INTO v_polls
      FROM public.poll_options o
     WHERE o.id = ANY (v_options);

    -- Eine leere Auswahl zieht die eigene Stimme zurück. Dafür muss aber klar sein,
    -- aus welcher Umfrage — deshalb geht es nur mit mindestens einer Option.
    IF v_polls IS NULL OR array_length(v_polls, 1) IS NULL THEN
        RETURN jsonb_build_object('status', 'unknown_option');
    END IF;

    IF array_length(v_polls, 1) > 1 THEN
        RETURN jsonb_build_object('status', 'mixed_polls');
    END IF;

    SELECT * INTO v_poll FROM public.polls WHERE id = v_polls[1];
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'gone');
    END IF;

    IF v_poll.expires_at IS NOT NULL AND v_poll.expires_at < NOW() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    IF NOT public.is_poll_target(v_poll.id) THEN
        RETURN jsonb_build_object('status', 'not_invited');
    END IF;

    IF array_length(v_options, 1) > v_poll.max_answers THEN
        RETURN jsonb_build_object(
            'status', 'too_many', 'max', v_poll.max_answers
        );
    END IF;

    -- Die Stimme wird ersetzt, nicht ergänzt: Wer umentscheidet, soll nicht erst
    -- abwählen müssen.
    DELETE FROM public.poll_votes v
     USING public.poll_options o
     WHERE v.option_id = o.id
       AND o.poll_id = v_poll.id
       AND v.profile_id = v_me;

    INSERT INTO public.poll_votes (option_id, profile_id)
    SELECT unnest(v_options), v_me
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('status', 'ok', 'count', array_length(v_options, 1));
END;
$$;

-- Stimme ganz zurückziehen.
CREATE OR REPLACE FUNCTION public.rpc_retract_poll_vote(p_poll_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me   UUID := auth.uid();
    v_poll public.polls%ROWTYPE;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können abstimmen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_poll FROM public.polls WHERE id = p_poll_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'gone'); END IF;

    IF v_poll.expires_at IS NOT NULL AND v_poll.expires_at < NOW() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    DELETE FROM public.poll_votes v
     USING public.poll_options o
     WHERE v.option_id = o.id AND o.poll_id = p_poll_id AND v.profile_id = v_me;

    RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vote_poll(UUID[])         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_retract_poll_vote(UUID)   FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vote_poll(UUID[])       TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_retract_poll_vote(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes   ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.polls, public.poll_targets, public.poll_options, public.poll_votes
    TO authenticated;

-- Eine Umfrage sieht, wer gemeint ist — und wer sie führt.
DROP POLICY IF EXISTS polls_select ON public.polls;
CREATE POLICY polls_select ON public.polls
    FOR SELECT TO authenticated
    USING (public.is_organizer_or_admin() OR public.is_poll_target(id));

DROP POLICY IF EXISTS polls_write ON public.polls;
CREATE POLICY polls_write ON public.polls
    FOR ALL TO authenticated
    USING (public.is_organizer_or_admin())
    WITH CHECK (public.is_organizer_or_admin());

DROP POLICY IF EXISTS poll_targets_select ON public.poll_targets;
CREATE POLICY poll_targets_select ON public.poll_targets
    FOR SELECT TO authenticated
    USING (public.is_organizer_or_admin() OR public.is_poll_target(poll_id));

DROP POLICY IF EXISTS poll_targets_write ON public.poll_targets;
CREATE POLICY poll_targets_write ON public.poll_targets
    FOR ALL TO authenticated
    USING (public.is_organizer_or_admin())
    WITH CHECK (public.is_organizer_or_admin());

DROP POLICY IF EXISTS poll_options_select ON public.poll_options;
CREATE POLICY poll_options_select ON public.poll_options
    FOR SELECT TO authenticated
    USING (public.is_organizer_or_admin() OR public.is_poll_target(poll_id));

DROP POLICY IF EXISTS poll_options_write ON public.poll_options;
CREATE POLICY poll_options_write ON public.poll_options
    FOR ALL TO authenticated
    USING (public.is_organizer_or_admin())
    WITH CHECK (public.is_organizer_or_admin());

-- Die eigene Stimme sieht man immer — sonst wüsste man nicht, was man angekreuzt
-- hat. Fremde Stimmen nur, wenn die Ergebnisse offen sind. Geschrieben wird
-- ausschließlich über die RPC.
DROP POLICY IF EXISTS poll_votes_select ON public.poll_votes;
CREATE POLICY poll_votes_select ON public.poll_votes
    FOR SELECT TO authenticated
    USING (
        profile_id = auth.uid()
        OR public.may_see_poll_results(
            (SELECT poll_id FROM public.poll_options WHERE id = option_id)
        )
    );

-- ----------------------------------------------------------------------------
-- 5. Ergebnisse
--
-- Bewusst **ohne** security_invoker, wie der Zähler beim Training: Eine Auszählung
-- soll die volle Zahl nennen, nicht die Zahl der sichtbaren Zeilen. Wer sie sehen
-- darf, entscheidet die WHERE-Bedingung.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_poll_results AS
SELECT
    o.poll_id,
    o.id       AS option_id,
    o.text,
    o.position,
    COUNT(v.profile_id)::int AS votes
FROM public.poll_options o
LEFT JOIN public.poll_votes v ON v.option_id = o.id
WHERE public.may_see_poll_results(o.poll_id)
GROUP BY o.poll_id, o.id, o.text, o.position;

GRANT SELECT ON public.v_poll_results TO authenticated;

-- Wer hat was angekreuzt. Für den Typ „Personen" ist genau das die Antwort;
-- security_invoker, damit die Policy auf `poll_votes` weiter gilt.
CREATE OR REPLACE VIEW public.v_poll_voters
WITH (security_invoker = true) AS
SELECT
    o.poll_id,
    v.option_id,
    v.profile_id,
    p.full_name
FROM public.poll_votes v
JOIN public.poll_options o ON o.id = v.option_id
JOIN public.profiles p     ON p.id = v.profile_id;

GRANT SELECT ON public.v_poll_voters TO authenticated;
