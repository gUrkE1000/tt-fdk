-- ============================================================================
-- Spieler anfragen statt den ganzen Kader (Vereinsentscheidung E-3)
--
-- Bisher galt beim Anlegen eines Spiels der ganze Kader als gefragt, und jedes
-- spielende Mitglied sah die Spiele aller Mannschaften. Ab hier:
--
--   1. Ein Spiel sieht, wer zur Mannschaft gehört (Stamm, Ersatz, Mannschafts-
--      führung), wer für genau dieses Spiel angefragt ist — und der Admin.
--   2. Niemand ist automatisch gefragt. Der Mannschaftsführer wählt je Spiel aus,
--      wen er anfragt (`rpc_request_players`), auf Wunsch für mehrere Spiele auf
--      einmal. Erst die Anfrage legt die Beteiligungszeile an.
--   3. Wer zur Mannschaft gehört, aber nicht gefragt ist, kann sich als verfügbar
--      melden (`match_offers`). Der Mannschaftsführer sieht das und stellt auf.
--   4. Die automatische Ersatzkette ist aus: Alle Mannschaften stehen auf
--      „von Hand".
--
-- Bestehende Spiele: Unbeantwortete automatische Anfragen an künftigen Spielen
-- werden entfernt, damit der Mannschaftsführer auch dort selbst auswählt. Wer
-- schon geantwortet hat, bleibt stehen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Wer ein Spiel sieht
-- ----------------------------------------------------------------------------

-- Gehört der Angemeldete zur Mannschaft — im Kader oder in der Führung?
CREATE OR REPLACE FUNCTION public.belongs_to_team(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
         WHERE team_id = p_team_id AND profile_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.team_leaders
         WHERE team_id = p_team_id AND profile_id = auth.uid()
    );
$$;

-- Die eine Regel, an der alle Policies rund um ein Spiel hängen. SECURITY DEFINER,
-- weil sie match_participations liest, deren Policy wiederum hierher zeigt.
CREATE OR REPLACE FUNCTION public.can_see_match(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.is_playing_member() AND (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.matches m
             WHERE m.id = p_match_id AND public.belongs_to_team(m.team_id)
        )
        OR EXISTS (
            SELECT 1 FROM public.match_participations
             WHERE match_id = p_match_id AND profile_id = auth.uid()
        )
        -- Eine laufende oder frühere Ersatzanfrage: Man muss sehen, wofür man
        -- gefragt wurde.
        OR EXISTS (
            SELECT 1 FROM public.substitute_requests
             WHERE match_id = p_match_id AND profile_id = auth.uid()
        )
    );
$$;

REVOKE ALL ON FUNCTION public.belongs_to_team(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_match(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.belongs_to_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_match(UUID) TO authenticated;

DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches
    FOR SELECT TO authenticated
    USING (public.can_see_match(id));

DROP POLICY IF EXISTS match_participations_select ON public.match_participations;
CREATE POLICY match_participations_select ON public.match_participations
    FOR SELECT TO authenticated
    USING (public.can_see_match(match_id));

DROP POLICY IF EXISTS match_volunteers_select ON public.match_volunteers;
CREATE POLICY match_volunteers_select ON public.match_volunteers
    FOR SELECT TO authenticated
    USING (public.can_see_match(match_id));

-- Eintragen als Fahrer oder für die Verpflegung nur bei Spielen, die man sieht.
DROP POLICY IF EXISTS match_volunteers_write ON public.match_volunteers;
CREATE POLICY match_volunteers_write ON public.match_volunteers
    FOR ALL TO authenticated
    USING (
        (profile_id = auth.uid() AND public.can_see_match(match_id))
        OR public.is_admin() OR public.leads_match(match_id)
    )
    WITH CHECK (
        (profile_id = auth.uid() AND public.can_see_match(match_id))
        OR public.is_admin() OR public.leads_match(match_id)
    );

DROP POLICY IF EXISTS reschedule_polls_select ON public.reschedule_polls;
CREATE POLICY reschedule_polls_select ON public.reschedule_polls
    FOR SELECT TO authenticated
    USING (public.can_see_match(match_id));

DROP POLICY IF EXISTS reschedule_votes_select ON public.reschedule_votes;
CREATE POLICY reschedule_votes_select ON public.reschedule_votes
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.reschedule_polls p
         WHERE p.id = poll_id AND public.can_see_match(p.match_id)
    ));

