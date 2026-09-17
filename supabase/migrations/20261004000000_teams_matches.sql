-- ============================================================================
-- Mannschaften, Spieltermine und Beteiligung (Aufgabe 3.1, Zielbild 3.2/3.3)
--
-- Das Herzstück der Anwendung. Drei Entscheidungen prägen dieses Schema:
--
--   1. `matches.dtstart` ist eine generierte Spalte aus `dtstart_override` und
--      `dtstart_external`. Der Importtermin aus click-TT und eine bestätigte
--      Verlegung stehen nebeneinander, statt sich zu überschreiben. So bleibt beim
--      nächsten Abgleich erkennbar, ob der Verband inzwischen nachgezogen hat.
--   2. `match_participations` ist für niemanden direkt beschreibbar. Jede Änderung
--      geht durch eine RPC, die Rechte prüft, den Vorgang protokolliert und die
--      Aufstellung neu berechnet. Eine Policy allein könnte das nicht leisten.
--   3. `version` zählt hoch, sobald ein Abgleich den Termin ändert. Alte Zusagen
--      bleiben stehen, gelten aber nicht mehr: `version_responded < version`. Wer
--      zugesagt hatte, wird erneut gefragt, statt stillschweigend eingeplant zu
--      bleiben.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Aufzählungen
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lineup_mode') THEN
        CREATE TYPE public.lineup_mode AS ENUM ('fixed', 'open');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'substitute_mode') THEN
        CREATE TYPE public.substitute_mode AS ENUM ('sequential', 'parallel', 'manual');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_kind') THEN
        CREATE TYPE public.team_member_kind AS ENUM ('regular', 'substitute');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_source') THEN
        CREATE TYPE public.match_source AS ENUM ('ics', 'manual');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participation_response') THEN
        CREATE TYPE public.participation_response AS ENUM ('none', 'yes', 'no', 'unclear');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participation_source') THEN
        CREATE TYPE public.participation_source AS ENUM ('auto', 'self', 'leader', 'request', 'link');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'volunteer_kind') THEN
        CREATE TYPE public.volunteer_kind AS ENUM ('driver', 'catering');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
        CREATE TYPE public.sync_status AS ENUM ('pending', 'success', 'warning', 'failed');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Mannschaften
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teams (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    color                  TEXT NOT NULL DEFAULT '#1D4ED8',

    -- Stammspieler je Spiel: 4er, 6er, im Jugendbereich auch 2er Mannschaften.
    size                   INTEGER NOT NULL,
    ranking_type           public.ranking_type NOT NULL DEFAULT 'men',
    ranking                INTEGER,
    -- Freitext, weil die Bezeichnungen je Verband verschieden sind.
    leagues                TEXT[] NOT NULL DEFAULT '{}',

    lineup_mode            public.lineup_mode NOT NULL DEFAULT 'fixed',
    substitute_mode        public.substitute_mode NOT NULL DEFAULT 'sequential',
    substitute_timeout_hours INTEGER NOT NULL DEFAULT 24,

    hide_users_no_ranking  BOOLEAN NOT NULL DEFAULT false,
    -- Ab diesem Tag darf niemand mehr selbst antworten (Meldeschluss).
    block_participants_after DATE,

    comment_home_games     TEXT NOT NULL DEFAULT '',
    comment_away_games     TEXT NOT NULL DEFAULT '',
    arrival_minutes_home   INTEGER NOT NULL DEFAULT 60,
    arrival_minutes_away   INTEGER NOT NULL DEFAULT 30,

    manual_request_auto_add BOOLEAN NOT NULL DEFAULT true,
    hide_drivers_catering  BOOLEAN NOT NULL DEFAULT false,
    -- Braunschweiger System: Doppel vor Einzel. Ändert nur die Reihenfolge im Text.
    is_braunschweiger      BOOLEAN NOT NULL DEFAULT false,

    webcal_url             TEXT,
    sync_enabled           BOOLEAN NOT NULL DEFAULT true,
    active                 BOOLEAN NOT NULL DEFAULT true,
    sort_order             INTEGER NOT NULL DEFAULT 0,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT teams_size_check    CHECK (size BETWEEN 1 AND 12),
    CONSTRAINT teams_ranking_check CHECK (ranking IS NULL OR ranking BETWEEN 1 AND 99),
    CONSTRAINT teams_timeout_check CHECK (substitute_timeout_hours BETWEEN 1 AND 336),
    CONSTRAINT teams_arrival_check CHECK (arrival_minutes_home >= 0 AND arrival_minutes_away >= 0)
);

DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
CREATE TRIGGER teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.team_leaders (
    team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.team_members (
    team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    kind       public.team_member_kind NOT NULL DEFAULT 'regular',
    -- Nur für Ersatzspieler: die Reihenfolge, in der gefragt wird.
    rank       INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, profile_id)
);

-- Die Reihenfolge der Ersatzspieler muss eindeutig sein, sonst ist die Ersatzkette
-- (Phase 5) nicht reproduzierbar.
CREATE UNIQUE INDEX IF NOT EXISTS team_members_substitute_rank_unique
    ON public.team_members (team_id, rank)
    WHERE kind = 'substitute' AND rank IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Spieltermine
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.matches (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id            UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    source             public.match_source NOT NULL DEFAULT 'manual',
    -- UID aus dem ICS-Feed. Daran erkennt der Abgleich dasselbe Spiel wieder.
    external_uid       TEXT,

    summary            TEXT NOT NULL DEFAULT '',
    opponent           TEXT NOT NULL DEFAULT '',
    league             TEXT NOT NULL DEFAULT '',
    description        TEXT NOT NULL DEFAULT '',
    location_text      TEXT NOT NULL DEFAULT '',
    venue_id           UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    is_home            BOOLEAN NOT NULL DEFAULT true,

    dtstart_external   TIMESTAMPTZ NOT NULL,
    dtend_external     TIMESTAMPTZ NOT NULL,
    -- Bestätigte Verlegung. Bleibt neben dem Importtermin stehen, damit sichtbar ist,
    -- ob click-TT inzwischen nachgezogen hat.
    dtstart_override   TIMESTAMPTZ,
    dtend_override     TIMESTAMPTZ,
    dtstart            TIMESTAMPTZ GENERATED ALWAYS AS (COALESCE(dtstart_override, dtstart_external)) STORED,
    dtend              TIMESTAMPTZ GENERATED ALWAYS AS (COALESCE(dtend_override, dtend_external)) STORED,

    required_players   INTEGER NOT NULL,
    supervisor_id      UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    comment            TEXT NOT NULL DEFAULT '',
    nuscore_code       TEXT,
    nuscore_pin        TEXT,
    matchday           INTEGER,

    -- Erhöht sich, sobald ein Abgleich Termin oder Ort ändert. Siehe Kopf der Datei.
    version            INTEGER NOT NULL DEFAULT 1,
    active             BOOLEAN NOT NULL DEFAULT true,
    cancel_reason      TEXT,
    lineup_locked      BOOLEAN NOT NULL DEFAULT false,
    last_synced_at     TIMESTAMPTZ,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT matches_required_check CHECK (required_players BETWEEN 1 AND 12),
    CONSTRAINT matches_times_check    CHECK (dtend_external >= dtstart_external),
    CONSTRAINT matches_override_check CHECK (
        dtend_override IS NULL OR dtstart_override IS NULL OR dtend_override >= dtstart_override
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS matches_external_uid_unique
    ON public.matches (team_id, external_uid) WHERE external_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS matches_dtstart_idx ON public.matches (dtstart);
CREATE INDEX IF NOT EXISTS matches_team_idx    ON public.matches (team_id) WHERE active;

DROP TRIGGER IF EXISTS matches_updated_at ON public.matches;
CREATE TRIGGER matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.match_participations (
    match_id         UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    profile_id       UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    response         public.participation_response NOT NULL DEFAULT 'none',
    -- Die Antwort gilt nur, solange sie zur aktuellen Fassung des Termins gehört.
    version_responded INTEGER,
    -- Gesetzt heißt: steht in der Aufstellung. Positionen über `required_players`
    -- hinaus sind die Ersatzbank.
    lineup_position  INTEGER,
    -- „Vorerst entfernt" durch den Mannschaftsführer.
    removed          BOOLEAN NOT NULL DEFAULT false,
    comment          TEXT NOT NULL DEFAULT '',
    source           public.participation_source NOT NULL DEFAULT 'auto',
    updated_by       UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (match_id, profile_id),
    CONSTRAINT match_participations_position_check
        CHECK (lineup_position IS NULL OR lineup_position BETWEEN 1 AND 99)
);

CREATE INDEX IF NOT EXISTS match_participations_profile_idx
    ON public.match_participations (profile_id);

DROP TRIGGER IF EXISTS match_participations_updated_at ON public.match_participations;
CREATE TRIGGER match_participations_updated_at
    BEFORE UPDATE ON public.match_participations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.match_volunteers (
    match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    kind       public.volunteer_kind NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (match_id, profile_id, kind)
);

-- Prüfprotokoll. Jede RPC schreibt hier hinein: wer hat wann was geändert.
CREATE TABLE IF NOT EXISTS public.match_changes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL,
    old_value   JSONB,
    new_value   JSONB,
    actor       UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS match_changes_match_idx
    ON public.match_changes (match_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sync_runs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status       public.sync_status NOT NULL DEFAULT 'pending',
    summary      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS sync_runs_started_idx ON public.sync_runs (started_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Rechte-Helfer
-- ----------------------------------------------------------------------------

-- Führt der Angemeldete diese Mannschaft? Wie die übrigen Helfer SECURITY DEFINER
-- mit festem search_path, sonst liefe die Policy in eine Rekursion.
CREATE OR REPLACE FUNCTION public.leads_team(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_leaders
         WHERE team_id = p_team_id AND profile_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.leads_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.matches m
          JOIN public.team_leaders tl ON tl.team_id = m.team_id
         WHERE m.id = p_match_id AND tl.profile_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.leads_team(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leads_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leads_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leads_match(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Trigger
-- ----------------------------------------------------------------------------

-- Mehr Stammspieler als Mannschaftsgröße ergibt keinen Sinn: bei einem 4er-Team
-- stehen vier Leute am Tisch, alle weiteren sind Ersatz.
CREATE OR REPLACE FUNCTION public.check_team_member_limits()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_size    INTEGER;
    v_regular INTEGER;
BEGIN
    IF NEW.kind = 'regular' THEN
        SELECT size INTO v_size FROM public.teams WHERE id = NEW.team_id;

        SELECT count(*) INTO v_regular
          FROM public.team_members
         WHERE team_id = NEW.team_id
           AND kind = 'regular'
           AND profile_id <> NEW.profile_id;

        IF v_regular + 1 > v_size THEN
            RAISE EXCEPTION
                'Diese Mannschaft hat % Stammspieler; mehr passen nicht. Trage weitere Spieler als Ersatz ein.',
                v_size
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- Ein Rang ergibt nur bei Ersatzspielern Sinn.
    IF NEW.kind = 'regular' THEN
        NEW.rank := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_limits ON public.team_members;
CREATE TRIGGER team_members_limits
    BEFORE INSERT OR UPDATE ON public.team_members
    FOR EACH ROW EXECUTE FUNCTION public.check_team_member_limits();

-- Ein neues Spiel übernimmt die Mannschaftsgröße als Sollzahl, wenn nichts
-- anderes gesagt wird.
CREATE OR REPLACE FUNCTION public.default_required_players()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.required_players IS NULL THEN
        SELECT size INTO NEW.required_players FROM public.teams WHERE id = NEW.team_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_default_required ON public.matches;
CREATE TRIGGER matches_default_required
    BEFORE INSERT ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.default_required_players();

-- Jeder im Kader bekommt beim Anlegen des Spiels eine Zeile mit `none`. Ohne sie
-- wüsste niemand, wer überhaupt gefragt ist — und die Liste „offen" wäre leer.
CREATE OR REPLACE FUNCTION public.seed_match_participations()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.match_participations (match_id, profile_id, response, source)
    SELECT NEW.id, tm.profile_id, 'none', 'auto'
      FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
     WHERE tm.team_id = NEW.team_id
       AND p.deleted_at IS NULL
       AND NOT p.no_games
    ON CONFLICT (match_id, profile_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_seed_participations ON public.matches;
CREATE TRIGGER matches_seed_participations
    AFTER INSERT ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.seed_match_participations();

-- ----------------------------------------------------------------------------
-- 6. Aufstellung berechnen
-- ----------------------------------------------------------------------------

-- Wer zugesagt hat, steht in der Aufstellung — in dieser Reihenfolge:
--   1. Stammspieler nach ihrem Rang in der Altersklasse der Mannschaft, dann nach Namen
--   2. Ersatzspieler nach ihrem Ersatzrang
--   3. alle übrigen Zusagen nach Namen
-- Positionen über `required_players` hinaus sind die Ersatzbank.
--
-- Die Funktion fasst ein Spiel nicht an, sobald der Mannschaftsführer die Aufstellung
-- selbst gesetzt hat (`lineup_locked`) oder die Mannschaft auf `open` steht.
CREATE OR REPLACE FUNCTION public.recompute_lineup(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_team_id      UUID;
    v_ranking_type public.ranking_type;
    v_mode         public.lineup_mode;
    v_locked       BOOLEAN;
BEGIN
    SELECT m.team_id, t.ranking_type, t.lineup_mode, m.lineup_locked
      INTO v_team_id, v_ranking_type, v_mode, v_locked
      FROM public.matches m
      JOIN public.teams t ON t.id = m.team_id
     WHERE m.id = p_match_id;

    IF NOT FOUND OR v_locked OR v_mode = 'open' THEN
        RETURN;
    END IF;

    WITH candidates AS (
        SELECT
            mp.profile_id,
            CASE tm.kind WHEN 'regular' THEN 0 WHEN 'substitute' THEN 1 ELSE 2 END AS grp,
            mr.team_number,
            mr.position_number,
            tm.rank,
            p.full_name
          FROM public.match_participations mp
          JOIN public.profiles p ON p.id = mp.profile_id
          LEFT JOIN public.team_members tm
                 ON tm.team_id = v_team_id AND tm.profile_id = mp.profile_id
          LEFT JOIN public.member_rankings mr
                 ON mr.profile_id = mp.profile_id AND mr.ranking_type = v_ranking_type
         WHERE mp.match_id = p_match_id
           AND mp.response = 'yes'
           AND NOT mp.removed
           AND p.deleted_at IS NULL
    ),
    ordered AS (
        SELECT
            profile_id,
            ROW_NUMBER() OVER (
                ORDER BY
                    -- Erst die Gruppe, dann innerhalb der Gruppe das passende Kriterium:
                    -- Stammspieler nach ihrem Rang in der Altersklasse, Ersatzspieler nach
                    -- ihrem Ersatzrang. Beides zu mischen würde die Ersatzreihenfolge
                    -- aushebeln, auf die sich die Ersatzkette verlässt.
                    COALESCE(grp, 2),
                    CASE WHEN grp = 0 THEN team_number END NULLS LAST,
                    CASE WHEN grp = 0 THEN position_number END NULLS LAST,
                    CASE WHEN grp = 1 THEN rank END NULLS LAST,
                    full_name
            ) AS position
          FROM candidates
    )
    UPDATE public.match_participations mp
       SET lineup_position = ordered.position
      FROM ordered
     WHERE mp.match_id = p_match_id AND mp.profile_id = ordered.profile_id
       AND mp.lineup_position IS DISTINCT FROM ordered.position;

    -- Wer nicht (mehr) zusagt, verliert seinen Platz.
    UPDATE public.match_participations
       SET lineup_position = NULL
     WHERE match_id = p_match_id
       AND lineup_position IS NOT NULL
       AND (response <> 'yes' OR removed);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_lineup(UUID) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 7. RPCs für die Beteiligung
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_set_match_response(
    p_match_id UUID,
    p_response public.participation_response,
    p_comment  TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me       UUID := auth.uid();
    v_match    public.matches%ROWTYPE;
    v_team     public.teams%ROWTYPE;
    v_old      public.participation_response;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können zu- oder absagen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND OR NOT v_match.active THEN
        RAISE EXCEPTION 'Diesen Spieltermin gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_match.team_id;

    -- Meldeschluss der Mannschaft.
    IF v_team.block_participants_after IS NOT NULL
       AND CURRENT_DATE > v_team.block_participants_after THEN
        RAISE EXCEPTION
            'Für diese Mannschaft ist die Rückmeldung seit dem % geschlossen. Bitte wende dich an deinen Mannschaftsführer.',
            to_char(v_team.block_participants_after, 'DD.MM.YYYY')
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT response INTO v_old
      FROM public.match_participations
     WHERE match_id = p_match_id AND profile_id = v_me;

    INSERT INTO public.match_participations AS mp
        (match_id, profile_id, response, version_responded, comment, source, updated_by)
    VALUES
        (p_match_id, v_me, p_response, v_match.version, COALESCE(p_comment, ''), 'self', v_me)
    ON CONFLICT (match_id, profile_id) DO UPDATE
       SET response          = EXCLUDED.response,
           version_responded = EXCLUDED.version_responded,
           comment           = EXCLUDED.comment,
           source            = 'self',
           updated_by        = v_me,
           -- Eine eigene Zusage hebt die Entfernung durch den MF nicht auf.
           removed           = mp.removed;

    INSERT INTO public.match_changes (match_id, change_type, old_value, new_value, actor)
    VALUES (
        p_match_id,
        'response',
        jsonb_build_object('profile_id', v_me, 'response', v_old),
        jsonb_build_object('profile_id', v_me, 'response', p_response),
        v_me
    );

    PERFORM public.recompute_lineup(p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manage_player(
    p_match_id   UUID,
    p_profile_id UUID,
    p_action     TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me      UUID := auth.uid();
    v_match   public.matches%ROWTYPE;
    v_old     public.match_participations%ROWTYPE;
    v_next    INTEGER;
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_action NOT IN ('add', 'remove', 'decline', 'reset') THEN
        RAISE EXCEPTION 'Unbekannte Aktion: %', p_action USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diesen Spieltermin gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    SELECT * INTO v_old
      FROM public.match_participations
     WHERE match_id = p_match_id AND profile_id = p_profile_id;

    INSERT INTO public.match_participations (match_id, profile_id, source, updated_by)
    VALUES (p_match_id, p_profile_id, 'leader', v_me)
    ON CONFLICT (match_id, profile_id) DO NOTHING;

    IF p_action = 'add' THEN
        SELECT COALESCE(MAX(lineup_position), 0) + 1 INTO v_next
          FROM public.match_participations WHERE match_id = p_match_id;

        UPDATE public.match_participations
           SET response = 'yes', removed = false, version_responded = v_match.version,
               lineup_position = COALESCE(lineup_position, v_next),
               source = 'leader', updated_by = v_me
         WHERE match_id = p_match_id AND profile_id = p_profile_id;

    ELSIF p_action = 'remove' THEN
        UPDATE public.match_participations
           SET removed = true, lineup_position = NULL, source = 'leader', updated_by = v_me
         WHERE match_id = p_match_id AND profile_id = p_profile_id;

    ELSIF p_action = 'decline' THEN
        UPDATE public.match_participations
           SET response = 'no', version_responded = v_match.version,
               lineup_position = NULL, source = 'leader', updated_by = v_me
         WHERE match_id = p_match_id AND profile_id = p_profile_id;

    ELSE  -- reset
        UPDATE public.match_participations
           SET response = 'none', removed = false, version_responded = NULL,
               lineup_position = NULL, comment = '', source = 'leader', updated_by = v_me
         WHERE match_id = p_match_id AND profile_id = p_profile_id;
    END IF;

    INSERT INTO public.match_changes (match_id, change_type, old_value, new_value, actor)
    VALUES (
        p_match_id,
        'manage_player',
        jsonb_build_object('profile_id', p_profile_id, 'response', v_old.response, 'removed', v_old.removed),
        jsonb_build_object('profile_id', p_profile_id, 'action', p_action),
        v_me
    );

    PERFORM public.recompute_lineup(p_match_id);
END;
$$;

-- Positionen von Hand setzen. Ab dann fasst die Automatik das Spiel nicht mehr an —
-- sonst würde sie die Entscheidung des Mannschaftsführers beim nächsten Anlass
-- wieder überschreiben.
CREATE OR REPLACE FUNCTION public.rpc_set_lineup(p_match_id UUID, p_positions JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me UUID := auth.uid();
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF jsonb_typeof(p_positions) <> 'array' THEN
        RAISE EXCEPTION 'Erwartet wird eine Liste von { profile_id, position }.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    UPDATE public.match_participations
       SET lineup_position = NULL
     WHERE match_id = p_match_id;

    UPDATE public.match_participations mp
       SET lineup_position = input.position,
           updated_by = v_me
      FROM (
        SELECT (entry ->> 'profile_id')::UUID AS profile_id,
               (entry ->> 'position')::INTEGER AS position
          FROM jsonb_array_elements(p_positions) AS entry
      ) AS input
     WHERE mp.match_id = p_match_id AND mp.profile_id = input.profile_id;

    UPDATE public.matches SET lineup_locked = true WHERE id = p_match_id;

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (p_match_id, 'set_lineup', p_positions, v_me);
END;
$$;

-- Zurück zur Automatik.
CREATE OR REPLACE FUNCTION public.rpc_unlock_lineup(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE public.matches SET lineup_locked = false WHERE id = p_match_id;

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (p_match_id, 'unlock_lineup', 'null'::jsonb, auth.uid());

    PERFORM public.recompute_lineup(p_match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_match_response(UUID, public.participation_response, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_manage_player(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_set_lineup(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_unlock_lineup(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_set_match_response(UUID, public.participation_response, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_manage_player(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_lineup(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_unlock_lineup(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_volunteers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_changes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs            ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.teams, public.team_leaders, public.team_members,
       public.matches, public.match_participations, public.match_volunteers,
       public.match_changes, public.sync_runs
    TO authenticated;

-- --- teams -------------------------------------------------------------------
DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS teams_write ON public.teams;
CREATE POLICY teams_write ON public.teams
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --- team_leaders ------------------------------------------------------------
DROP POLICY IF EXISTS team_leaders_select ON public.team_leaders;
CREATE POLICY team_leaders_select ON public.team_leaders
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS team_leaders_write ON public.team_leaders;
CREATE POLICY team_leaders_write ON public.team_leaders
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --- team_members ------------------------------------------------------------
-- Den Kader pflegt der Mannschaftsführer selbst; wer ihn führt, entscheidet der Admin.
DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS team_members_write ON public.team_members;
CREATE POLICY team_members_write ON public.team_members
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.leads_team(team_id))
    WITH CHECK (public.is_admin() OR public.leads_team(team_id));

-- --- matches -----------------------------------------------------------------
DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS matches_insert ON public.matches;
CREATE POLICY matches_insert ON public.matches
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.leads_team(team_id));

DROP POLICY IF EXISTS matches_update ON public.matches;
CREATE POLICY matches_update ON public.matches
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.leads_team(team_id))
    WITH CHECK (public.is_admin() OR public.leads_team(team_id));

DROP POLICY IF EXISTS matches_delete ON public.matches;
CREATE POLICY matches_delete ON public.matches
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- --- match_participations ----------------------------------------------------
-- Lesen dürfen alle aktiven Mitglieder, schreiben direkt niemand: jede Änderung
-- geht durch eine RPC, die Rechte prüft, protokolliert und neu berechnet.
DROP POLICY IF EXISTS match_participations_select ON public.match_participations;
CREATE POLICY match_participations_select ON public.match_participations
    FOR SELECT TO authenticated
    USING (public.is_active_member());

-- --- match_volunteers --------------------------------------------------------
DROP POLICY IF EXISTS match_volunteers_select ON public.match_volunteers;
CREATE POLICY match_volunteers_select ON public.match_volunteers
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS match_volunteers_write ON public.match_volunteers;
CREATE POLICY match_volunteers_write ON public.match_volunteers
    FOR ALL TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin() OR public.leads_match(match_id))
    WITH CHECK (profile_id = auth.uid() OR public.is_admin() OR public.leads_match(match_id));

-- --- match_changes -----------------------------------------------------------
-- Nur lesen, und nur wer die Mannschaft führt oder Admin ist. Geschrieben wird
-- ausschließlich aus den RPCs heraus.
DROP POLICY IF EXISTS match_changes_select ON public.match_changes;
CREATE POLICY match_changes_select ON public.match_changes
    FOR SELECT TO authenticated
    USING (public.is_admin() OR public.leads_match(match_id));

-- --- sync_runs ---------------------------------------------------------------
DROP POLICY IF EXISTS sync_runs_select ON public.sync_runs;
CREATE POLICY sync_runs_select ON public.sync_runs
    FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_member_role() = 'team_leader');

-- ----------------------------------------------------------------------------
-- 9. Sicht auf den Stand der Aufstellung (Zielbild 3.7)
-- ----------------------------------------------------------------------------

-- Genau die sechs Abschnitte des Dialogs „Spieler verwalten". Die Einstufung gehört
-- in die Datenbank, damit Oberfläche, Benachrichtigungen und Ersatzkette dieselbe
-- Antwort bekommen.
CREATE OR REPLACE VIEW public.v_match_lineup_status
WITH (security_invoker = true) AS
SELECT
    mp.match_id,
    mp.profile_id,
    CASE
        WHEN mp.removed                         THEN 'removed'
        WHEN mp.lineup_position IS NOT NULL
             AND mp.response = 'yes'            THEN 'lineup'
        WHEN mp.response = 'no'                 THEN 'declined'
        WHEN mp.response = 'unclear'            THEN 'unclear'
        WHEN EXISTS (
            SELECT 1 FROM public.absences a
             WHERE a.profile_id = mp.profile_id
               AND m.dtstart::date BETWEEN a.start_date AND a.end_date
        )                                       THEN 'absent'
        ELSE 'open'
    END AS status
FROM public.match_participations mp
JOIN public.matches m ON m.id = mp.match_id;

GRANT SELECT ON public.v_match_lineup_status TO authenticated;
