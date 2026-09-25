-- ============================================================================
-- Mannschaftsführung: Meldung bei Absage, eine Nachricht für viele neue Spiele
--
-- Seit Vereinsentscheidung E-1 steht jede Mannschaft auf „von Hand". Die
-- Ersatzkette meldet in diesem Modus nichts mehr, der Mannschaftsführer erfuhr
-- von einer Absage also nur, wenn er selbst nachsah. Und beim Import einer
-- Halbserie bekam er für jedes neue Spiel eine eigene E-Mail.
--
--   1. Sagt ein angefragter Spieler selbst ab (in der App oder über den Link),
--      bekommt die Mannschaftsführung `match_declined` — mit dem Stand der
--      Zusagen.
--   2. „Neues Spiel: Spieler anfragen" wird gesammelt: Kommen mehrere Spiele
--      kurz nacheinander herein, geht eine Nachricht mit allen heraus.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Absage
-- ----------------------------------------------------------------------------

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('match_declined', 'Spieler sagt ab (Mannschaftsführung)',
     '{{player}} sagt ab: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\n{{player}} hat für {{team}} gegen {{opponent}} ({{home_away}}) am {{date}} um {{time}} Uhr abgesagt.{{note}}\n\n{{lineup}}\n\n{{link}}', 18, true)
ON CONFLICT (type) DO NOTHING;

-- Nur eigene Absagen: Setzt der Mannschaftsführer jemanden auf Absage, weiß er es
-- schon. Ebenso wenig zählt eine Absage, die schon bestand — eine geänderte
-- Bemerkung ist keine neue Nachricht wert.
CREATE OR REPLACE FUNCTION public.notify_match_declined()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_match     public.matches%ROWTYPE;
    v_name      TEXT;
    v_confirmed INTEGER;
    v_lineup    TEXT;
    v_note      TEXT := btrim(COALESCE(NEW.comment, ''));
    v_payload   JSONB;
    v_leader    RECORD;
BEGIN
    IF NEW.response <> 'no' OR NEW.removed OR NEW.source NOT IN ('self', 'link') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.response = 'no' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = NEW.match_id;
    IF NOT FOUND OR NOT v_match.active OR v_match.dtstart < NOW() THEN
        RETURN NEW;
    END IF;

    SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.profile_id;

    SELECT count(*) INTO v_confirmed
      FROM public.match_participations mp
      JOIN public.profiles p ON p.id = mp.profile_id
     WHERE mp.match_id = NEW.match_id
       AND mp.response = 'yes'
       AND NOT mp.removed
       AND p.deleted_at IS NULL;

    v_lineup := CASE
        WHEN v_confirmed >= v_match.required_players THEN
            format('Es sind trotzdem genug Zusagen da (%s von %s).',
                   v_confirmed, v_match.required_players)
        ELSE
            format('Stand: %s von %s Zusagen. In „Spieler verwalten" kannst du jemand anderen anfragen.',
                   v_confirmed, v_match.required_players)
    END;

    v_payload := public.match_page_payload(NEW.match_id)
        || jsonb_build_object(
            'player', COALESCE(NULLIF(v_name, ''), 'Jemand'),
            'note',   CASE WHEN v_note = '' THEN '' ELSE E'\n\nBemerkung: ' || v_note END,
            'lineup', v_lineup
        );

    FOR v_leader IN
        SELECT tl.profile_id
          FROM public.team_leaders tl
          JOIN public.profiles p ON p.id = tl.profile_id
         WHERE tl.team_id = v_match.team_id
           AND p.deleted_at IS NULL
           AND tl.profile_id <> NEW.profile_id
    LOOP
        PERFORM public.enqueue_notification(v_leader.profile_id, 'match_declined', v_payload);
    END LOOP;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_declined() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS match_participations_notify_declined ON public.match_participations;
CREATE TRIGGER match_participations_notify_declined
    AFTER INSERT OR UPDATE OF response ON public.match_participations
    FOR EACH ROW EXECUTE FUNCTION public.notify_match_declined();

-- ----------------------------------------------------------------------------
-- 2. Neue Spiele gesammelt melden
-- ----------------------------------------------------------------------------

-- So lange wartet die Nachricht, ob noch weitere Spiele nachkommen. Ein Import
-- legt alle Spiele in wenigen Sekunden an; jedes weitere Spiel schiebt den
-- Versand wieder um diese Zeit hinaus.
CREATE OR REPLACE FUNCTION public.match_batch_delay()
RETURNS INTERVAL
LANGUAGE sql IMMUTABLE
AS $$ SELECT INTERVAL '10 minutes' $$;

REVOKE ALL ON FUNCTION public.match_batch_delay() FROM PUBLIC, anon, authenticated;

