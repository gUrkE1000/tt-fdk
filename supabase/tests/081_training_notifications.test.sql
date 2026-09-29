-- Benachrichtigungen rund ums Training: Ausfall, automatische Absage, offene Antworten.

BEGIN;
SELECT plan(10);

-- Der Seed löst beim Anlegen von Spielen schon Benachrichtigungen aus. Gezählt wird
-- hier nur, was in diesem Test entsteht.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- Theo (…0004) leitet das Jugendtraining, Tina (…0003) das Erwachsenentraining.

-- ============================================================ Ausfall eines Trainings
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

INSERT INTO public.training_cancellations (training_id, from_date, to_date, reason)
VALUES ('66666666-0000-0000-0000-000000000001', CURRENT_DATE + 20, CURRENT_DATE + 27,
        'Osterferien');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(DISTINCT profile_id) FROM public.notifications
      WHERE type = 'training_cancelled')::int,
    5,
    'Der Ausfall erreicht die vier Zugeordneten und den Trainer'
);

SELECT is(
    (SELECT DISTINCT subject FROM public.notifications WHERE type = 'training_cancelled'),
    'Training fällt aus: Erwachsenentraining am ' ||
        to_char(CURRENT_DATE + 20, 'DD.MM.YYYY') || ' bis ' ||
        to_char(CURRENT_DATE + 27, 'DD.MM.YYYY'),
    'Der Betreff nennt den ganzen Zeitraum, nicht jeden Tag einzeln'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'training_cancelled'
        AND profile_id = '22222222-1111-0000-0000-000000000004')::int,
    0,
    'Wer zu einem anderen Training gehört, bekommt nichts'
);

DELETE FROM public.notifications;

-- ============================================================ Ausfall einer Halle
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

-- Halle 1 trägt das Erwachsenen- und das offene Training.
INSERT INTO public.training_cancellations (venue_id, from_date, to_date, reason, notify_email)
VALUES ('11111111-0000-0000-0000-000000000001', CURRENT_DATE + 40, CURRENT_DATE + 40,
        'Halle ist Wahllokal', true);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(DISTINCT payload ->> 'training') FROM public.notifications
      WHERE type = 'training_cancelled')::int,
    2,
    'Ein Hallenausfall meldet jedes Training, das dort stattfindet'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.notifications
         WHERE type = 'training_cancelled'
           AND payload ->> 'training' = 'Offenes Training'
           AND profile_id = '22222222-1111-0000-0000-000000000019'
    ),
    'Beim offenen Training erfährt es jedes aktive Mitglied'
);

SELECT is(
    (SELECT DISTINCT payload ->> 'date' FROM public.notifications
      WHERE type = 'training_cancelled'),
    to_char(CURRENT_DATE + 40, 'DD.MM.YYYY'),
    'Ein einzelner Tag steht ohne Spanne im Text'
);

DELETE FROM public.notifications;

-- ============================================================ Keine automatische Absage
-- Die automatische Absage ist entfernt (20261114000000): Sagen alle Trainer ab,
-- bleibt der Termin stehen, bis ihn jemand über einen Ausfall absagt.
INSERT INTO public.training_trainers (training_id, profile_id)
VALUES ('66666666-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003');

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000004'); END $$;
SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000004', 'no');
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;
SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000004', 'no');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT cancelled FROM public.training_sessions
      WHERE id = '77777777-0000-0000-0000-000000000004'),
    false,
    'Sagen alle Trainer ab, findet das Training trotzdem statt'
);

-- ============================================================ Offene Rückmeldungen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

-- Spieler 01 hat zum ersten Termin geantwortet, zum zweiten nicht.
SELECT is(
    (SELECT count(*) FROM public.v_open_participations
      WHERE kind = 'training' AND id = '77777777-0000-0000-0000-000000000002'
        AND profile_id = '22222222-1111-0000-0000-000000000001')::int,
    1,
    'Ein Trainingstermin ohne Antwort steht in den offenen Rückmeldungen'
);

SELECT is(
    (SELECT count(*) FROM public.v_open_participations
      WHERE kind = 'training' AND id = '77777777-0000-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000001')::int,
    0,
    'ein beantworteter dagegen nicht'
);

SELECT is(
    (SELECT title FROM public.v_open_participations
      WHERE kind = 'training' AND id = '77777777-0000-0000-0000-000000000002'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'Erwachsenentraining',
    'Der Sammelhinweis nennt das Training beim Namen'
);

SELECT * FROM finish();
ROLLBACK;