-- Nachrichten am Spiel folgen dem Spiel.
CREATE OR REPLACE FUNCTION public.can_see_message_object(
    p_type public.message_object,
    p_id   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_type = 'match' THEN
        RETURN EXISTS (SELECT 1 FROM public.matches WHERE id = p_id)
           AND public.can_see_match(p_id);
    ELSIF p_type = 'session' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.training_sessions s
             WHERE s.id = p_id AND public.can_see_training(s.training_id)
        );
    ELSE
        -- Vereinstermine sind vereinsöffentlich.
        RETURN EXISTS (SELECT 1 FROM public.club_events WHERE id = p_id)
           AND public.is_active_member();
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Kein automatisches Fragen mehr
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS matches_seed_participations ON public.matches;
DROP FUNCTION IF EXISTS public.seed_match_participations();

-- Die automatische Ersatzkette ist aus. „Von Hand" heißt: Die Kette räumt nur
-- noch auf (abgelaufene, überholte Anfragen), fragt aber niemanden neu.
ALTER TABLE public.teams ALTER COLUMN substitute_mode SET DEFAULT 'manual';
UPDATE public.teams SET substitute_mode = 'manual' WHERE substitute_mode <> 'manual';

-- ----------------------------------------------------------------------------
-- 3. Vorlagen
-- ----------------------------------------------------------------------------

-- „Neues Spiel" wird zur Anfrage: Diese Nachricht bekommt nur noch, wen der
-- Mannschaftsführer ausgewählt hat. Der Typ bleibt, damit die Einstellungen der
-- Mitglieder weiter gelten.
UPDATE public.notification_templates
   SET label       = 'Anfrage für ein Mannschaftsspiel',
       subject_tpl = 'Anfrage: {{team}} gegen {{opponent}} am {{date}}',
       body_tpl    = E'Hallo {{first_name}},\n\ndu bist für {{team}} gegen {{opponent}} ({{home_away}}) am {{date}} um {{time}} Uhr angefragt. Bist du dabei?\n\n{{link}}',
       updated_at  = NOW()
 WHERE type = 'match_created';

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('match_players_needed', 'Neues Spiel: Spieler anfragen (Mannschaftsführung)',
     'Spieler anfragen: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\nes gibt ein neues Spiel: {{team}} gegen {{opponent}} ({{home_away}}) am {{date}} um {{time}} Uhr.\n\nWähle in der App aus, wen du dafür anfragst.\n\n{{link}}', 16, true),

    ('match_offer', 'Spieler meldet sich verfügbar (Mannschaftsführung)',
     '{{player}} hätte Zeit: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\n{{player}} hat sich für {{team}} gegen {{opponent}} am {{date}} um {{time}} Uhr als verfügbar gemeldet.{{note}}\n\nIn „Spieler verwalten" kannst du {{player}} aufstellen.\n\n{{link}}', 17, true)
ON CONFLICT (type) DO NOTHING;

