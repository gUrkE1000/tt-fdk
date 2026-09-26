-- Rückmeldungsrunde vom 25.09.2026 (Migration feedback_round): Sichtbarkeit der
-- Spiele, Fahrdienst, Standardort und Hallensperre, Schlüsseldienst, Systemtraining,
-- Kalender.

BEGIN;
SELECT plan(41);

-- Spieler 09 gehört zu keiner Mannschaft. Meik (…0005) führt die 1. Herren
-- (Heimspiel 1, Auswärtsspiel 2). Halle 1 (…0001) und Halle 2 (…0002) sind aktiv.

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

-- ============================================================ Spiele sehen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000009'); END $$;

SELECT is(
    (SELECT count(*) FROM public.matches)::int,
    4,
    'Ein Mitglied ohne Mannschaft sieht alle Spiele des Vereins'
);

SELECT ok(
    (SELECT count(*) FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001')::int > 0,
    'und auch, wer dort angefragt ist'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes') $$,
    '42501',
    NULL,
    'Zusagen kann er dort trotzdem nicht'
);

SELECT throws_ok(
    $$ INSERT INTO public.match_volunteers (match_id, profile_id, kind)
       VALUES ('55555555-0000-0000-0000-000000000002',
               '22222222-1111-0000-0000-000000000009', 'driver') $$,
    '42501',
    NULL,
    'und als Fahrer eintragen auch nicht'
);

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'match' AND id = '55555555-0000-0000-0000-000000000001'),
    false,
    'Im Kalender ist das Spiel für ihn nicht „für mich relevant"'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is(
    (SELECT count(*) FROM public.matches)::int,
    0,
    'Ein Gast sieht weiterhin keine Spiele'
);

-- ============================================================ Fahrdienst
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'match' AND id = '55555555-0000-0000-0000-000000000001'),
    true,
    'Für den Mannschaftsführer ist das Spiel „für mich relevant"'
);

SELECT lives_ok(
    $$ INSERT INTO public.match_volunteers (match_id, profile_id, kind)
       VALUES ('55555555-0000-0000-0000-000000000002',
               '22222222-0000-0000-0000-000000000005', 'direct') $$,
    '„Ich fahre direkt" beim Auswärtsspiel'
);

SELECT lives_ok(
    $$ INSERT INTO public.match_volunteers (match_id, profile_id, kind)
       VALUES ('55555555-0000-0000-0000-000000000002',
               '22222222-0000-0000-0000-000000000005', 'driver') $$,
    'Dann doch „Ich kann fahren"'
);

SELECT is(
    (SELECT array_agg(kind::text) FROM public.match_volunteers
      WHERE match_id = '55555555-0000-0000-0000-000000000002'
        AND profile_id = '22222222-0000-0000-0000-000000000005'),
    ARRAY['driver'],
    'Das eine nimmt das andere zurück'
);

SELECT throws_ok(
    $$ INSERT INTO public.match_volunteers (match_id, profile_id, kind)
       VALUES ('55555555-0000-0000-0000-000000000001',
               '22222222-0000-0000-0000-000000000005', 'direct') $$,
    '22023',
    NULL,
    '„Ich fahre direkt" gibt es beim Heimspiel nicht'
);

SELECT throws_ok(
    $$ INSERT INTO public.match_volunteers (match_id, profile_id, kind)
       VALUES ('55555555-0000-0000-0000-000000000002',
               '22222222-0000-0000-0000-000000000005', 'catering') $$,
    '22023',
    NULL,
    'Verpflegung wird nicht mehr eingetragen'
);

-- ============================================================ Standardort
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

UPDATE public.club_settings SET value = '' WHERE key = 'default_venue_id';

SELECT is(
    public.club_default_venue(),
    NULL,
    'Zwei Hallen ohne Standardort: kein Standardort'
);

UPDATE public.club_settings SET value = '11111111-0000-0000-0000-000000000001'
 WHERE key = 'default_venue_id';

SELECT is(
    public.club_default_venue(),
    '11111111-0000-0000-0000-000000000001'::uuid,
    'Mit gewähltem Standardort ist es dieser'
);

