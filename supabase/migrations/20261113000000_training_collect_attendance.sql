-- ============================================================================
-- Trainings ohne Rückmeldung
--
-- Beim Training hat kaum jemand zu- oder abgesagt — man kommt einfach. Die Frage
-- stand trotzdem bei jedem Termin unter „Offen für dich", in der Zahl an der
-- Navigation und in der Erinnerung vor dem Training. Mit Terminen ein Jahr im
-- Voraus (20261112000000_training_horizon.sql) waren das schnell sechzehn offene
-- Einträge, die niemand beantworten wollte.
--
-- Ob nach einer Rückmeldung gefragt wird, entscheidet jetzt das Training
-- (`collect_attendance`). Standard ist: nein — auch für alle bestehenden Trainings.
-- Wo es darauf ankommt (Teilnehmergrenze, Systemtraining), schaltet der Trainer es
-- im Training wieder ein.
--
-- Ohne Abfrage steht ein Termin nicht mehr in `v_open_participations` (und damit
-- auch nicht in der täglichen Sammelerinnerung), `enqueue-reminders` erinnert nicht
-- mehr daran, und die Trainingskarte zeigt keine Knöpfe. Bereits gegebene Antworten
-- bleiben gespeichert; im Kalender und im Schlüsseldienst ändert sich nichts.
--
-- Sonst ist die Sicht unverändert (Stand: 20261112000000_training_horizon.sql).
-- ============================================================================

ALTER TABLE public.trainings
    ADD COLUMN IF NOT EXISTS collect_attendance BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.trainings.collect_attendance IS
    'Fragt bei jedem Termin nach Zu- oder Absage (Knöpfe, „Offen für dich", Erinnerung).';

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
  WHERE tr.active AND tr.collect_attendance AND NOT s.cancelled AND s.starts_at > now()
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
