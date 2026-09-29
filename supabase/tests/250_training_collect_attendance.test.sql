-- Trainings ohne Rückmeldung: Standard für neue Trainings, und ihre Termine stehen
-- nicht unter „Offen für dich".

BEGIN;
SELECT plan(5);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

INSERT INTO public.trainings (id, name, weekday, time_start, start_date)
VALUES ('66666666-0000-0000-0000-0000000000e1', 'Ohne Abfrage', 1, '18:00', CURRENT_DATE);

SELECT is(
    (SELECT collect_attendance FROM public.trainings WHERE id = '66666666-0000-0000-0000-0000000000e1'),
    false,
    'Ein neues Training fragt standardmäßig nicht nach Rückmeldungen'
);

INSERT INTO public.training_members (training_id, profile_id)
VALUES ('66666666-0000-0000-0000-0000000000e1', '22222222-1111-0000-0000-000000000001');

INSERT INTO public.training_sessions (id, training_id, session_date, starts_at, ends_at)
VALUES
    ('77777777-2500-0000-0000-000000000001', '66666666-0000-0000-0000-0000000000e1',
     (date_trunc('day', NOW()) + INTERVAL '7 days')::date,
     date_trunc('day', NOW()) + INTERVAL '7 days 18 hours',
     date_trunc('day', NOW()) + INTERVAL '7 days 20 hours');

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.v_open_participations
      WHERE id = '77777777-2500-0000-0000-000000000001')::int,
    0,
    'Ein Termin ohne Abfrage steht nicht in den offenen Rückmeldungen'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.trainings SET collect_attendance = true
 WHERE id = '66666666-0000-0000-0000-0000000000e1';
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.v_open_participations
      WHERE id = '77777777-2500-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000001')::int,
    1,
    'mit eingeschalteter Abfrage schon'
);

-- Dauerzusage und automatische Absage sind entfernt.
SELECT hasnt_table('public', 'training_auto_attendance', 'Die Dauerzusage gibt es nicht mehr');
SELECT hasnt_column('public', 'trainings', 'auto_cancel_no_trainers', 'die automatische Absage auch nicht');

SELECT * FROM finish();
ROLLBACK;