-- ============================================================ Hallensperre
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

INSERT INTO public.trainings (id, name, weekday, time_start, start_date)
VALUES ('66666666-0000-0000-0000-0000000000c1', 'Ohne Ort', 1, '18:00', CURRENT_DATE);

SELECT is(
    (SELECT is_open FROM public.trainings WHERE id = '66666666-0000-0000-0000-0000000000c1'),
    true,
    'Ein neues Training ist standardmäßig offen'
);

INSERT INTO public.training_cancellations (venue_id, from_date, to_date, reason, notify_email)
VALUES ('11111111-0000-0000-0000-000000000001',
        (SELECT (dtstart AT TIME ZONE 'Europe/Berlin')::date FROM public.matches
          WHERE id = '55555555-0000-0000-0000-000000000001'),
        (SELECT (dtstart AT TIME ZONE 'Europe/Berlin')::date FROM public.matches
          WHERE id = '55555555-0000-0000-0000-000000000001'),
        'Wasserschaden', false);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000005')::int,
    1,
    'Die Mannschaftsführung erfährt, dass ihr Heimspiel verlegt werden muss'
);

SELECT ok(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked'
        AND profile_id <> '22222222-0000-0000-0000-000000000005')::int = 0,
    'nur sie'
);

SELECT ok(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'training_cancelled' AND payload ->> 'training' = 'Ohne Ort')::int > 0,
    'Das Training ohne Ort wird mit abgesagt (Standardort)'
);

-- ============================================================ Schlüsseldienst
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ UPDATE public.profiles SET key_service = true
        WHERE id = '22222222-1111-0000-0000-000000000001' $$,
    '42501',
    NULL,
    'Den Schlüsseldienst gibt man sich nicht selbst'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

UPDATE public.profiles SET key_service = true
 WHERE id IN ('22222222-1111-0000-0000-000000000001', '22222222-1111-0000-0000-000000000002');

