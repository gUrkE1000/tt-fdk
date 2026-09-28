-- Trainings: Ein Administrator meldet sich selbst nach denselben Regeln an wie alle,
-- andere darf er weiterhin melden. Anna Admin ist keinem Training zugeordnet.

BEGIN;
SELECT plan(3);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance(
        (SELECT id FROM public.training_sessions
          WHERE training_id = '66666666-0000-0000-0000-000000000001'
            AND starts_at > NOW() AND NOT cancelled
          ORDER BY starts_at LIMIT 1),
        'yes') $$,
    '42501',
    NULL,
    'Zu einem Training, dem sie nicht zugeordnet ist, meldet sie sich nicht selbst an'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance(
        (SELECT id FROM public.training_sessions
          WHERE training_id = '66666666-0000-0000-0000-000000000003'
            AND starts_at > NOW() AND NOT cancelled
          ORDER BY starts_at LIMIT 1),
        'yes') $$,
    'zu einem offenen Training schon'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance(
        (SELECT id FROM public.training_sessions
          WHERE training_id = '66666666-0000-0000-0000-000000000001'
            AND starts_at > NOW() AND NOT cancelled
          ORDER BY starts_at LIMIT 1),
        'yes', 0, '22222222-1111-0000-0000-000000000001') $$,
    'Andere meldet sie als Administratorin weiterhin'
);

SELECT * FROM finish();
ROLLBACK;
