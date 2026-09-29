-- ============================================================================
-- Trainingstermine ein Jahr im Voraus
--
-- Die Termine wurden nur acht Wochen im Voraus angelegt. Am Ende dieses Fensters
-- hörten im Kalender die Trainings auf — und mit ihnen der Schlüsseldienst, denn
-- `v_key_duty_dates` kennt einen Hallentag nur über einen Trainingstermin oder ein
-- Heimspiel. Der Job `generate-training-sessions` plant deshalb jetzt ein Jahr
-- voraus (`HORIZON_DAYS` in supabase/functions/_shared/sessionPlanner.ts).
--
-- Bisher begrenzte das Fenster nebenbei auch, wonach gefragt wird: Jeder Termin ohne
-- Antwort steht in `v_open_participations` und damit unter „Offen für dich" und in
-- der Zahl an der Navigation. Mit einem Jahr wären das für ein wöchentliches
-- Training über fünfzig offene Einträge. Die Sicht fragt deshalb weiter nur nach den
-- Trainings der nächsten acht Wochen — genau so viel wie bisher.
--
-- Sonst ist die Sicht unverändert (Stand: 20261030000002_integrity.sql).
-- ============================================================================

CREATE OR REPLACE VIEW public.v_open_participations
WITH (security_invoker = true) AS
SELECT mp.profile_id,
    'match'::text AS kind,
    m.id,
    m.dtstart AS starts_at,
    (t.name || ' gegen '::text) || COALESCE(NULLIF(m.opponent, ''::text), 'unbekannt'::text) AS title
   FROM match_participations mp
     JOIN matches m ON m.id = mp.match_id
     JOIN teams t ON t.id = m.team_id
     JOIN profiles p ON p.id = mp.profile_id
  WHERE m.active AND m.dtstart > now() AND p.deleted_at IS NULL AND NOT p.no_games AND NOT mp.removed AND (mp.response = 'none'::participation_response OR COALESCE(mp.version_responded, 0) < m.version)
UNION ALL
 SELECT tm.profile_id,
    'training'::text AS kind,
    s.id,
    s.starts_at,
    tr.name AS title
   FROM training_sessions s
     JOIN trainings tr ON tr.id = s.training_id
     JOIN training_members tm ON tm.training_id = tr.id
     JOIN profiles p ON p.id = tm.profile_id
  WHERE tr.active AND NOT s.cancelled AND s.starts_at > now()
    AND s.starts_at <= now() + INTERVAL '56 days'
    AND p.deleted_at IS NULL AND NOT (EXISTS ( SELECT 1
           FROM training_attendance a
          WHERE a.session_id = s.id AND a.profile_id = tm.profile_id))
UNION ALL
 SELECT p.id AS profile_id,
    'event'::text AS kind,
    e.id,
    e.starts_at,
    e.name AS title
   FROM club_events e
     CROSS JOIN profiles p
  WHERE e.starts_at > now() AND p.deleted_at IS NULL AND p.status = 'active'::member_status AND (e.participate_until IS NULL OR e.participate_until >= public.berlin_today()) AND NOT (EXISTS ( SELECT 1
           FROM event_participations ep
          WHERE ep.event_id = e.id AND ep.profile_id = p.id));
