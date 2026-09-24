-- Spieler anfragen, Sichtbarkeit je Mannschaft, „Ich hätte Zeit" (Migration match_requests).

BEGIN;
SELECT plan(24);

-- Meik führt die 1. Herren (Spiele 1, 2 und das vergangene 4), Mara die 2. (Spiel 3).
-- Spieler 09 gehört zu keiner Mannschaft, Spieler 03 spielt in der 3.
-- Theo ist Ersatzspieler der 1. Herren.

-- ============================================================ Sichtbarkeit
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000009'); END $$;

SELECT is(
    (SELECT count(*) FROM public.matches)::int,
    0,
    'Wer zu keiner Mannschaft gehört, sieht kein Spiel'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.matches)::int,
    4,
    'Der Administrator sieht alle Spiele'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT ok(
    NOT public.can_see_message_object('match', '55555555-0000-0000-0000-000000000001'),
    'Nachrichten am Spiel einer fremden Mannschaft bleiben verborgen'
);

SELECT throws_ok(
    $$ INSERT INTO public.match_volunteers (match_id, profile_id, kind)
       VALUES ('55555555-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000003', 'driver') $$,
    '42501',
    NULL,
    'Als Fahrer trägt man sich nur bei Spielen ein, die man sieht'
);

-- ============================================================ Anfragen
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT is(
    public.rpc_request_players(
        ARRAY['55555555-0000-0000-0000-000000000001',
              '55555555-0000-0000-0000-000000000002']::uuid[],
        ARRAY['22222222-1111-0000-0000-000000000009']::uuid[]),
    2,
    'Der Mannschaftsführer fragt einen Spieler für zwei Spiele auf einmal an'
);

SELECT is(
    public.rpc_request_players(
        ARRAY['55555555-0000-0000-0000-000000000001']::uuid[],
        ARRAY['22222222-1111-0000-0000-000000000009']::uuid[]),
    0,
    'Wer schon gefragt ist, wird nicht noch einmal gefragt'
);

SELECT is(
    public.rpc_request_players(
        ARRAY['55555555-0000-0000-0000-000000000004']::uuid[],
        ARRAY['22222222-1111-0000-0000-000000000010']::uuid[]),
    0,
    'Für ein vergangenes Spiel wird niemand mehr gefragt'
);

SELECT is(
    public.rpc_request_players(
        ARRAY['55555555-0000-0000-0000-000000000001']::uuid[],
        ARRAY['22222222-0000-0000-0000-000000000008']::uuid[]),
    0,
    'Ein Gast lässt sich nicht anfragen'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000006'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_request_players(
           ARRAY['55555555-0000-0000-0000-000000000001']::uuid[],
           ARRAY['22222222-1111-0000-0000-000000000010']::uuid[]) $$,
    '42501',
    NULL,
    'Die Führung einer anderen Mannschaft fragt hier niemanden an'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_created' AND channel = 'email'
        AND profile_id = '22222222-1111-0000-0000-000000000009')::int,
    2,
    'Der Angefragte bekommt je Spiel eine Anfrage'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000009'); END $$;

SELECT is(
    (SELECT count(*) FROM public.matches)::int,
    2,
    'und sieht genau die Spiele, für die er gefragt ist'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes') $$,
    'Er sagt zu'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000010'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes') $$,
    '42501',
    NULL,
    'Wer nicht gefragt ist, kann nicht zusagen'
);

-- ============================================================ Zurückziehen
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_withdraw_request('55555555-0000-0000-0000-000000000002',
                                          '22222222-1111-0000-0000-000000000009') $$,
    'Eine unbeantwortete Anfrage lässt sich zurückziehen'
);

SELECT throws_ok(
    $$ SELECT public.rpc_withdraw_request('55555555-0000-0000-0000-000000000001',
                                          '22222222-1111-0000-0000-000000000009') $$,
    '22023',
    NULL,
    'eine beantwortete nicht'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000009'); END $$;

SELECT is(
    (SELECT count(*) FROM public.matches)::int,
    1,
    'Nach dem Zurückziehen ist das Spiel wieder unsichtbar'
);

-- ============================================================ Ich hätte Zeit
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

INSERT INTO public.matches (id, team_id, summary, opponent, dtstart_external, dtend_external)
VALUES ('99999999-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000001',
        'Pokalspiel', 'SV Pokal', NOW() + INTERVAL '20 days', NOW() + INTERVAL '20 days 4 hours');

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000004'); END $$;

SELECT is(
    (SELECT count(*) FROM public.matches WHERE id = '99999999-0000-0000-0000-0000000000a1')::int,
    1,
    'Der Ersatzspieler sieht das neue Spiel seiner Mannschaft'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_match_response('99999999-0000-0000-0000-0000000000a1', 'yes') $$,
    '42501',
    NULL,
    'kann ohne Anfrage aber nicht zusagen'
);

SELECT lives_ok(
    $$ SELECT public.rpc_offer_match('99999999-0000-0000-0000-0000000000a1', 'Ab 19 Uhr') $$,
    'sondern meldet sich als verfügbar'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_offer' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000005'
        AND body_text LIKE '%Ab 19 Uhr%')::int,
    1,
    'Der Mannschaftsführer erfährt es, samt Hinweis'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_offer_match('99999999-0000-0000-0000-0000000000a1') $$,
    '42501',
    NULL,
    'Für eine fremde Mannschaft meldet sich niemand verfügbar'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT is(
    (SELECT comment FROM public.match_offers
      WHERE match_id = '99999999-0000-0000-0000-0000000000a1'),
    'Ab 19 Uhr',
    'Der Mannschaftsführer sieht das Angebot'
);

SELECT public.rpc_manage_player('99999999-0000-0000-0000-0000000000a1',
                                '22222222-0000-0000-0000-000000000004', 'add');

SELECT is(
    (SELECT count(*) FROM public.match_offers
      WHERE match_id = '99999999-0000-0000-0000-0000000000a1')::int,
    0,
    'Wer aufgestellt wird, hat kein offenes Angebot mehr'
);

SELECT is(
    (SELECT response::text FROM public.match_participations
      WHERE match_id = '99999999-0000-0000-0000-0000000000a1'
        AND profile_id = '22222222-0000-0000-0000-000000000004'),
    'yes',
    'und steht mit Zusage im Spiel'
);

SELECT * FROM finish();
ROLLBACK;