-- Link auf die Seite des Spiels, ohne Antwort-Token: für Nachrichten an die
-- Mannschaftsführung, die nichts zu- oder absagen soll.
CREATE OR REPLACE FUNCTION public.match_page_payload(p_match_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT (public.match_payload(p_match_id) - 'action' - 'target_id' - 'expires_at')
        || jsonb_build_object(
            'link',
            COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
                || '/match/' || p_match_id::text
        );
$$;

REVOKE ALL ON FUNCTION public.match_page_payload(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Neues Spiel: die Mannschaftsführung wird gebeten, Spieler anzufragen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_match_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_payload JSONB;
    v_leader  RECORD;
BEGIN
    -- Ein Spiel, das schon vorbei ist, braucht niemanden mehr. Das kommt beim
    -- ersten Import einer laufenden Saison regelmäßig vor.
    IF NEW.dtstart < NOW() OR NOT NEW.active THEN
        RETURN NEW;
    END IF;

    v_payload := public.match_page_payload(NEW.id);

    FOR v_leader IN
        SELECT tl.profile_id
          FROM public.team_leaders tl
          JOIN public.profiles p ON p.id = tl.profile_id
         WHERE tl.team_id = NEW.team_id AND p.deleted_at IS NULL
    LOOP
        PERFORM public.enqueue_notification(v_leader.profile_id, 'match_players_needed', v_payload);
    END LOOP;

    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Anfragen und zurückziehen
-- ----------------------------------------------------------------------------

-- Fragt jede der Personen für jedes der Spiele an. Wer schon eine Zeile hat
-- (gefragt, zugesagt, abgesagt, entfernt), wird übersprungen — eine zweite
-- Anfrage an dieselbe Person wäre nur Lärm. Vergangene und abgesagte Spiele
-- werden ebenfalls übersprungen. Gibt die Zahl der neuen Anfragen zurück.
CREATE OR REPLACE FUNCTION public.rpc_request_players(
    p_match_ids   UUID[],
    p_profile_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me       UUID := auth.uid();
    v_match    public.matches%ROWTYPE;
    v_profile  UUID;
    v_payload  JSONB;
    v_inserted INTEGER;
    v_count    INTEGER := 0;
BEGIN
    IF COALESCE(array_length(p_match_ids, 1), 0) = 0
       OR COALESCE(array_length(p_profile_ids, 1), 0) = 0 THEN
        RETURN 0;
    END IF;

    -- Erst alle Rechte prüfen, dann schreiben: Eine halb ausgeführte Anfrage über
    -- mehrere Spiele wäre schwer zu durchschauen.
    IF EXISTS (
        SELECT 1 FROM public.matches m
         WHERE m.id = ANY (p_match_ids)
           AND NOT (public.is_admin() OR public.leads_team(m.team_id))
    ) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    FOR v_match IN
        SELECT * FROM public.matches
         WHERE id = ANY (p_match_ids) AND active AND dtstart > NOW()
         ORDER BY dtstart
    LOOP
        v_payload := public.match_payload(v_match.id);

        FOR v_profile IN
            SELECT p.id
              FROM public.profiles p
             WHERE p.id = ANY (p_profile_ids)
               AND p.deleted_at IS NULL
               AND p.status = 'active'
               AND p.role <> 'guest'
               AND NOT p.no_games
        LOOP
            INSERT INTO public.match_participations
                (match_id, profile_id, response, source, updated_by)
            VALUES (v_match.id, v_profile, 'none', 'leader', v_me)
            ON CONFLICT (match_id, profile_id) DO NOTHING;

            GET DIAGNOSTICS v_inserted = ROW_COUNT;
            IF v_inserted = 0 THEN
                CONTINUE;
            END IF;

            v_count := v_count + 1;
            PERFORM public.enqueue_notification(v_profile, 'match_created', v_payload);

            INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
            VALUES (v_match.id, 'request', jsonb_build_object('profile_id', v_profile), v_me);
        END LOOP;
    END LOOP;

    RETURN v_count;
END;
$$;

-- Eine Anfrage, auf die noch keine Antwort kam, zurücknehmen. Wer schon
-- geantwortet hat, bleibt stehen — dafür gibt es „Entfernen" und „Absage".
CREATE OR REPLACE FUNCTION public.rpc_withdraw_request(p_match_id UUID, p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    DELETE FROM public.match_participations
     WHERE match_id = p_match_id
       AND profile_id = p_profile_id
       AND response = 'none'
       AND NOT removed
       AND lineup_position IS NULL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
        RAISE EXCEPTION 'Diese Anfrage lässt sich nicht zurückziehen — es gibt schon eine Antwort.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Der Antwortlink aus der Anfrage gilt nicht mehr.
    DELETE FROM public.action_tokens
     WHERE action = 'match_response'
       AND target_id = p_match_id
       AND profile_id = p_profile_id
       AND used_at IS NULL;

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (p_match_id, 'withdraw_request', jsonb_build_object('profile_id', p_profile_id), auth.uid());
END;
$$;

-- Zu- oder absagen darf nur, wer gefragt ist. Wer nicht gefragt ist, meldet sich
-- als verfügbar (Abschnitt 6).
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

    SELECT response INTO v_old
      FROM public.match_participations
     WHERE match_id = p_match_id AND profile_id = v_me;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Du bist für dieses Spiel nicht angefragt. Melde dich beim Mannschaftsführer als verfügbar.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_match.team_id;

    -- Meldeschluss der Mannschaft.
    IF v_team.block_participants_after IS NOT NULL
       AND public.berlin_today() > v_team.block_participants_after THEN
        RAISE EXCEPTION
            'Für diese Mannschaft ist die Rückmeldung seit dem % geschlossen. Bitte wende dich an deinen Mannschaftsführer.',
            to_char(v_team.block_participants_after, 'DD.MM.YYYY')
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE public.match_participations
       SET response          = p_response,
           version_responded = v_match.version,
           comment           = COALESCE(p_comment, ''),
           source            = 'self',
           updated_by        = v_me
           -- `removed` bleibt: Eine eigene Zusage hebt die Entfernung durch den MF nicht auf.
     WHERE match_id = p_match_id AND profile_id = v_me;

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

REVOKE ALL ON FUNCTION public.rpc_request_players(UUID[], UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_withdraw_request(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_request_players(UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_withdraw_request(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. „Ich hätte Zeit"
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.match_offers (
    match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    comment    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (match_id, profile_id),
    CONSTRAINT match_offers_comment_length CHECK (length(comment) <= 500)
);

CREATE INDEX IF NOT EXISTS match_offers_profile_idx ON public.match_offers (profile_id);

ALTER TABLE public.match_offers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.match_offers TO authenticated;

-- Das Angebot sieht, wer es gemacht hat, und wer die Mannschaft führt. Geschrieben
-- wird nur über die RPCs.
DROP POLICY IF EXISTS match_offers_select ON public.match_offers;
CREATE POLICY match_offers_select ON public.match_offers
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin() OR public.leads_match(match_id));

CREATE OR REPLACE FUNCTION public.rpc_offer_match(p_match_id UUID, p_comment TEXT DEFAULT '')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me      UUID := auth.uid();
    v_match   public.matches%ROWTYPE;
    v_name    TEXT;
    v_payload JSONB;
    v_note    TEXT := btrim(COALESCE(p_comment, ''));
    v_leader  RECORD;
BEGIN
    IF v_me IS NULL OR NOT public.can_see_match(p_match_id) THEN
        RAISE EXCEPTION 'Dieses Spiel gehört nicht zu deiner Mannschaft.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    IF NOT FOUND OR NOT v_match.active THEN
        RAISE EXCEPTION 'Diesen Spieltermin gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    IF v_match.dtstart < NOW() THEN
        RAISE EXCEPTION 'Das Spiel hat schon begonnen.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.match_participations
         WHERE match_id = p_match_id AND profile_id = v_me
    ) THEN
        RAISE EXCEPTION 'Du bist für dieses Spiel schon angefragt — sag einfach zu oder ab.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF length(v_note) > 500 THEN
        RAISE EXCEPTION 'Der Hinweis ist zu lang (höchstens 500 Zeichen).'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Nur das erste Angebot ist eine Nachricht wert, nicht jede Änderung des Hinweises.
    IF EXISTS (
        SELECT 1 FROM public.match_offers WHERE match_id = p_match_id AND profile_id = v_me
    ) THEN
        UPDATE public.match_offers SET comment = v_note
         WHERE match_id = p_match_id AND profile_id = v_me;
        RETURN;
    END IF;

    INSERT INTO public.match_offers (match_id, profile_id, comment)
    VALUES (p_match_id, v_me, v_note);

    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_me;

    v_payload := public.match_page_payload(p_match_id)
        || jsonb_build_object(
            'player', COALESCE(NULLIF(v_name, ''), 'Jemand'),
            'note',   CASE WHEN v_note = '' THEN '' ELSE E'\n\nHinweis: ' || v_note END
        );

    FOR v_leader IN
        SELECT tl.profile_id
          FROM public.team_leaders tl
          JOIN public.profiles p ON p.id = tl.profile_id
         WHERE tl.team_id = v_match.team_id
           AND p.deleted_at IS NULL
           AND tl.profile_id <> v_me
    LOOP
        PERFORM public.enqueue_notification(v_leader.profile_id, 'match_offer', v_payload);
    END LOOP;

    INSERT INTO public.match_changes (match_id, change_type, new_value, actor)
    VALUES (p_match_id, 'offer', jsonb_build_object('profile_id', v_me), v_me);
END;
$$;

-- Zurückziehen (eigenes Angebot) oder verwerfen (Mannschaftsführung).
CREATE OR REPLACE FUNCTION public.rpc_withdraw_offer(p_match_id UUID, p_profile_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me     UUID := auth.uid();
    v_target UUID := COALESCE(p_profile_id, auth.uid());
BEGIN
    IF v_me IS NULL
       OR (v_target <> v_me AND NOT (public.is_admin() OR public.leads_match(p_match_id))) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    DELETE FROM public.match_offers WHERE match_id = p_match_id AND profile_id = v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_offer_match(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_withdraw_offer(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_offer_match(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_withdraw_offer(UUID, UUID) TO authenticated;

-- Wer gefragt oder aufgestellt wird, hat kein offenes Angebot mehr.
CREATE OR REPLACE FUNCTION public.clear_match_offer()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.match_offers
     WHERE match_id = NEW.match_id AND profile_id = NEW.profile_id;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_match_offer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS match_participations_clear_offer ON public.match_participations;
CREATE TRIGGER match_participations_clear_offer
    AFTER INSERT ON public.match_participations
    FOR EACH ROW EXECUTE FUNCTION public.clear_match_offer();

-- ----------------------------------------------------------------------------
-- 7. Bestehende Spiele
-- ----------------------------------------------------------------------------

-- Unbeantwortete automatische Anfragen an künftigen Spielen entfallen, samt
-- ihrem Antwortlink. Wer geantwortet hat, aufgestellt oder entfernt wurde,
-- bleibt stehen.
WITH gone AS (
    DELETE FROM public.match_participations mp
     USING public.matches m
     WHERE m.id = mp.match_id
       AND m.dtstart > NOW()
       AND mp.source = 'auto'
       AND mp.response = 'none'
       AND mp.version_responded IS NULL
       AND mp.lineup_position IS NULL
       AND NOT mp.removed
    RETURNING mp.match_id, mp.profile_id
)
DELETE FROM public.action_tokens t
 USING gone
 WHERE t.action = 'match_response'
   AND t.target_id = gone.match_id
   AND t.profile_id = gone.profile_id
   AND t.used_at IS NULL;
