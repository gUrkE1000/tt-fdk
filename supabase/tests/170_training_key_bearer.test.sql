-- Wer bringt den Schlüssel zum Training? (Migration training_key_bearer)

BEGIN;
SELECT plan(22);

-- Erwachsenentraining (…0001): Trainerin Tina (…0003), Termin …0001 in zwei Tagen,
-- …0003 vergangen. Jugendtraining (…0002) ist inkognito: Trainer Theo (…0004),
-- Mitglieder Spieler 04 und 05, Termin …0004 in drei Tagen.

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

-- ============================================================ Selbst eintragen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-000000000001',
                                                '22222222-1111-0000-0000-000000000001') $$,
    'Ein Mitglied trägt sich als Schlüsselbringer ein'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000002'); END $$;

SELECT is(
    (SELECT bearer_id FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000001'),
    '22222222-1111-0000-0000-000000000001'::uuid,
    'Die anderen sehen, wer den Schlüssel bringt'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-000000000001',
                                                '22222222-1111-0000-0000-000000000002') $$,
    '22023',
    NULL,
    'Ein Mitglied verdrängt keinen, der schon eingetragen ist'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-000000000002',
                                                '22222222-1111-0000-0000-000000000003') $$,
    '42501',
    NULL,
    'Jemand anderen eintragen darf ein Mitglied nicht'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-000000000001', NULL) $$,
    '42501',
    NULL,
    'Austragen darf ein Mitglied nur sich selbst'
);

SELECT throws_ok(
    $$ SELECT count(*) FROM public.training_session_keys $$,
    '42501',
    NULL,
    'Die Tabelle selbst ist nicht lesbar'
);

-- ============================================================ Trainerin trägt ein
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-000000000001',
                                                '22222222-1111-0000-0000-000000000002') $$,
    'Die Trainerin trägt jemand anderen ein'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT profile_id FROM public.training_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000001'),
    '22222222-1111-0000-0000-000000000002'::uuid,
    'und ersetzt damit den bisherigen Eintrag'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'training_key_assigned' AND channel = 'email'
        AND profile_id = '22222222-1111-0000-0000-000000000002')::int,
    1,
    'Der Eingetragene bekommt Bescheid'
);

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE type = 'training_key_assigned' AND channel = 'email'),
    'Tina',
    'mit dem Namen dessen, der eingetragen hat'
);

SELECT matches(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'training_key_assigned' AND channel = 'email'),
    '/training/77777777-0000-0000-0000-000000000001$',
    'Der Link führt auf die Seite des Termins'
);

-- ============================================================ Absage trägt aus
DO $$
BEGIN
    PERFORM tests.as_service_role();
    INSERT INTO public.training_attendance (session_id, profile_id, status, source)
    VALUES ('77777777-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000002', 'no', 'self')
    ON CONFLICT (session_id, profile_id) DO UPDATE SET status = 'no';
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.training_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000001')::int,
    0,
    'Wer absagt, bringt den Schlüssel nicht mehr'
);

-- ============================================================ Grenzen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-000000000003',
                                                '22222222-1111-0000-0000-000000000001') $$,
    '22023',
    NULL,
    'Für einen vergangenen Termin trägt sich niemand mehr ein'
);

-- ============================================================ Inkognito
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000004'); END $$;
SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-000000000004',
                                         '22222222-1111-0000-0000-000000000004');

SELECT isnt(
    (SELECT bearer_name FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000004'),
    NULL,
    'Sich selbst sieht man auch bei einem Inkognito-Training'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000005'); END $$;

SELECT is(
    (SELECT has_bearer FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000004'),
    true,
    'Die anderen sehen, dass jemand den Schlüssel bringt'
);

SELECT is(
    (SELECT bearer_name FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000004'),
    NULL,
    'aber nicht, wer — das verriete, wer kommt'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000004'); END $$;

SELECT isnt(
    (SELECT bearer_name FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000004'),
    NULL,
    'Der Trainer sieht den Namen'
);

-- ============================================================ Erinnerung
DO $$
BEGIN
    PERFORM tests.as_service_role();
    DELETE FROM public.notifications;
    INSERT INTO public.training_sessions (id, training_id, session_date, starts_at, ends_at)
    VALUES ('77777777-0000-0000-0000-0000000000aa', '66666666-0000-0000-0000-000000000001',
            (NOW() + INTERVAL '5 hours')::date,
            NOW() + INTERVAL '5 hours', NOW() + INTERVAL '7 hours');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    public.enqueue_key_reminders(),
    1,
    'Ein Termin morgen ohne Schlüsselbringer löst eine Erinnerung aus'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'training_key_missing' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000003')::int,
    1,
    'an die Trainerin'
);

SELECT is(
    public.enqueue_key_reminders(),
    0,
    'nur einmal je Termin'
);

-- Trägt sich jemand ein und wieder aus, fehlt der Schlüssel wieder.
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;
SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-0000000000aa',
                                         '22222222-1111-0000-0000-000000000001');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    public.enqueue_key_reminders(),
    0,
    'Mit Schlüsselbringer keine Erinnerung'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;
SELECT public.rpc_set_session_key_bearer('77777777-0000-0000-0000-0000000000aa', NULL);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    public.enqueue_key_reminders(),
    1,
    'Nach dem Austragen erinnert es noch einmal'
);

SELECT * FROM finish();
ROLLBACK;
