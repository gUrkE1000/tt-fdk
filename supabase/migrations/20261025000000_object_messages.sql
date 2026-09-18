-- ============================================================================
-- Nachrichten am Termin (Aufgabe 9.2)
--
-- Ein kurzer Faden an einem Spiel, einem Trainingstermin oder einem
-- Vereinstermin: „Wer nimmt die Bälle mit?", „Ich bin zehn Minuten später da."
--
-- **Kein Chat.** Der Plan hat den Chat des TT-Planers gestrichen, und das bleibt
-- so. Der Unterschied ist nicht die Technik, sondern der Ort: Diese Nachrichten
-- hängen an genau einem Termin, sind für alle Beteiligten dieses Termins
-- sichtbar und verschwinden mit ihm. Es gibt keine Unterhaltung zwischen zwei
-- Personen, keine ungelesen-Zähler über alles hinweg und keine Kanäle.
--
-- Wer eine Nachricht sehen darf, entscheidet **nicht** diese Tabelle, sondern
-- die Sichtbarkeit des Termins: Wer das Spiel sieht, sieht seine Nachrichten.
-- Damit gibt es genau eine Regel statt zweier, die auseinanderlaufen können.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_object') THEN
        CREATE TYPE public.message_object AS ENUM ('match', 'session', 'event');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.object_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Kein Fremdschlüssel, weil das Ziel drei verschiedene Tabellen sein kann.
    -- Aufgeräumt wird per Trigger, siehe unten — verwaiste Fäden wären sonst
    -- unsichtbar und blieben ewig liegen.
    object_type public.message_object NOT NULL,
    object_id   UUID NOT NULL,
    author_id   UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT object_messages_body_not_empty CHECK (length(btrim(body)) > 0),
    -- Reiner Text, keine Formatierung: Ein Faden am Termin ist eine Zuruf-Zeile.
    CONSTRAINT object_messages_body_length CHECK (length(body) <= 2000)
);

DROP TRIGGER IF EXISTS object_messages_updated_at ON public.object_messages;
CREATE TRIGGER object_messages_updated_at
    BEFORE UPDATE ON public.object_messages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS object_messages_object_idx
    ON public.object_messages (object_type, object_id, created_at);

