-- Schlüsseldienst planen nur Administrator und Kennzeichen (Migration
-- key_duty_planners_only) — und die Links der Benachrichtigungen führen dorthin, wo der
-- Empfänger etwas sieht.

BEGIN;
SELECT plan(7);

DO $$
BEGIN
    PERFORM tests.as_service_role();
    DELETE FROM public.notifications;
    DELETE FROM public.key_duty_overrides;
    DELETE FROM public.key_duty_weekdays;
    UPDATE public.profiles SET key_service = false;
END $$;

-- ============================================================ Erinnerung an Trainer
DO $$
BEGIN
    PERFORM tests.as_service_role();
    INSERT INTO public.training_sessions (id, training_id, session_date, starts_at, ends_at)
    VALUES ('77777777-0000-0000-0000-0000000000bb', '66666666-0000-0000-0000-000000000001',
            (NOW() + INTERVAL '5 hours')::date,
            NOW() + INTERVAL '5 hours', NOW() + INTERVAL '7 hours');
    -- Die Trainerin hat das Kennzeichen und darf planen.
    UPDATE public.profiles SET key_service = true WHERE id = '22222222-0000-0000-0000-000000000003';
END $$;

SELECT cmp_ok(public.enqueue_key_reminders(), '>=', 1, 'Der Termin ohne Schlüsseldienst löst eine Erinnerung aus');

SELECT matches(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'training_key_missing' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000003'
        AND payload ->> 'link' LIKE '%date=' || (NOW() + INTERVAL '5 hours')::date::text),
    '/venues\?date=\d{4}-\d{2}-\d{2}$',
    'Wer planen darf, kommt direkt zum Tag im Schlüsseldienst'
);

-- ============================================================ Rechte
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

INSERT INTO public.key_duty_weekdays (weekday, profile_id)
VALUES (EXTRACT(ISODOW FROM public.berlin_today() + 12)::smallint,
        '22222222-1111-0000-0000-000000000004');

SELECT public.rpc_set_key_duty_override(public.berlin_today() + 13,
                                        '22222222-1111-0000-0000-000000000005');

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000004'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_key_duty_override(public.berlin_today() + 12,
                                              '22222222-1111-0000-0000-000000000002') $$,
    '42501',
    NULL,
    'Der feste Inhaber ohne Kennzeichen trägt keine Vertretung ein'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_key_duty_override(public.berlin_today() + 13,
                                              '22222222-1111-0000-0000-000000000002') $$,
    '42501',
    NULL,
    'Wer an einem Tag eingeteilt ist, gibt ihn ohne Kennzeichen nicht selbst ab'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.profiles SET key_service = true WHERE id = '22222222-1111-0000-0000-000000000003';

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_key_duty_override(public.berlin_today() + 12,
                                              '22222222-1111-0000-0000-000000000002') $$,
    'Mit Kennzeichen trägt man die Vertretung ein'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    public.key_duty_for(public.berlin_today() + 12),
    '22222222-1111-0000-0000-000000000002'::uuid,
    'Der Tag hat die Vertretung'
);

SELECT matches(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'key_duty_assigned' AND channel = 'email'
        AND profile_id = '22222222-1111-0000-0000-000000000002'),
    '/trainings$',
    'Die Vertretung kommt zur Trainingsseite, wo der Schlüsseldienst am Termin steht'
);

SELECT * FROM finish();
ROLLBACK;
