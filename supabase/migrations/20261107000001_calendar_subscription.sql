-- ============================================================================
-- Kalender-Abo neu (Vereinsentscheidung 26.09.2026)
--
-- Bisher enthielt das Abo alle **zugesagten** Termine. Jetzt enthält es, was man
-- im privaten Kalender sehen will, egal ob schon geantwortet:
--
--   1. die Heim- und Auswärtsspiele der eigenen Mannschaften (Stamm, Ersatz,
--      Mannschaftsführung) — und Spiele, zu denen man angefragt ist;
--   2. jede Hallensperre, ganztägig;
--   3. auf Wunsch die eigenen Trainings (Schalter je Mitglied, `include_trainings`).
--
-- Abgesagte Spiele und ausgefallene Trainings bleiben mit STATUS:CANCELLED drin:
-- Verschwände der Eintrag einfach, merkte man nicht, dass etwas ausfällt.
-- Die Einträge rechnet `calendar_feed_items()` — die Edge Function holt und
-- formatiert nur.
-- ============================================================================

ALTER TABLE public.calendar_tokens
    ADD COLUMN IF NOT EXISTS include_trainings BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 1. Das eigene Abo: Link und Schalter
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_my_calendar_subscription()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me  UUID := auth.uid();
    v_row public.calendar_tokens%ROWTYPE;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder haben einen Kalender.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.calendar_tokens (profile_id)
    VALUES (v_me)
    ON CONFLICT (profile_id) DO NOTHING;

    SELECT * INTO v_row FROM public.calendar_tokens WHERE profile_id = v_me;
    RETURN jsonb_build_object('token', v_row.token, 'include_trainings', v_row.include_trainings);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_set_calendar_trainings(p_include BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me UUID := auth.uid();
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder haben einen Kalender.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.calendar_tokens (profile_id, include_trainings)
    VALUES (v_me, COALESCE(p_include, false))
    ON CONFLICT (profile_id) DO UPDATE SET include_trainings = EXCLUDED.include_trainings;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_my_calendar_subscription() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_set_calendar_trainings(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_my_calendar_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_calendar_trainings(BOOLEAN) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Die Einträge
-- ----------------------------------------------------------------------------

-- Ortsangabe „Halle, Straße, PLZ Ort" — was ein Kalenderprogramm als Adresse nimmt.
CREATE OR REPLACE FUNCTION public.venue_location_text(p_venue_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT concat_ws(', ',
               NULLIF(v.name, ''),
               NULLIF(v.address, ''),
               NULLIF(btrim(concat_ws(' ', v.postal_code, v.city)), ''))
      FROM public.venues v
     WHERE v.id = p_venue_id;
$$;

REVOKE ALL ON FUNCTION public.venue_location_text(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.calendar_feed_items(
    p_profile_id        UUID,
    p_since             TIMESTAMPTZ,
    p_include_trainings BOOLEAN
)
RETURNS TABLE (
    uid         TEXT,
    kind        TEXT,
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    all_day     BOOLEAN,
    title       TEXT,
    location    TEXT,
    description TEXT,
    cancelled   BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    WITH app AS (
        SELECT COALESCE((SELECT value FROM public.club_settings WHERE key = 'app_url'), '') AS url
    ),
    my_teams AS (
        SELECT team_id FROM public.team_members WHERE profile_id = p_profile_id
        UNION
        SELECT team_id FROM public.team_leaders WHERE profile_id = p_profile_id
    ),
    items AS (
        -- Spiele der eigenen Mannschaften und Spiele mit Anfrage
        SELECT
            'match-' || m.id::text AS uid,
            'match'::text AS kind,
            m.dtstart AS starts_at,
            COALESCE(m.dtend, m.dtstart + INTERVAL '4 hours') AS ends_at,
            false AS all_day,
            t.name || ' – ' || COALESCE(NULLIF(m.opponent, ''), 'unbekannt')
                || CASE WHEN m.is_home THEN ' (Heim)' ELSE ' (Auswärts)' END
                || CASE WHEN NOT m.active THEN ' – fällt aus' ELSE '' END AS title,
            COALESCE(
                public.venue_location_text(
                    COALESCE(m.venue_id, CASE WHEN m.is_home THEN public.club_default_venue() END)),
                NULLIF(m.location_text, '')) AS location,
            concat_ws(E'\n',
                NULLIF(m.league, ''),
                CASE
                    WHEN mp.profile_id IS NULL THEN NULL
                    WHEN mp.removed THEN 'Du bist vorerst nicht aufgestellt.'
                    ELSE 'Deine Rückmeldung: ' || CASE mp.response
                        WHEN 'yes' THEN 'Zusage'
                        WHEN 'no' THEN 'Absage'
                        WHEN 'unclear' THEN 'unsicher'
                        ELSE 'noch offen' END
                END,
                CASE WHEN public.venue_block_for(m.is_home, m.active, m.dtstart, m.venue_id) IS NOT NULL
                     THEN 'Achtung: Die Halle ist an diesem Tag gesperrt — das Spiel muss verlegt werden.'
                END,
                NULLIF((SELECT url FROM app), '') || '/match/' || m.id::text) AS description,
            NOT m.active AS cancelled
        FROM public.matches m
        JOIN public.teams t ON t.id = m.team_id
        LEFT JOIN public.match_participations mp
               ON mp.match_id = m.id AND mp.profile_id = p_profile_id
        WHERE m.dtstart IS NOT NULL
          AND m.dtstart >= p_since
          AND (m.team_id IN (SELECT team_id FROM my_teams) OR mp.profile_id IS NOT NULL)

        UNION ALL

        -- Jede Hallensperre, ganztägig
        SELECT
            'venue-blocked-' || c.id::text,
            'venue_blocked',
            (c.from_date::timestamp AT TIME ZONE 'Europe/Berlin'),
            ((c.to_date + 1)::timestamp AT TIME ZONE 'Europe/Berlin'),
            true,
            'Halle gesperrt: ' || COALESCE(v.name, 'Halle')
                || CASE WHEN btrim(c.reason) <> '' THEN ' (' || btrim(c.reason) || ')' ELSE '' END,
            public.venue_location_text(c.venue_id),
            'Trainings in dieser Halle fallen aus, Heimspiele müssen verlegt werden.',
            false
        FROM public.training_cancellations c
        LEFT JOIN public.venues v ON v.id = c.venue_id
        WHERE c.venue_id IS NOT NULL
          AND c.to_date >= (p_since AT TIME ZONE 'Europe/Berlin')::date

        UNION ALL

        -- Auf Wunsch: die eigenen Trainings
        SELECT
            'training-' || s.id::text,
            'training',
            s.starts_at,
            COALESCE(s.ends_at, s.starts_at + INTERVAL '2 hours'),
            false,
            t.name || CASE WHEN s.cancelled THEN ' – fällt aus' ELSE '' END,
            public.venue_location_text(COALESCE(t.venue_id, public.club_default_venue())),
            concat_ws(E'\n',
                CASE WHEN s.cancelled THEN NULLIF(s.cancel_reason, '') END,
                CASE a.status
                    WHEN 'yes'  THEN 'Deine Rückmeldung: dabei'
                    WHEN 'late' THEN 'Deine Rückmeldung: komme später'
                    WHEN 'no'   THEN 'Deine Rückmeldung: nicht dabei'
                END,
                NULLIF((SELECT url FROM app), '') || '/training/' || s.id::text),
            s.cancelled
        FROM public.training_sessions s
        JOIN public.trainings t ON t.id = s.training_id
        LEFT JOIN public.training_attendance a
               ON a.session_id = s.id AND a.profile_id = p_profile_id
        WHERE p_include_trainings
          AND NOT t.hide_in_calendar
          AND s.starts_at >= p_since
          AND (
              EXISTS (SELECT 1 FROM public.training_trainers tt
                       WHERE tt.training_id = t.id AND tt.profile_id = p_profile_id)
              OR (t.is_system AND EXISTS (
                      SELECT 1 FROM public.training_session_participants sp
                       WHERE sp.session_id = s.id AND sp.profile_id = p_profile_id))
              OR (NOT t.is_system AND (
                      t.is_open
                      OR EXISTS (SELECT 1 FROM public.training_members tm
                                  WHERE tm.training_id = t.id AND tm.profile_id = p_profile_id)))
          )
    )
    SELECT * FROM items ORDER BY starts_at, uid;
$$;

REVOKE ALL ON FUNCTION public.calendar_feed_items(UUID, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_feed_items(UUID, TIMESTAMPTZ, BOOLEAN) TO service_role;
