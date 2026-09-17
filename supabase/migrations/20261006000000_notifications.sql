-- ============================================================================
-- Benachrichtigungen (Aufgabe 4.1, Zielbild 3.6)
--
-- Der Aufbau folgt dem Ausgangspostfach-Muster: Auslöser schreiben Zeilen in
-- `notifications`, ein Hintergrundlauf verschickt sie. Das hat drei Gründe:
--
--   1. Eine Datenbanktransaktion darf nicht auf einen E-Mail-Dienst warten. Wer
--      zusagt, soll nicht merken, dass irgendwo eine Mail rausgeht.
--   2. Scheitert der Versand, liegt die Zeile noch da und wird erneut versucht.
--      Ohne Postfach wäre die Nachricht verloren.
--   3. Was verschickt wurde, lässt sich nachlesen. Bei „ich habe nie eine Mail
--      bekommen" ist das der einzige Weg, die Frage zu beantworten.
--
-- Der Text wird beim Einreihen gerendert, nicht beim Versand: die Vorlage kann
-- sich ändern, die verschickte Nachricht soll es nicht.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE public.notification_channel AS ENUM ('email', 'push');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
        CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_token_kind') THEN
        CREATE TYPE public.action_token_kind AS ENUM (
            'match_response', 'substitute_answer', 'event_response', 'poll_vote'
        );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Vorlagen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_templates (
    type       TEXT PRIMARY KEY,
    label      TEXT NOT NULL,
    subject_tpl TEXT NOT NULL,
    body_tpl   TEXT NOT NULL,
    /** Reihenfolge in der Einstellungs-Matrix. */
    sort_order INTEGER NOT NULL DEFAULT 0,
    /** Direkt-E-Mails stehen nicht in der Matrix: sie gehen immer raus. */
    in_matrix  BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('training_attendance_request', 'Teilnahme am Training?',
     'Trainingsteilnahme: {{training}} am {{date}}',
     E'Hallo {{first_name}},\n\nkommst du zum Training „{{training}}" am {{date}} um {{time}} Uhr?\n\n{{link}}', 1, true),

    ('reschedule_poll', 'Terminumfrage für Spielverlegung',
     'Terminumfrage: {{team}} gegen {{opponent}}',
     E'Hallo {{first_name}},\n\ndas Spiel {{team}} gegen {{opponent}} soll verlegt werden. Bitte gib an, wann du kannst.\n\n{{link}}', 2, true),

    ('reschedule_confirmed', 'Bestätigung der Spielverlegung',
     'Neuer Termin: {{team}} gegen {{opponent}}',
     E'Hallo {{first_name}},\n\ndas Spiel {{team}} gegen {{opponent}} findet jetzt am {{date}} um {{time}} Uhr statt.\n\n{{link}}', 3, true),

    ('substitute_request', 'Ersatzanfrage an dich gestellt',
     'Ersatz gesucht: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\nkannst du am {{date}} um {{time}} Uhr bei {{team}} gegen {{opponent}} ({{home_away}}) einspringen?\n\nBitte antworte bis {{deadline}}.\n\n{{link}}', 4, true),

    ('substitute_found', 'Ersatz erfolgreich gefunden',
     'Ersatz gefunden: {{team}} gegen {{opponent}}',
     E'Hallo {{first_name}},\n\nfür {{team}} gegen {{opponent}} am {{date}} ist Ersatz gefunden. Du musst nichts weiter tun.\n\n{{link}}', 5, true),

    ('match_created', 'Neues Mannschaftsspiel angelegt',
     'Neuer Spieltermin: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\nes gibt einen neuen Spieltermin: {{team}} gegen {{opponent}} ({{home_away}}) am {{date}} um {{time}} Uhr.\n\nBitte melde dich zurück:\n{{link}}', 6, true),

    ('event_invitation', 'Einladung für Vereinstermin',
     'Einladung: {{event}} am {{date}}',
     E'Hallo {{first_name}},\n\ndu bist eingeladen zu „{{event}}" am {{date}} um {{time}} Uhr.\n\n{{link}}', 7, true),

    ('match_reminder', 'Erinnerung an Spieltermin',
     'Erinnerung: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\nzur Erinnerung: {{team}} gegen {{opponent}} ({{home_away}}) am {{date}} um {{time}} Uhr.\n\n{{link}}', 8, true),

    ('event_reminder', 'Erinnerung an Vereinstermin',
     'Erinnerung: {{event}} am {{date}}',
     E'Hallo {{first_name}},\n\nzur Erinnerung: „{{event}}" am {{date}} um {{time}} Uhr.\n\n{{link}}', 9, true),

    ('match_assigned', 'Mannschaftsspiel zugeordnet',
     'Du bist aufgestellt: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\ndu stehst in der Aufstellung für {{team}} gegen {{opponent}} ({{home_away}}) am {{date}} um {{time}} Uhr.\n\n{{link}}', 10, true),

    ('open_participations', 'Erinnerung an offene Spiel- und Terminteilnahmen',
     'Offene Rückmeldungen',
     E'Hallo {{first_name}},\n\nzu folgenden Terminen fehlt noch deine Rückmeldung:\n\n{{list}}\n\n{{link}}', 11, true),

    ('object_message', 'Neue Nachricht im Training, Spiel oder Vereinstermin',
     'Neue Nachricht: {{title}}',
     E'Hallo {{first_name}},\n\nes gibt eine neue Nachricht zu „{{title}}".\n\n{{link}}', 12, true),

    ('training_cancelled', 'Benachrichtigung bei Trainingsausfall',
     'Training fällt aus: {{training}} am {{date}}',
     E'Hallo {{first_name}},\n\ndas Training „{{training}}" am {{date}} fällt aus.\n\n{{link}}', 13, true),

    ('substitute_chain_exhausted', 'Kein Ersatz gefunden',
     'Kein Ersatz: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\nfür {{team}} gegen {{opponent}} am {{date}} haben alle Ersatzspieler abgesagt oder nicht geantwortet.\n\n{{link}}', 14, true),

    ('match_changed', 'Spieltermin geändert',
     'Termin geändert: {{team}} gegen {{opponent}}',
     E'Hallo {{first_name}},\n\nder Termin für {{team}} gegen {{opponent}} hat sich geändert. Neu: {{date}} um {{time}} Uhr.\n\nDeine bisherige Rückmeldung gilt nicht mehr — bitte antworte erneut:\n{{link}}', 15, true),

    -- Ab hier Direkt-E-Mails: nicht abwählbar, weil sie eine Handlung des
    -- Mannschaftsführers mitteilen, die die Person betrifft.
    ('player_added', 'Spieler hinzugefügt',
     'Du wurdest aufgestellt: {{team}} gegen {{opponent}}',
     E'Hallo {{first_name}},\n\ndu wurdest für {{team}} gegen {{opponent}} am {{date}} um {{time}} Uhr zum Spiel hinzugefügt.\n\n{{link}}', 100, false),

    ('player_removed', 'Spieler entfernt',
     'Du bist vorerst nicht dabei: {{team}} gegen {{opponent}}',
     E'Hallo {{first_name}},\n\ndu wurdest bei {{team}} gegen {{opponent}} am {{date}} vorerst aus der Aufstellung genommen.\n\n{{link}}', 101, false),

    ('player_declined', 'Spieler auf Absage gesetzt',
     'Absage eingetragen: {{team}} gegen {{opponent}}',
     E'Hallo {{first_name}},\n\nfür {{team}} gegen {{opponent}} am {{date}} wurde für dich eine Absage eingetragen.\n\n{{link}}', 102, false),

    ('welcome', 'Willkommen im Verein',
     'Willkommen bei {{club}}',
     E'Hallo {{first_name}},\n\ndein Zugang ist freigeschaltet. Ab jetzt siehst du Spieltermine, Trainings und Vereinstermine und kannst dich zurückmelden.\n\n{{link}}', 103, false),

    ('lineup_shared', 'Aufstellung mitgeteilt',
     'Aufstellung: {{team}} gegen {{opponent}} am {{date}}',
     E'Hallo {{first_name}},\n\n{{list}}', 104, false)
ON CONFLICT (type) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Einstellungen je Mitglied
-- ----------------------------------------------------------------------------

-- Eine fehlende Zeile heißt „beides an". Damit muss niemand beim Anlegen eines
-- Mitglieds fünfzehn Zeilen erzeugen, und ein neuer Typ ist sofort für alle aktiv.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    type       TEXT NOT NULL REFERENCES public.notification_templates(type) ON UPDATE CASCADE ON DELETE CASCADE,
    email      BOOLEAN NOT NULL DEFAULT true,
    push       BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, type)
);

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Das Postfach
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    channel       public.notification_channel NOT NULL,
    type          TEXT NOT NULL,
    subject       TEXT NOT NULL,
    body_text     TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        public.notification_status NOT NULL DEFAULT 'pending',
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at       TIMESTAMPTZ,
    attempts      INTEGER NOT NULL DEFAULT 0,
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Der Versandlauf holt genau danach: fällige, offene Zeilen.
CREATE INDEX IF NOT EXISTS notifications_pending_idx
    ON public.notifications (scheduled_for)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS notifications_profile_idx
    ON public.notifications (profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    user_agent      TEXT,
    failures        INTEGER NOT NULL DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Aktions-Token
-- ----------------------------------------------------------------------------

-- Damit funktioniert der Link in einer E-Mail ohne Anmeldung. Der Token ist ein
-- Einmalschlüssel mit Verfallsdatum und gilt für genau eine Handlung an genau
-- einem Objekt — er ist kein Ersatz für eine Anmeldung.
CREATE TABLE IF NOT EXISTS public.action_tokens (
    token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    action     public.action_token_kind NOT NULL,
    target_id  UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS action_tokens_target_idx ON public.action_tokens (target_id);

-- ----------------------------------------------------------------------------
-- 5. Vorlagen füllen
-- ----------------------------------------------------------------------------

-- Ersetzt {{platzhalter}} durch die Werte aus dem JSON. Unbekannte Platzhalter
-- werden entfernt statt stehengelassen: „Hallo {{first_name}}" in einer echten
-- E-Mail ist peinlicher als „Hallo ".
CREATE OR REPLACE FUNCTION public.render_template(p_template TEXT, p_values JSONB)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    v_result TEXT := COALESCE(p_template, '');
    v_key    TEXT;
    v_value  TEXT;
BEGIN
    FOR v_key, v_value IN
        SELECT key, CASE jsonb_typeof(value)
                        WHEN 'string' THEN value #>> '{}'
                        WHEN 'null'   THEN ''
                        ELSE value::text
                    END
          FROM jsonb_each(COALESCE(p_values, '{}'::jsonb))
    LOOP
        v_result := replace(v_result, '{{' || v_key || '}}', COALESCE(v_value, ''));
    END LOOP;

    -- Was jetzt noch in doppelten geschweiften Klammern steht, kam nicht vor.
    v_result := regexp_replace(v_result, '\{\{[a-z_]+\}\}', '', 'g');

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Einreihen
-- ----------------------------------------------------------------------------

-- Die einzige Stelle, an der Benachrichtigungen entstehen. Jeder Auslöser ruft
-- diese Funktion; sie kennt die Einstellungen, die Vorlagen und die Token.
CREATE OR REPLACE FUNCTION public.enqueue_notification(
    p_profile     UUID,
    p_type        TEXT,
    p_payload     JSONB DEFAULT '{}'::jsonb,
    p_force_email BOOLEAN DEFAULT false,
    p_scheduled   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_template public.notification_templates%ROWTYPE;
    v_profile  public.profiles%ROWTYPE;
    v_email    BOOLEAN;
    v_push     BOOLEAN;
    v_payload  JSONB;
    v_token    UUID;
    v_app_url  TEXT;
    v_subject  TEXT;
    v_body     TEXT;
    v_count    INTEGER := 0;
BEGIN
    SELECT * INTO v_template FROM public.notification_templates WHERE type = p_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unbekannter Benachrichtigungstyp: %', p_type
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN 0;   -- gelöschte Mitglieder bekommen nichts mehr
    END IF;

    -- Fehlende Zeile heißt „beides an".
    SELECT np.email, np.push INTO v_email, v_push
      FROM public.notification_preferences np
     WHERE np.profile_id = p_profile AND np.type = p_type;

    v_email := COALESCE(v_email, true) OR p_force_email;
    v_push  := COALESCE(v_push, true);

    -- Eine Direkt-E-Mail ist nicht abwählbar, ein Hinweis in der App schon.
    IF NOT v_template.in_matrix THEN
        v_email := true;
    END IF;

    v_payload := COALESCE(p_payload, '{}'::jsonb);
    v_payload := v_payload || jsonb_build_object('first_name', v_profile.first_name);

    -- Kopie-Adressen der Person (typisch: Eltern).
    IF array_length(v_profile.emails_copies, 1) > 0 THEN
        v_payload := v_payload || jsonb_build_object('cc', to_jsonb(v_profile.emails_copies));
    END IF;

    SELECT value INTO v_app_url FROM public.club_settings WHERE key = 'app_url';

    -- Ein Aktions-Token macht aus dem Link eine Antwortmöglichkeit ohne Anmeldung.
    IF v_payload ? 'action' AND v_payload ? 'target_id' THEN
        INSERT INTO public.action_tokens (profile_id, action, target_id, expires_at)
        VALUES (
            p_profile,
            (v_payload ->> 'action')::public.action_token_kind,
            (v_payload ->> 'target_id')::UUID,
            COALESCE((v_payload ->> 'expires_at')::TIMESTAMPTZ, NOW() + INTERVAL '30 days')
        )
        RETURNING token INTO v_token;

        v_payload := v_payload || jsonb_build_object(
            'link', COALESCE(v_app_url, '') || '/r/' || v_token::text,
            'token', v_token
        );
    ELSIF NOT (v_payload ? 'link') THEN
        v_payload := v_payload || jsonb_build_object('link', COALESCE(v_app_url, ''));
    END IF;

    v_subject := public.render_template(v_template.subject_tpl, v_payload);
    v_body    := public.render_template(v_template.body_tpl, v_payload);

    IF v_email AND v_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications
            (profile_id, channel, type, subject, body_text, payload, scheduled_for)
        VALUES (p_profile, 'email', p_type, v_subject, v_body, v_payload, p_scheduled);
        v_count := v_count + 1;
    END IF;

    IF v_push THEN
        INSERT INTO public.notifications
            (profile_id, channel, type, subject, body_text, payload, scheduled_for)
        VALUES (p_profile, 'push', p_type, v_subject, v_body, v_payload, p_scheduled);
        v_count := v_count + 1;
    END IF;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification(UUID, TEXT, JSONB, BOOLEAN, TIMESTAMPTZ) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 7. Eigene Einstellungen lesen und schreiben
-- ----------------------------------------------------------------------------

-- Liefert für jeden Typ der Matrix die geltende Einstellung, auch wenn keine
-- Zeile existiert. Die Oberfläche muss die Regel „fehlend = an" damit nicht kennen.
CREATE OR REPLACE VIEW public.v_my_notification_preferences
WITH (security_invoker = true) AS
SELECT
    t.type,
    t.label,
    t.sort_order,
    auth.uid() AS profile_id,
    COALESCE(np.email, true) AS email,
    COALESCE(np.push, true)  AS push
FROM public.notification_templates t
LEFT JOIN public.notification_preferences np
       ON np.type = t.type AND np.profile_id = auth.uid()
WHERE t.in_matrix;

GRANT SELECT ON public.v_my_notification_preferences TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.notification_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_tokens              ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.notification_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

DROP POLICY IF EXISTS notification_templates_select ON public.notification_templates;
CREATE POLICY notification_templates_select ON public.notification_templates
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS notification_preferences_own ON public.notification_preferences;
CREATE POLICY notification_preferences_own ON public.notification_preferences
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Lesen: die eigenen Zeilen, und der Admin alles (für die Betriebssicht).
-- Schreiben: niemand direkt — Zeilen entstehen nur über `enqueue_notification`.
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Aktions-Token sind für niemanden lesbar. Wer den Token hat, hat ihn aus seiner
-- eigenen E-Mail; ihn über die API abfragen zu können hieße, fremde Antworten
-- abgeben zu können.
