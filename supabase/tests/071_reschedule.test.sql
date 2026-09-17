-- Spielverlegung: Umfrage starten, abstimmen, anwenden.

BEGIN;
SELECT plan(19);

DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- ============================================================ Rechte
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_start_reschedule_poll(
        '55555555-0000-0000-0000-000000000001',
        ARRAY[NOW() + INTERVAL '20 days']::timestamptz[]) $$,
    '42501',
    NULL,
    'Ein einfaches Mitglied startet keine Terminumfrage'
);

-- ============================================================ Umfrage starten
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_start_reschedule_poll(
        '55555555-0000-0000-0000-000000000001',
        ARRAY[NOW() - INTERVAL '1 day']::timestamptz[]) $$,
    '22023',
    NULL,
    'Ein Vorschlag in der Vergangenheit wird abgewiesen'
);

SELECT throws_ok(
    $$ SELECT public.rpc_start_reschedule_poll(
        '55555555-0000-0000-0000-000000000001',
        ARRAY[NOW() + INTERVAL '20 days', NOW() + INTERVAL '21 days',
              NOW() + INTERVAL '22 days', NOW() + INTERVAL '23 days']::timestamptz[]) $$,
    '22023',
    NULL,
    'Mehr als drei Vorschläge gibt es nicht'
);

SELECT lives_ok(
    $$ SELECT public.rpc_start_reschedule_poll(
        '55555555-0000-0000-0000-000000000001',
        ARRAY[NOW() + INTERVAL '20 days', NOW() + INTERVAL '21 days']::timestamptz[]) $$,
    'Der Mannschaftsführer startet die Umfrage'
);

SELECT throws_ok(
    $$ SELECT public.rpc_start_reschedule_poll(
        '55555555-0000-0000-0000-000000000001',
        ARRAY[NOW() + INTERVAL '25 days']::timestamptz[]) $$,
    '23505',
    NULL,
    'Zwei offene Umfragen zum selben Spiel gibt es nicht'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT status::text FROM public.reschedule_polls LIMIT 1),
    'open',
    'Die Umfrage läuft'
);

SELECT ok(
    (SELECT count(*) FROM public.notifications WHERE type = 'reschedule_poll') > 0,
    'Der Kader wird gefragt'
);

SELECT is(
    (SELECT count(*) FROM public.action_tokens WHERE action = 'poll_vote')::int,
    (SELECT count(DISTINCT profile_id)::int FROM public.notifications WHERE type = 'reschedule_poll'),
    'mit je einem Abstimmungslink'
);

-- ============================================================ abstimmen
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT is(
    public.rpc_vote_reschedule((SELECT id FROM public.reschedule_polls LIMIT 1), 0, true) ->> 'status',
    'ok',
    'Ein Spieler stimmt für den ersten Vorschlag'
);

SELECT is(
    public.rpc_vote_reschedule((SELECT id FROM public.reschedule_polls LIMIT 1), 5, true) ->> 'status',
    'invalid_answer',
    'Einen fünften Vorschlag gibt es nicht'
);

SELECT is(
    public.rpc_vote_reschedule((SELECT id FROM public.reschedule_polls LIMIT 1), 0, false) ->> 'status',
    'ok',
    'Eine Stimme lässt sich ändern'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*)::int FROM public.reschedule_votes
      WHERE profile_id = '22222222-0000-0000-0000-000000000003'),
    1,
    'und ersetzt die alte, statt sie zu verdoppeln'
);

SELECT is(
    (SELECT available FROM public.reschedule_votes
      WHERE profile_id = '22222222-0000-0000-0000-000000000003'),
    false,
    'mit dem neuen Wert'
);

-- ============================================================ Ergebnis
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000006'); END $$;

DO $$
BEGIN
    PERFORM public.rpc_vote_reschedule((SELECT id FROM public.reschedule_polls LIMIT 1), 0, true);
    PERFORM public.rpc_vote_reschedule((SELECT id FROM public.reschedule_polls LIMIT 1), 1, true);
END $$;

SELECT is(
    (SELECT available_count::int FROM public.v_reschedule_results WHERE option_index = 0),
    1,
    'Die Ergebnisansicht zählt die Zusagen je Vorschlag'
);

SELECT is(
    (SELECT unavailable_count::int FROM public.v_reschedule_results WHERE option_index = 0),
    1,
    'und die Absagen'
);

-- ============================================================ anwenden
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

DO $$
BEGIN
    PERFORM tests.as_service_role();
    DELETE FROM public.notifications;
    PERFORM tests.login_as('22222222-0000-0000-0000-000000000005');
    PERFORM public.rpc_apply_reschedule((SELECT id FROM public.reschedule_polls LIMIT 1), 1);
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT ok(
    (SELECT dtstart_override IS NOT NULL FROM public.matches
      WHERE id = '55555555-0000-0000-0000-000000000001'),
    'Der neue Termin steht als Verlegung, nicht als Importtermin'
);

SELECT is(
    (SELECT version FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001'),
    2,
    'Die Fassung steigt — alte Zusagen gelten nicht mehr'
);

SELECT is(
    (SELECT status::text FROM public.reschedule_polls LIMIT 1),
    'applied',
    'Die Umfrage ist abgeschlossen'
);

SELECT ok(
    (SELECT count(*) FROM public.notifications WHERE type = 'reschedule_confirmed') > 0,
    'Der Kader erfährt den neuen Termin'
);

SELECT * FROM finish();
ROLLBACK;