-- ----------------------------------------------------------------------------
-- 1. Sichtbarkeit
--
-- Genau die Frage „darf ich diesen Termin sehen?" — beantwortet mit den
-- Funktionen, die es dafür schon gibt. Eine eigene Regel für Nachrichten wäre
-- eine zweite Wahrheit.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_see_message_object(
    p_type public.message_object,
    p_id   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_type = 'match' THEN
        -- Spieltermine sieht, wer am Spielbetrieb teilnimmt (siehe `is_playing_member`).
        RETURN EXISTS (SELECT 1 FROM public.matches WHERE id = p_id)
           AND public.is_playing_member();
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

REVOKE ALL ON FUNCTION public.can_see_message_object(public.message_object, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_message_object(public.message_object, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.object_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_messages TO authenticated;

DROP POLICY IF EXISTS object_messages_select ON public.object_messages;
CREATE POLICY object_messages_select ON public.object_messages
    FOR SELECT TO authenticated
    USING (public.can_see_message_object(object_type, object_id));

-- Schreiben darf, wer den Termin sieht. Der Verfasser muss man selbst sein —
-- sonst schriebe jemand im Namen eines anderen.
DROP POLICY IF EXISTS object_messages_insert ON public.object_messages;
CREATE POLICY object_messages_insert ON public.object_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid()
        AND public.can_see_message_object(object_type, object_id)
    );

-- Ändern nur die eigene, und zwar nur den Text: `object_id` zu verschieben hieße,
-- eine fremde Nachricht an einen anderen Termin zu hängen.
DROP POLICY IF EXISTS object_messages_update ON public.object_messages;
CREATE POLICY object_messages_update ON public.object_messages
    FOR UPDATE TO authenticated
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- Löschen: die eigene, oder als Administrator jede. Ein Verein braucht eine
-- Stelle, die eine entgleiste Zeile wegräumen kann.
DROP POLICY IF EXISTS object_messages_delete ON public.object_messages;
CREATE POLICY object_messages_delete ON public.object_messages
    FOR DELETE TO authenticated
    USING (author_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Aufräumen
--
-- Ohne Fremdschlüssel räumt niemand auf. Diese Trigger tun es beim Löschen des
-- Termins — sonst sammelten sich Nachrichten zu Objekten an, die es nicht mehr
-- gibt: unsichtbar, aber dauerhaft gespeichert. Bei personenbezogenen Daten ist
-- das kein Schönheitsfehler.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_object_messages()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.object_messages
     WHERE object_type = TG_ARGV[0]::public.message_object
       AND object_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS matches_messages_cleanup ON public.matches;
CREATE TRIGGER matches_messages_cleanup
    AFTER DELETE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.delete_object_messages('match');

DROP TRIGGER IF EXISTS sessions_messages_cleanup ON public.training_sessions;
CREATE TRIGGER sessions_messages_cleanup
    AFTER DELETE ON public.training_sessions
    FOR EACH ROW EXECUTE FUNCTION public.delete_object_messages('session');

DROP TRIGGER IF EXISTS events_messages_cleanup ON public.club_events;
CREATE TRIGGER events_messages_cleanup
    AFTER DELETE ON public.club_events
    FOR EACH ROW EXECUTE FUNCTION public.delete_object_messages('event');

-- ----------------------------------------------------------------------------
-- 4. Benachrichtigung der Beteiligten
--
-- Die Vorlage `object_message` steht seit Aufgabe 4.1 bereit und wartete nur auf
-- einen Auslöser.
--
-- Benachrichtigt werden die **Beteiligten**, nicht alle, die den Termin sehen
-- dürfen: Wer bei einem Spiel im Kader steht, will wissen, dass jemand schreibt;
-- der Rest des Vereins nicht. Der Verfasser selbst bekommt nichts — er weiß es.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_object_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_title    TEXT;
    v_starts   TIMESTAMPTZ;
    v_profile  UUID;
BEGIN
    IF NEW.object_type = 'match' THEN
        SELECT t.name || ' gegen ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt'), m.dtstart
          INTO v_title, v_starts
          FROM public.matches m JOIN public.teams t ON t.id = m.team_id
         WHERE m.id = NEW.object_id;

    ELSIF NEW.object_type = 'session' THEN
        SELECT tr.name, s.starts_at
          INTO v_title, v_starts
          FROM public.training_sessions s JOIN public.trainings tr ON tr.id = s.training_id
         WHERE s.id = NEW.object_id;

    ELSE
        SELECT e.name, e.starts_at
          INTO v_title, v_starts
          FROM public.club_events e
         WHERE e.id = NEW.object_id;
    END IF;

    -- Zu einem Termin, der vorbei ist, muss niemand mehr geweckt werden.
    IF v_starts IS NULL OR v_starts < NOW() THEN
        RETURN NEW;
    END IF;

    FOR v_profile IN
        SELECT DISTINCT profile_id FROM (
            SELECT mp.profile_id
              FROM public.match_participations mp
             WHERE NEW.object_type = 'match'
               AND mp.match_id = NEW.object_id
               AND NOT mp.removed

            UNION

            SELECT a.profile_id
              FROM public.training_attendance a
             WHERE NEW.object_type = 'session'
               AND a.session_id = NEW.object_id
               AND a.status IN ('yes', 'late')

            UNION

            SELECT ep.profile_id
              FROM public.event_participations ep
             WHERE NEW.object_type = 'event'
               AND ep.event_id = NEW.object_id
               -- `event_status` kennt nur yes/no, kein „später".
               AND ep.status = 'yes'
        ) beteiligte
         WHERE profile_id <> NEW.author_id
    LOOP
        PERFORM public.enqueue_notification(
            v_profile,
            'object_message',
            jsonb_build_object('title', COALESCE(v_title, 'Termin'))
        );
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS object_messages_notify ON public.object_messages;
CREATE TRIGGER object_messages_notify
    AFTER INSERT ON public.object_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_object_message();

-- ----------------------------------------------------------------------------
-- 5. Sichten
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_object_messages
WITH (security_invoker = true) AS
SELECT
    m.id,
    m.object_type,
    m.object_id,
    m.author_id,
    p.full_name AS author_name,
    m.body,
    m.created_at,
    m.updated_at,
    (m.updated_at > m.created_at + INTERVAL '1 second') AS edited
FROM public.object_messages m
LEFT JOIN public.profiles p ON p.id = m.author_id;

GRANT SELECT ON public.v_object_messages TO authenticated;

-- Der Zähler für die Karten („Nachrichten (3)"). Eine Abfrage für alle Karten
-- einer Seite statt einer je Karte.
CREATE OR REPLACE VIEW public.v_object_message_counts
WITH (security_invoker = true) AS
SELECT object_type, object_id, count(*)::int AS message_count
  FROM public.object_messages
 GROUP BY object_type, object_id;

GRANT SELECT ON public.v_object_message_counts TO authenticated;
