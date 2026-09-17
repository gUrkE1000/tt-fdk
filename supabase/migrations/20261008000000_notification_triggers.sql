-- ============================================================================
-- Auslöser für Benachrichtigungen (Aufgabe 4.4)
--
-- Bis hierher gab es das Postfach und den Versand, aber nichts, was etwas
-- einreiht. Das ändert sich hier: Trigger auf `matches` und Ergänzungen in den
-- RPCs aus Aufgabe 3.1.
--
-- Die Auslöser sitzen in der Datenbank, nicht in der Oberfläche. Ein Spiel kann
-- aus dem Browser, aus dem nächtlichen Kalenderabgleich oder aus einer Migration
-- entstehen — die Benachrichtigung soll in allen drei Fällen rausgehen, ohne dass
-- jeder Aufrufer daran denkt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Hilfsfunktion: die Werte eines Spiels für die Vorlagen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_payload(p_match_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'team',      t.name,
        'opponent',  NULLIF(m.opponent, ''),
        'league',    NULLIF(m.league, ''),
        'home_away', CASE WHEN m.is_home THEN 'Heimspiel' ELSE 'Auswärtsspiel' END,
        'date',      to_char(m.dtstart AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
        'time',      to_char(m.dtstart AT TIME ZONE 'Europe/Berlin', 'HH24:MI'),
        'action',    'match_response',
        'target_id', m.id,
        -- Der Antwortlink ist nach dem Spiel wertlos.
        'expires_at', m.dtstart
    )
    FROM public.matches m
    JOIN public.teams t ON t.id = m.team_id
    WHERE m.id = p_match_id;
$$;

REVOKE ALL ON FUNCTION public.match_payload(UUID) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 2. Neues Spiel: der Kader wird gefragt
-- ----------------------------------------------------------------------------

-- Läuft nach `seed_match_participations`, damit die Beteiligungszeilen schon
-- stehen. Die Reihenfolge ergibt sich aus dem Triggernamen — PostgreSQL führt
-- AFTER-Trigger alphabetisch aus, und `z_` kommt nach `s_`.
CREATE OR REPLACE FUNCTION public.notify_match_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_payload JSONB;
    v_member  RECORD;
BEGIN
    -- Ein Spiel, das schon vorbei ist, braucht keine Einladung. Das kommt beim
    -- ersten Import einer laufenden Saison regelmäßig vor.
    IF NEW.dtstart < NOW() OR NOT NEW.active THEN
        RETURN NEW;
    END IF;

    v_payload := public.match_payload(NEW.id);

    FOR v_member IN
        SELECT mp.profile_id
          FROM public.match_participations mp
          JOIN public.profiles p ON p.id = mp.profile_id
         WHERE mp.match_id = NEW.id AND p.deleted_at IS NULL
    LOOP
        PERFORM public.enqueue_notification(v_member.profile_id, 'match_created', v_payload);
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_matches_notify_created ON public.matches;
CREATE TRIGGER z_matches_notify_created
    AFTER INSERT ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.notify_match_created();

-- ----------------------------------------------------------------------------
-- 3. Termin geändert oder abgesagt
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_match_changed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_payload JSONB;
    v_member  RECORD;
    v_changed BOOLEAN;
BEGIN
    -- Zwei Anlässe: die Fassung ist gestiegen (Verlegung), oder das Spiel
    -- entfällt. Alles andere — ein Kommentar, ein Code — ist keine Nachricht wert.
    v_changed := (NEW.version > OLD.version) OR (OLD.active AND NOT NEW.active);

    IF NOT v_changed OR NEW.dtstart < NOW() THEN
        RETURN NEW;
    END IF;

    v_payload := public.match_payload(NEW.id);

    IF NOT NEW.active THEN
        v_payload := v_payload || jsonb_build_object(
            'reason', COALESCE(NEW.cancel_reason, 'Das Spiel entfällt.')
        );
    END IF;

    FOR v_member IN
        SELECT mp.profile_id
          FROM public.match_participations mp
          JOIN public.profiles p ON p.id = mp.profile_id
         WHERE mp.match_id = NEW.id AND p.deleted_at IS NULL
    LOOP
        PERFORM public.enqueue_notification(v_member.profile_id, 'match_changed', v_payload);
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_matches_notify_changed ON public.matches;
CREATE TRIGGER z_matches_notify_changed
    AFTER UPDATE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.notify_match_changed();

-- ----------------------------------------------------------------------------
-- 4. Spielerverwaltung durch den Mannschaftsführer
-- ----------------------------------------------------------------------------

-- `rpc_manage_player` aus Aufgabe 3.1 um die Benachrichtigungen ergänzt. Der
-- Rest der Funktion ist unverändert; sie steht hier vollständig, weil PostgreSQL
-- keine Teiländerung von Funktionen kennt.
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
    v_payload JSONB;
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

    -- Wer auf- oder abgestellt wird, erfährt es. Diese drei Nachrichten sind
    -- Direkt-E-Mails: sie teilen eine fremde Entscheidung über die eigene Zeit
    -- mit und sind deshalb nicht abwählbar.
    IF p_action <> 'reset' AND v_match.dtstart > NOW() THEN
        v_payload := public.match_payload(p_match_id);

        PERFORM public.enqueue_notification(
            p_profile_id,
            CASE p_action
                WHEN 'add'     THEN 'player_added'
                WHEN 'remove'  THEN 'player_removed'
                ELSE                'player_declined'
            END,
            v_payload,
            true
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_manage_player(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_manage_player(UUID, UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Aufstellung von Hand gesetzt
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_set_lineup(p_match_id UUID, p_positions JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me      UUID := auth.uid();
    v_payload JSONB;
    v_member  RECORD;
    v_starts  TIMESTAMPTZ;
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF jsonb_typeof(p_positions) <> 'array' THEN
        RAISE EXCEPTION 'Erwartet wird eine Liste von { profile_id, position }.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Wer vorher schon aufgestellt war, bekommt keine zweite Nachricht.
    CREATE TEMP TABLE IF NOT EXISTS _lineup_before (profile_id UUID) ON COMMIT DROP;
    DELETE FROM _lineup_before;
    INSERT INTO _lineup_before
    SELECT profile_id FROM public.match_participations
     WHERE match_id = p_match_id AND lineup_position IS NOT NULL;

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

    SELECT dtstart INTO v_starts FROM public.matches WHERE id = p_match_id;

    IF v_starts > NOW() THEN
        v_payload := public.match_payload(p_match_id);

        FOR v_member IN
            SELECT mp.profile_id
              FROM public.match_participations mp
             WHERE mp.match_id = p_match_id
               AND mp.lineup_position IS NOT NULL
               AND mp.profile_id NOT IN (SELECT profile_id FROM _lineup_before)
        LOOP
            PERFORM public.enqueue_notification(v_member.profile_id, 'match_assigned', v_payload);
        END LOOP;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_lineup(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_lineup(UUID, JSONB) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Willkommens-E-Mail bei der Freischaltung
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_activate_member(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_status public.member_status;
    v_club   TEXT;
    v_custom TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Nur ein Administrator kann Mitglieder freischalten.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT status INTO v_status
    FROM public.profiles
    WHERE id = p_profile_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dieses Mitglied gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    IF v_status = 'active' THEN
        RETURN;   -- schon freigeschaltet: kein Fehler, nur nichts zu tun
    END IF;

    UPDATE public.profiles
    SET status = 'active'
    WHERE id = p_profile_id;

    SELECT value INTO v_club   FROM public.club_settings WHERE key = 'club_name';
    SELECT value INTO v_custom FROM public.club_settings WHERE key = 'welcome_email_html';

    PERFORM public.enqueue_notification(
        p_profile_id,
        'welcome',
        jsonb_build_object('club', COALESCE(v_club, 'deinem Verein'))
          || CASE WHEN COALESCE(v_custom, '') <> ''
                  THEN jsonb_build_object('custom', v_custom)
                  ELSE '{}'::jsonb
             END,
        true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_activate_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_activate_member(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. Aufstellung per E-Mail an die Aufgestellten
-- ----------------------------------------------------------------------------

-- Der zweite Knopf im Dialog „Aufstellung teilen". Der Text kommt aus der
-- Oberfläche, weil er dort ohnehin steht und der Mannschaftsführer ihn vor dem
-- Versand noch ändern können soll.
CREATE OR REPLACE FUNCTION public.rpc_share_lineup(p_match_id UUID, p_text TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_payload JSONB;
    v_member  RECORD;
    v_count   INTEGER := 0;
BEGIN
    IF NOT (public.is_admin() OR public.leads_match(p_match_id)) THEN
        RAISE EXCEPTION 'Nur der Mannschaftsführer dieser Mannschaft oder ein Administrator darf das.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF COALESCE(TRIM(p_text), '') = '' THEN
        RAISE EXCEPTION 'Der Text darf nicht leer sein.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_payload := public.match_payload(p_match_id) || jsonb_build_object('list', p_text);
    -- Kein Antwortlink: das ist eine Mitteilung, keine Frage.
    v_payload := v_payload - 'action' - 'target_id';

    FOR v_member IN
        SELECT mp.profile_id
          FROM public.match_participations mp
          JOIN public.profiles p ON p.id = mp.profile_id
         WHERE mp.match_id = p_match_id
           AND mp.lineup_position IS NOT NULL
           AND p.deleted_at IS NULL
    LOOP
        PERFORM public.enqueue_notification(v_member.profile_id, 'lineup_shared', v_payload, true);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_share_lineup(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_share_lineup(UUID, TEXT) TO authenticated;