-- Die Nutzlast für eine Liste neuer Spiele. Vergangene und abgesagte fallen
-- heraus; bleibt keins übrig, ist das Ergebnis NULL.
CREATE OR REPLACE FUNCTION public.match_batch_payload(p_match_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_ids     UUID[];
    v_lines   TEXT[];
    v_count   INTEGER;
    v_first   JSONB;
    v_app_url TEXT;
BEGIN
    SELECT array_agg(m.id ORDER BY m.dtstart, m.id),
           array_agg(
               format('• %s %s, %s Uhr: %s gegen %s (%s)',
                      (ARRAY['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
                          [EXTRACT(ISODOW FROM m.dtstart AT TIME ZONE 'Europe/Berlin')::int],
                      to_char(m.dtstart AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
                      to_char(m.dtstart AT TIME ZONE 'Europe/Berlin', 'HH24:MI'),
                      t.name,
                      COALESCE(NULLIF(m.opponent, ''), 'unbekannt'),
                      CASE WHEN m.is_home THEN 'Heimspiel' ELSE 'Auswärtsspiel' END)
               ORDER BY m.dtstart, m.id)
      INTO v_ids, v_lines
      FROM public.matches m
      JOIN public.teams t ON t.id = m.team_id
     WHERE m.id = ANY (p_match_ids)
       AND m.active
       AND m.dtstart > NOW();

    v_count := COALESCE(array_length(v_ids, 1), 0);
    IF v_count = 0 THEN
        RETURN NULL;
    END IF;

    v_first := public.match_page_payload(v_ids[1]);

    IF v_count = 1 THEN
        RETURN v_first || jsonb_build_object(
            'match_ids', to_jsonb(v_ids),
            'count',     1,
            'summary',   format('%s gegen %s am %s',
                                v_first ->> 'team',
                                COALESCE(v_first ->> 'opponent', 'unbekannt'),
                                v_first ->> 'date'),
            'intro',     'es gibt ein neues Spiel:',
            'matches',   v_lines[1]
        );
    END IF;

    SELECT value INTO v_app_url FROM public.club_settings WHERE key = 'app_url';

    -- Bei mehreren Spielen führt der Link auf die Liste, nicht auf eines davon.
    RETURN jsonb_build_object(
        'match_ids', to_jsonb(v_ids),
        'count',     v_count,
        'summary',   format('%s neue Spiele', v_count),
        'intro',     format('es gibt %s neue Spiele:', v_count),
        'matches',   array_to_string(v_lines, E'\n'),
        'link',      COALESCE(v_app_url, '') || '/my-games'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.match_batch_payload(UUID[]) FROM PUBLIC, anon, authenticated;

UPDATE public.notification_templates
   SET subject_tpl = 'Spieler anfragen: {{summary}}',
       body_tpl    = E'Hallo {{first_name}},\n\n{{intro}}\n\n{{matches}}\n\nWähle in der App aus, wen du dafür anfragst.\n\n{{link}}',
       updated_at  = NOW()
 WHERE type = 'match_players_needed';

-- Statt je Spiel eine Nachricht: Eine noch nicht verschickte Nachricht an dieselbe
-- Person wird eingesammelt und mit dem neuen Spiel neu angelegt. Was der
-- Versandlauf schon beansprucht hat (`sending`), bleibt unberührt — dessen Spiele
-- stehen dann nicht noch einmal in der neuen Nachricht.
CREATE OR REPLACE FUNCTION public.notify_match_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_leader  RECORD;
    v_ids     UUID[];
    v_payload JSONB;
BEGIN
    -- Ein Spiel, das schon vorbei ist, braucht niemanden mehr. Das kommt beim
    -- ersten Import einer laufenden Saison regelmäßig vor.
    IF NEW.dtstart < NOW() OR NOT NEW.active THEN
        RETURN NEW;
    END IF;

    FOR v_leader IN
        SELECT tl.profile_id
          FROM public.team_leaders tl
          JOIN public.profiles p ON p.id = tl.profile_id
         WHERE tl.team_id = NEW.team_id AND p.deleted_at IS NULL
    LOOP
        WITH gone AS (
            DELETE FROM public.notifications n
             WHERE n.profile_id = v_leader.profile_id
               AND n.type = 'match_players_needed'
               AND n.status = 'pending'
               -- Nachrichten von vor dieser Migration kennen ihre Spiele nicht als
               -- Liste; die gehen unverändert hinaus.
               AND n.payload ? 'match_ids'
            RETURNING n.payload
        )
        SELECT array_agg(DISTINCT id::uuid)
          INTO v_ids
          FROM gone
         CROSS JOIN LATERAL jsonb_array_elements_text(
             COALESCE(gone.payload -> 'match_ids', '[]'::jsonb)
         ) AS id;

        v_payload := public.match_batch_payload(
            array_append(COALESCE(v_ids, ARRAY[]::uuid[]), NEW.id)
        );

        IF v_payload IS NOT NULL THEN
            PERFORM public.enqueue_notification(
                v_leader.profile_id, 'match_players_needed', v_payload,
                false, NOW() + public.match_batch_delay()
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;
