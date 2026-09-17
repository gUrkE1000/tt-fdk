-- Ersatzanfragen: wer darf fragen, wer darf antworten, was passiert dabei.

BEGIN;
SELECT plan(20);

DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- Spiel 1 gehört der 1. Herren; Meik führt sie, Theo und Olaf sind Ersatz.

-- ============================================================ Rechte
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_create_substitute_request('55555555-0000-0000-0000-000000000001',
                                                   '22222222-0000-0000-0000-000000000004') $$,
    '42501',
    NULL,
    'Ein einfaches Mitglied stellt keine Ersatzanfrage'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000007'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_create_substitute_request('55555555-0000-0000-0000-000000000001',
                                                   '22222222-0000-0000-0000-000000000004') $$,
    '42501',
    NULL,
    'Der Mannschaftsführer einer fremden Mannschaft auch nicht'
);

-- ============================================================ Anfrage stellen
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_create_substitute_request('55555555-0000-0000-0000-000000000001',
                                                   '22222222-0000-0000-0000-000000000004') $$,
    'Der Mannschaftsführer fragt einen Ersatzspieler an'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT status::text FROM public.substitute_requests
      WHERE profile_id = '22222222-0000-0000-0000-000000000004'),
    'pending',
    'Die Anfrage ist offen'
);

SELECT is(
    (SELECT created_by::text FROM public.substitute_requests
      WHERE profile_id = '22222222-0000-0000-0000-000000000004'),
    'leader',
    'und als von Hand gestellt vermerkt'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'substitute_request'
        AND profile_id = '22222222-0000-0000-0000-000000000004'
        AND channel = 'email')::int,
    1,
    'Der Gefragte bekommt eine E-Mail'
);

SELECT is(
    (SELECT count(*) FROM public.action_tokens WHERE action = 'substitute_answer')::int,
    1,
    'mit einem Antwortlink'
);

SELECT ok(
    (SELECT expires_at <= (SELECT dtstart FROM public.matches
                            WHERE id = '55555555-0000-0000-0000-000000000001')
       FROM public.substitute_requests
      WHERE profile_id = '22222222-0000-0000-0000-000000000004'),
    'Die Frist liegt nie nach dem Spielbeginn'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_create_substitute_request('55555555-0000-0000-0000-000000000001',
                                                   '22222222-0000-0000-0000-000000000004') $$,
    '23505',
    NULL,
    'Dieselbe Person wird je Termin nur einmal gefragt'
);

-- ============================================================ antworten
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

SELECT is(
    public.rpc_answer_substitute_request(
        (SELECT id FROM public.substitute_requests LIMIT 1), 'yes') ->> 'status',
    'unknown',
    'Auf eine fremde Anfrage kann niemand antworten'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000004'); END $$;

SELECT is(
    public.rpc_answer_substitute_request(
        (SELECT id FROM public.substitute_requests
          WHERE profile_id = '22222222-0000-0000-0000-000000000004'), 'vielleicht') ->> 'status',
    'invalid_answer',
    'Eine unsinnige Antwort wird abgewiesen'
);

SELECT is(
    public.rpc_answer_substitute_request(
        (SELECT id FROM public.substitute_requests
          WHERE profile_id = '22222222-0000-0000-0000-000000000004'), 'yes') ->> 'status',
    'ok',
    'Der Gefragte sagt zu'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT status::text FROM public.substitute_requests
      WHERE profile_id = '22222222-0000-0000-0000-000000000004'),
    'accepted',
    'Die Anfrage gilt als angenommen'
);

SELECT is(
    (SELECT response::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000004'),
    'yes',
    'und die Zusage steht in der Beteiligung'
);

SELECT is(
    (SELECT source::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000004'),
    'request',
    'mit dem Vermerk, dass sie aus einer Ersatzanfrage kam'
);

SELECT ok(
    (SELECT lineup_position IS NOT NULL FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000004'),
    'Der Ersatzspieler steht danach in der Aufstellung'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'substitute_found'
        AND profile_id = '22222222-0000-0000-0000-000000000005')::int,
    2,
    'Die Mannschaftsführung erfährt, dass Ersatz da ist'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000004'); END $$;

SELECT is(
    public.rpc_answer_substitute_request(
        (SELECT id FROM public.substitute_requests
          WHERE profile_id = '22222222-0000-0000-0000-000000000004'), 'no') ->> 'status',
    'used',
    'Ein zweites Mal geht dieselbe Anfrage nicht'
);

-- ============================================================ zurückziehen
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

DO $$
BEGIN
    PERFORM public.rpc_create_substitute_request('55555555-0000-0000-0000-000000000001',
                                                '22222222-0000-0000-0000-000000000002');
END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_cancel_substitute_request(
        (SELECT id FROM public.substitute_requests
          WHERE profile_id = '22222222-0000-0000-0000-000000000002')) $$,
    'Der Mannschaftsführer zieht eine Anfrage zurück'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT status::text FROM public.substitute_requests
      WHERE profile_id = '22222222-0000-0000-0000-000000000002'),
    'cancelled',
    'und sie gilt als zurückgezogen'
);

SELECT * FROM finish();
ROLLBACK;
