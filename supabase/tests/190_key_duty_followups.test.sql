-- Nacharbeiten (Migration key_duty_followups): Schlüsseldienst in „Meine Termine",
-- Stimmigkeit der Zuordnung, Heimspiel kommt nachträglich in eine gesperrte Halle.

BEGIN;
SELECT plan(14);

-- Trainingstermin …0001 liegt in zwei Tagen (19–21 Uhr) und ist an diesem Tag die
-- einzige Belegung. Meik (…0005) führt die 1. Herren, Mara (…0006) die 2.

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

-- ============================================================ Stimmigkeit
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ INSERT INTO public.key_duty_weekdays (weekday, profile_id)
       VALUES (1, '22222222-1111-0000-0000-000000000001') $$,
    '22023',
    NULL,
    'Ohne Schlüsseldienst gibt es keinen festen Wochentag'
);

UPDATE public.profiles SET key_service = true
 WHERE id IN ('22222222-1111-0000-0000-000000000001', '22222222-1111-0000-0000-000000000002');

INSERT INTO public.key_duty_weekdays (weekday, profile_id)
VALUES (EXTRACT(ISODOW FROM (SELECT session_date FROM public.training_sessions
                              WHERE id = '77777777-0000-0000-0000-000000000001'))::smallint,
        '22222222-1111-0000-0000-000000000001');

-- Ein Tag ohne Belegung, nur mit Vertretung: in 20 Tagen.
SELECT lives_ok(
    $$ SELECT public.rpc_set_key_duty_override(CURRENT_DATE + 20,
                                               '22222222-1111-0000-0000-000000000002') $$,
    'Vertretung an einem Tag ohne Training'
);

-- ============================================================ Meine Termine
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT starts_at FROM public.v_my_upcoming
      WHERE kind = 'key_duty'
        AND starts_at::date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3),
    (SELECT starts_at FROM public.training_sessions WHERE id = '77777777-0000-0000-0000-000000000001'),
    'Der Schlüsseldienst steht in „Meine Termine" — ab Beginn des Trainings'
);

SELECT is(
    (SELECT title || '|' || my_status FROM public.v_my_upcoming
      WHERE kind = 'key_duty'
        AND starts_at::date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3),
    'Schlüsseldienst|yes',
    'als Zusage, damit er im Kalender-Abo landet'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000002'); END $$;

SELECT is(
    (SELECT to_char(starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') FROM public.v_my_upcoming
      WHERE kind = 'key_duty' AND (starts_at AT TIME ZONE 'Europe/Berlin')::date = CURRENT_DATE + 20),
    '18:00',
    'Ohne Belegung steht die Vertretung ab 18 Uhr da'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*) FROM public.v_my_upcoming
      WHERE kind = 'key_duty' AND profile_id = '22222222-1111-0000-0000-000000000002')::int,
    1,
    'Auch der Kalender-Feed (service_role) liest ihn'
);

-- ============================================================ Kennzeichen weg
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

UPDATE public.profiles SET key_service = false WHERE id = '22222222-1111-0000-0000-000000000001';

SELECT is(
    (SELECT count(*) FROM public.key_duty_weekdays
      WHERE profile_id = '22222222-1111-0000-0000-000000000001')::int,
    0,
    'Ohne Kennzeichen fallen die festen Wochentage weg'
);

UPDATE public.profiles SET deleted_at = NOW() WHERE id = '22222222-1111-0000-0000-000000000002';

SELECT is(
    (SELECT count(*) FROM public.key_duty_overrides
      WHERE profile_id = '22222222-1111-0000-0000-000000000002')::int,
    0,
    'Ein gelöschtes Konto verliert seine künftigen Vertretungen'
);

UPDATE public.profiles SET deleted_at = NULL WHERE id = '22222222-1111-0000-0000-000000000002';

-- ============================================================ Heimspiel wandert in die Sperre
-- Halle 2 ist am Tag von Spiel 1 (Heimspiel der 1. Herren in Halle 1) gesperrt.
INSERT INTO public.training_cancellations (venue_id, from_date, to_date, reason, notify_email)
VALUES ('11111111-0000-0000-0000-000000000002',
        (SELECT (dtstart AT TIME ZONE 'Europe/Berlin')::date FROM public.matches
          WHERE id = '55555555-0000-0000-0000-000000000001'),
        (SELECT (dtstart AT TIME ZONE 'Europe/Berlin')::date FROM public.matches
          WHERE id = '55555555-0000-0000-0000-000000000001'),
        'Turnier', false);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*) FROM public.notifications WHERE type = 'match_venue_blocked')::int,
    0,
    'Die Sperre von Halle 2 trifft das Spiel in Halle 1 nicht'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

UPDATE public.matches SET venue_id = '11111111-0000-0000-0000-000000000002'
 WHERE id = '55555555-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000005')::int,
    1,
    'Wird das Spiel in die gesperrte Halle gelegt, erfährt es die Mannschaftsführung'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

UPDATE public.matches
   SET comment = 'Bitte pünktlich', dtstart_override = dtstart + INTERVAL '1 hour'
 WHERE id = '55555555-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked' AND channel = 'email')::int,
    1,
    'Eine Stunde später am selben gesperrten Tag: keine zweite Nachricht'
);

-- Neues Heimspiel der 2. Herren ohne Ort; Standardort ist Halle 2.
UPDATE public.club_settings SET value = '11111111-0000-0000-0000-000000000002'
 WHERE key = 'default_venue_id';

INSERT INTO public.matches
    (id, team_id, source, summary, opponent, is_home, venue_id, dtstart_external, dtend_external)
VALUES ('55555555-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000002', 'ics',
        '2. Herren - TSV Import', 'TSV Import', true, NULL,
        (SELECT dtstart FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001'),
        (SELECT dtstart FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001')
            + INTERVAL '3 hours');

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000006')::int,
    1,
    'Ein importiertes Heimspiel ohne Ort am gesperrten Tag wird gemeldet (Standardort)'
);

INSERT INTO public.matches
    (id, team_id, source, summary, opponent, is_home, venue_id, dtstart_external, dtend_external)
VALUES ('55555555-0000-0000-0000-0000000000a2', '44444444-0000-0000-0000-000000000002', 'ics',
        'TSV Weg - 2. Herren', 'TSV Weg', false, NULL,
        (SELECT dtstart FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001'),
        (SELECT dtstart FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001')
            + INTERVAL '3 hours');

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000006')::int,
    1,
    'Ein Auswärtsspiel am selben Tag nicht'
);

SELECT is_empty(
    $$ SELECT subject FROM public.notifications
        WHERE type = 'match_venue_blocked' AND (subject LIKE '%{{%' OR body_text LIKE '%{{%') $$,
    'Die Nachricht ist vollständig ausgefüllt'
);

SELECT * FROM finish();
ROLLBACK;
