-- Trainingstermine ein Jahr im Voraus: Kalender und Schlüsseldienst reichen so weit,
-- die offenen Rückmeldungen aber nur acht Wochen.

BEGIN;
SELECT plan(4);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

-- Erwachsenentraining (Spieler 01 ist zugeordnet): ein Termin in sieben Wochen,
-- einer in einem halben Jahr.
INSERT INTO public.training_sessions (id, training_id, session_date, starts_at, ends_at)
VALUES
    ('77777777-2400-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001',
     (date_trunc('day', NOW()) + INTERVAL '49 days')::date,
     date_trunc('day', NOW()) + INTERVAL '49 days 19 hours',
     date_trunc('day', NOW()) + INTERVAL '49 days 21 hours'),
    ('77777777-2400-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001',
     (date_trunc('day', NOW()) + INTERVAL '182 days')::date,
     date_trunc('day', NOW()) + INTERVAL '182 days 19 hours',
     date_trunc('day', NOW()) + INTERVAL '182 days 21 hours');

-- Ein fester Schlüsseldienst für jeden Wochentag, damit jeder Hallentag einen hat.
INSERT INTO public.key_duty_weekdays (weekday, profile_id)
SELECT d, '22222222-0000-0000-0000-000000000001' FROM generate_series(1, 7) AS d
ON CONFLICT (weekday) DO UPDATE SET profile_id = EXCLUDED.profile_id;

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.v_open_participations
      WHERE id = '77777777-2400-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000001')::int,
    1,
    'Ein Training in sieben Wochen steht in den offenen Rückmeldungen'
);

SELECT is(
    (SELECT count(*) FROM public.v_open_participations
      WHERE id = '77777777-2400-0000-0000-000000000002')::int,
    0,
    'eines in einem halben Jahr noch nicht'
);

SELECT is(
    (SELECT count(*) FROM public.v_calendar_items
      WHERE kind = 'training' AND id = '77777777-2400-0000-0000-000000000002')::int,
    1,
    'Im Kalender steht es trotzdem'
);

SELECT is(
    (SELECT count(*) FROM public.v_key_duty_dates
      WHERE duty_date = (date_trunc('day', NOW()) + INTERVAL '182 days')::date)::int,
    1,
    'und an dem Tag gibt es Schlüsseldienst'
);

SELECT * FROM finish();
ROLLBACK;
