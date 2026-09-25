-- ============================================================================
-- Wer bringt den Schlüssel zum Training?
--
-- Bisher leitete die Anwendung das nur ab: Hatte jemand mit Hallenschlüssel
-- zugesagt, stand er beim Termin — und auch das nur bei Trainings mit dem Haken
-- „Schlüsselbesitzer erforderlich". Wer den Schlüssel hatte, aber noch nicht
-- geantwortet hatte, tauchte nicht auf.
--
-- Ab hier wird es je Termin eingetragen:
--
--   1. `training_session_keys` hält, wer den Schlüssel zu einem Termin bringt.
--      Man trägt sich selbst ein; Trainer und Admin tragen jeden ein.
--   2. Wer vom Trainer eingetragen wird, bekommt `training_key_assigned`.
--   3. Wer eingetragen ist und dann absagt, ist wieder ausgetragen.
--   4. Steht einen Tag vor dem Termin noch niemand da, bekommen die Trainer
--      einmal `training_key_missing` (über `enqueue_key_reminders()`, aufgerufen
--      vom Erinnerungslauf).
--
-- Das gilt für alle Trainings; `trainings.requires_key_owner` wird nicht mehr
-- gelesen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabellen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_session_keys (
    session_id UUID PRIMARY KEY REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    set_by     UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    set_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_session_keys_profile_idx
    ON public.training_session_keys (profile_id);

-- Gelesen wird über `v_session_keys`, geschrieben über `rpc_set_session_key_bearer`.
-- Direkt kommt niemand heran: Bei einem inkognito geführten Training verriete die
-- Zeile, wer kommt.
ALTER TABLE public.training_session_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_session_keys FROM anon, authenticated;

-- Einmal je Termin erinnern, dass noch niemand den Schlüssel bringt.
CREATE TABLE IF NOT EXISTS public.training_key_reminders (
    session_id UUID PRIMARY KEY REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.training_key_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_key_reminders FROM anon, authenticated;

COMMENT ON COLUMN public.trainings.requires_key_owner IS
    'Nicht mehr verwendet: Seit Migration training_key_bearer zeigt jedes Training, wer den Schlüssel bringt.';

-- ----------------------------------------------------------------------------
-- 2. Vorlagen
-- ----------------------------------------------------------------------------

INSERT INTO public.notification_templates (type, label, subject_tpl, body_tpl, sort_order, in_matrix) VALUES
    ('training_key_assigned', 'Du bringst den Schlüssel zum Training',
     'Schlüssel: {{training}} am {{date}}',
     E'Hallo {{first_name}},\n\n{{by}} hat dich eingetragen: Du bringst den Hallenschlüssel zu {{training}} am {{date}} um {{time}} Uhr{{venue_text}}.\n\nKannst du nicht, trag dich in der App wieder aus.\n\n{{link}}', 19, true),

    ('training_key_missing', 'Noch niemand bringt den Schlüssel (Trainer)',
     'Noch kein Schlüssel: {{training}} am {{date}}',
     E'Hallo {{first_name}},\n\nfür {{training}} am {{date}} um {{time}} Uhr{{venue_text}} hat sich noch niemand eingetragen, der den Hallenschlüssel bringt.{{holders}}\n\n{{link}}', 20, true)
ON CONFLICT (type) DO NOTHING;

-- Der Termin als Nutzlast, mit Link auf seine Seite.
CREATE OR REPLACE FUNCTION public.training_page_payload(p_session_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.training_payload(p_session_id)
        || jsonb_build_object(
            'venue_text', CASE WHEN v.name IS NULL THEN '' ELSE ' (' || v.name || ')' END,
            'link', COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '')
                || '/training/' || p_session_id::text
        )
      FROM public.training_sessions s
      JOIN public.trainings t ON t.id = s.training_id
      LEFT JOIN public.venues v ON v.id = t.venue_id
     WHERE s.id = p_session_id;
$$;

REVOKE ALL ON FUNCTION public.training_page_payload(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Eintragen und austragen
-- ----------------------------------------------------------------------------

-- p_profile_id = eigene ID: selbst eintragen. NULL: austragen. Eine andere ID:
-- jemanden eintragen (nur Trainer und Admin). Wer schon eingetragen ist, wird von
-- einem Mitglied nicht verdrängt — das darf nur der Trainer.
CREATE OR REPLACE FUNCTION public.rpc_set_session_key_bearer(
    p_session_id UUID,
    p_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me      UUID := auth.uid();
    v_session public.training_sessions%ROWTYPE;
    v_current UUID;
    v_manager BOOLEAN;
    v_by      TEXT;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können das.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_session FROM public.training_sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND OR NOT public.can_see_training(v_session.training_id) THEN
        RAISE EXCEPTION 'Diesen Trainingstermin gibt es nicht.' USING ERRCODE = 'no_data_found';
    END IF;

    IF v_session.cancelled THEN
        RAISE EXCEPTION 'Dieser Termin fällt aus.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF COALESCE(v_session.ends_at, v_session.starts_at + INTERVAL '2 hours') < NOW() THEN
        RAISE EXCEPTION 'Dieser Termin ist vorbei.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_manager := public.is_admin() OR public.trains_session(p_session_id);

    SELECT profile_id INTO v_current
      FROM public.training_session_keys WHERE session_id = p_session_id;

    IF v_current IS NOT DISTINCT FROM p_profile_id THEN
        RETURN;
    END IF;

    -- Austragen: sich selbst, oder als Trainer jeden.
    IF p_profile_id IS NULL THEN
        IF NOT (v_manager OR v_current = v_me) THEN
            RAISE EXCEPTION 'Austragen kann sich nur, wer eingetragen ist — oder der Trainer.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;

        DELETE FROM public.training_session_keys WHERE session_id = p_session_id;
        -- Fehlt jetzt wieder jemand, darf die Erinnerung noch einmal kommen.
        DELETE FROM public.training_key_reminders WHERE session_id = p_session_id;
        RETURN;
    END IF;

    IF p_profile_id <> v_me AND NOT v_manager THEN
        RAISE EXCEPTION 'Jemand anderen eintragen kann nur der Trainer.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_current IS NOT NULL AND NOT v_manager THEN
        RAISE EXCEPTION 'Den Schlüssel bringt schon jemand. Sprecht euch ab, oder frag den Trainer.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = p_profile_id AND deleted_at IS NULL AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Dieses Mitglied gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    INSERT INTO public.training_session_keys (session_id, profile_id, set_by, set_at)
    VALUES (p_session_id, p_profile_id, v_me, NOW())
    ON CONFLICT (session_id) DO UPDATE
       SET profile_id = EXCLUDED.profile_id,
           set_by     = EXCLUDED.set_by,
           set_at     = EXCLUDED.set_at;

    IF p_profile_id <> v_me THEN
        SELECT full_name INTO v_by FROM public.profiles WHERE id = v_me;
        PERFORM public.enqueue_notification(
            p_profile_id,
            'training_key_assigned',
            public.training_page_payload(p_session_id)
                || jsonb_build_object('by', COALESCE(NULLIF(v_by, ''), 'Der Trainer'))
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_session_key_bearer(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_session_key_bearer(UUID, UUID) TO authenticated;

-- Wer den Schlüssel bringen wollte und dann absagt, bringt ihn nicht.
CREATE OR REPLACE FUNCTION public.clear_key_bearer_on_decline()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.status = 'no' THEN
        DELETE FROM public.training_session_keys
         WHERE session_id = NEW.session_id AND profile_id = NEW.profile_id;

        IF FOUND THEN
            DELETE FROM public.training_key_reminders WHERE session_id = NEW.session_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_key_bearer_on_decline() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS training_attendance_clear_key_bearer ON public.training_attendance;
CREATE TRIGGER training_attendance_clear_key_bearer
    AFTER INSERT OR UPDATE OF status ON public.training_attendance
    FOR EACH ROW EXECUTE FUNCTION public.clear_key_bearer_on_decline();

-- ----------------------------------------------------------------------------
-- 4. Was die Terminkarte zeigt
-- ----------------------------------------------------------------------------

-- Die bisherigen Spalten bleiben (wer mit Schlüssel zugesagt hat); dazu kommt, wer
-- eingetragen ist. Der Name steht nur da, wo auch die Teilnehmerliste sichtbar ist
-- — sonst würde ein inkognito geführtes Training verraten, wer kommt. Sich selbst
-- sieht man immer.
CREATE OR REPLACE VIEW public.v_session_keys AS
SELECT
    s.id AS session_id,
    EXISTS (
        SELECT 1
          FROM public.training_attendance a
          JOIN public.keys k ON k.holder_id = a.profile_id
         WHERE a.session_id = s.id
           AND a.status IN ('yes', 'late')
           AND k.active
           AND k.venue_id = t.venue_id
    ) AS has_key_holder,
    CASE WHEN public.may_see_session_roster(s.id) THEN (
        SELECT p.full_name
          FROM public.training_attendance a
          JOIN public.keys k     ON k.holder_id = a.profile_id
          JOIN public.profiles p ON p.id = a.profile_id
         WHERE a.session_id = s.id
           AND a.status IN ('yes', 'late')
           AND k.active
           AND k.venue_id = t.venue_id
         ORDER BY p.full_name
         LIMIT 1
    ) END AS holder_name,
    (sk.session_id IS NOT NULL) AS has_bearer,
    CASE WHEN sk.profile_id = auth.uid() OR public.may_see_session_roster(s.id)
         THEN sk.profile_id END AS bearer_id,
    CASE WHEN sk.profile_id = auth.uid() OR public.may_see_session_roster(s.id)
         THEN bp.full_name END AS bearer_name
FROM public.training_sessions s
JOIN public.trainings t ON t.id = s.training_id
LEFT JOIN public.training_session_keys sk ON sk.session_id = s.id
LEFT JOIN public.profiles bp ON bp.id = sk.profile_id
WHERE public.can_see_training(t.id);

GRANT SELECT ON public.v_session_keys TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Erinnerung an die Trainer
-- ----------------------------------------------------------------------------

-- Termine in den nächsten 24 Stunden, für die niemand den Schlüssel bringt: je
-- Termin einmal an alle Trainer. Die Nachricht nennt, wer laut Schlüssel-
-- verwaltung einen Schlüssel für die Halle hat. Gibt die Zahl der Termine zurück.
CREATE OR REPLACE FUNCTION public.enqueue_key_reminders()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_trainer RECORD;
    v_holders TEXT;
    v_payload JSONB;
    v_count   INTEGER := 0;
BEGIN
    FOR v_session IN
        SELECT s.id, s.training_id, t.venue_id
          FROM public.training_sessions s
          JOIN public.trainings t ON t.id = s.training_id
         WHERE NOT s.cancelled
           AND t.active
           AND s.starts_at > NOW()
           AND s.starts_at <= NOW() + INTERVAL '24 hours'
           AND NOT EXISTS (SELECT 1 FROM public.training_session_keys sk WHERE sk.session_id = s.id)
           AND NOT EXISTS (SELECT 1 FROM public.training_key_reminders r WHERE r.session_id = s.id)
         ORDER BY s.starts_at
    LOOP
        INSERT INTO public.training_key_reminders (session_id) VALUES (v_session.id)
        ON CONFLICT (session_id) DO NOTHING;
        IF NOT FOUND THEN
            CONTINUE;   -- ein paralleler Lauf war schneller
        END IF;

        SELECT string_agg(DISTINCT p.full_name, ', ' ORDER BY p.full_name)
          INTO v_holders
          FROM public.keys k
          JOIN public.profiles p ON p.id = k.holder_id
         WHERE k.active AND k.venue_id = v_session.venue_id AND p.deleted_at IS NULL;

        v_payload := public.training_page_payload(v_session.id)
            || jsonb_build_object(
                'holders',
                CASE WHEN v_holders IS NULL THEN ''
                     ELSE E'\n\nEinen Schlüssel für die Halle haben: ' || v_holders || '.' END
            );

        FOR v_trainer IN
            SELECT tt.profile_id
              FROM public.training_trainers tt
              JOIN public.profiles p ON p.id = tt.profile_id
             WHERE tt.training_id = v_session.training_id
               AND p.deleted_at IS NULL
               AND p.status = 'active'
        LOOP
            PERFORM public.enqueue_notification(v_trainer.profile_id, 'training_key_missing', v_payload);
        END LOOP;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_key_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_key_reminders() TO service_role;