SELECT lives_ok(
    $$ INSERT INTO public.key_duty_weekdays (weekday, profile_id)
       VALUES (EXTRACT(ISODOW FROM (SELECT session_date FROM public.training_sessions
                                     WHERE id = '77777777-0000-0000-0000-000000000001'))::smallint,
               '22222222-1111-0000-0000-000000000001') $$,
    'Der Administrator gibt Spieler 01 den Wochentag des nächsten Trainings'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

-- Erst jetzt hat Spieler 01 Schlüsseldienst — so prüft der Fall die Rechte und nicht
-- die Regel, dass nur Schlüsseldienst einen Wochentag bekommt.
SELECT throws_ok(
    $$ INSERT INTO public.key_duty_weekdays (weekday, profile_id)
       VALUES (1, '22222222-1111-0000-0000-000000000001') $$,
    '42501',
    NULL,
    'Die festen Tage vergibt nur der Administrator'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT is(
    (SELECT duty_id FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000001'),
    '22222222-1111-0000-0000-000000000001'::uuid,
    'Die Terminkarte zeigt den Schlüsseldienst des Tages'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_key_duty_override(
           (SELECT session_date FROM public.training_sessions
             WHERE id = '77777777-0000-0000-0000-000000000001'),
           '22222222-1111-0000-0000-000000000003') $$,
    '42501',
    NULL,
    'Ohne Schlüsseldienst trägt man keine Vertretung ein'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_key_duty_override(
           (SELECT session_date FROM public.training_sessions
             WHERE id = '77777777-0000-0000-0000-000000000001'),
           '22222222-1111-0000-0000-000000000003') $$,
    '22023',
    NULL,
    'Vertreten kann nur, wer selbst Schlüsseldienst hat'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_key_duty_override(
           (SELECT session_date FROM public.training_sessions
             WHERE id = '77777777-0000-0000-0000-000000000001'),
           '22222222-1111-0000-0000-000000000002') $$,
    'Spieler 01 fällt aus und trägt Spieler 02 als Vertretung ein'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    public.key_duty_for((SELECT session_date FROM public.training_sessions
                          WHERE id = '77777777-0000-0000-0000-000000000001')),
    '22222222-1111-0000-0000-000000000002'::uuid,
    'An diesem Tag hat die Vertretung den Schlüsseldienst'
);

SELECT is(
    public.key_duty_for((SELECT session_date FROM public.training_sessions
                          WHERE id = '77777777-0000-0000-0000-000000000002')),
    '22222222-1111-0000-0000-000000000001'::uuid,
    'eine Woche später wieder der feste Inhaber'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'key_duty_assigned' AND channel = 'email'
        AND profile_id = '22222222-1111-0000-0000-000000000002')::int,
    1,
    'Die Vertretung wird benachrichtigt'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000002'); END $$;

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'key_duty'
        AND starts_at = (SELECT session_date FROM public.training_sessions
                          WHERE id = '77777777-0000-0000-0000-000000000001')::timestamptz),
    true,
    'Im Kalender steht der Schlüsseldienst — für die Vertretung „für mich relevant"'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_key_duty_override(
           (SELECT session_date FROM public.training_sessions
             WHERE id = '77777777-0000-0000-0000-000000000001'),
           NULL) $$,
    'Die Vertretung wird zurückgenommen'
);

SELECT is(
    (SELECT count(*) FROM public.key_duty_overrides)::int,
    0,
    'und der Tag gehört wieder dem festen Inhaber'
);

-- ============================================================ Systemtraining
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

INSERT INTO public.trainings (id, name, weekday, time_start, start_date, is_system, is_open)
VALUES ('66666666-0000-0000-0000-0000000000d1', 'Systemtraining', 3, '17:00', CURRENT_DATE, true, true);

SELECT is(
    (SELECT is_open FROM public.trainings WHERE id = '66666666-0000-0000-0000-0000000000d1'),
    false,
    'Ein Systemtraining ist nie offen'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

INSERT INTO public.training_sessions (id, training_id, session_date, starts_at, ends_at)
VALUES ('77777777-0000-0000-0000-0000000000d1', '66666666-0000-0000-0000-0000000000d1',
        CURRENT_DATE + 5, date_trunc('day', NOW()) + INTERVAL '5 days 17 hours',
        date_trunc('day', NOW()) + INTERVAL '5 days 18 hours');

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-0000000000d1', 'yes') $$,
    '42501',
    NULL,
    'Wer nicht zugeteilt ist, meldet sich nicht an'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_session_participants('77777777-0000-0000-0000-0000000000d1',
           ARRAY['22222222-1111-0000-0000-000000000003']::uuid[]) $$,
    '42501',
    NULL,
    'und teilt sich auch nicht selbst zu'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    public.rpc_set_session_participants('77777777-0000-0000-0000-0000000000d1',
        ARRAY['22222222-1111-0000-0000-000000000003']::uuid[]),
    1,
    'Der Administrator teilt Spieler 03 für diesen Termin zu'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_session_participants('77777777-0000-0000-0000-000000000001',
           ARRAY['22222222-1111-0000-0000-000000000003']::uuid[]) $$,
    '22023',
    NULL,
    'Zuteilen je Termin gibt es nur beim Systemtraining'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-0000000000d1', 'yes') $$,
    'Der Zugeteilte sagt zu'
);

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'training' AND id = '77777777-0000-0000-0000-0000000000d1'),
    true,
    'und hat den Termin „für mich relevant" im Kalender'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000004'); END $$;

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'training' AND id = '77777777-0000-0000-0000-0000000000d1'),
    false,
    'die anderen nicht'
);

-- ============================================================ Vorlagen
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(DISTINCT type) FROM public.notifications
      WHERE type IN ('match_venue_blocked', 'key_duty_assigned', 'training_session_assigned'))::int,
    3,
    'Alle drei neuen Nachrichten wurden verschickt'
);

SELECT is_empty(
    $$ SELECT type, subject, body_text FROM public.notifications
        WHERE type IN ('match_venue_blocked', 'key_duty_assigned', 'training_session_assigned')
          AND (subject LIKE '%{{%' OR body_text LIKE '%{{%') $$,
    'und ihre Vorlagen sind vollständig ausgefüllt'
);

SELECT * FROM finish();
ROLLBACK;
