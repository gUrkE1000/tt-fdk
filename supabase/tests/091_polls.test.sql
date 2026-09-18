-- Umfragen: wer ist gemeint, wer sieht die Ergebnisse, was zählt als Stimme.

BEGIN;
SELECT plan(20);

-- Spieler 01 ist ein einfaches Mitglied, Olaf (…0002) der Organisator,
-- Anna (…0001) Administratorin und im Vorstand.

-- ============================================================ Sichtbarkeit
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.polls)::int,
    2,
    'Ein Mitglied sieht nur die Umfragen, die an alle gehen'
);

SELECT is(
    (SELECT count(*) FROM public.poll_options
      WHERE poll_id = '99999999-0000-0000-0000-000000000002')::int,
    0,
    'und nicht die Antworten einer fremden Umfrage'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.polls)::int,
    3,
    'Die Administratorin sieht alle'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

SELECT is(
    (SELECT count(*) FROM public.polls)::int,
    3,
    'der Organisator ebenso'
);

-- ============================================================ Abstimmen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT is(
    (SELECT public.rpc_vote_poll(ARRAY['aaaaaaaa-0000-0000-0000-000000000001']::uuid[])
        ->> 'status'),
    'ok',
    'Eine Stimme geht durch'
);

SELECT is(
    (SELECT count(*) FROM public.poll_votes
      WHERE profile_id = '22222222-1111-0000-0000-000000000003')::int,
    1,
    'und steht danach in der Tabelle'
);

SELECT is(
    (SELECT public.rpc_vote_poll(ARRAY[
        'aaaaaaaa-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000003']::uuid[]) ->> 'status'),
    'ok',
    'Zwei Kreuze sind bei zwei erlaubten Antworten in Ordnung'
);

SELECT is(
    (SELECT count(*) FROM public.poll_votes
      WHERE profile_id = '22222222-1111-0000-0000-000000000003')::int,
    2,
    'Die neue Stimme ersetzt die alte, sie kommt nicht dazu'
);

SELECT is(
    (SELECT public.rpc_vote_poll(ARRAY[
        'aaaaaaaa-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000003']::uuid[]) ->> 'status'),
    'too_many',
    'Drei Kreuze bei zwei erlaubten Antworten nicht'
);

SELECT is(
    (SELECT public.rpc_vote_poll(ARRAY[
        'aaaaaaaa-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000004']::uuid[]) ->> 'status'),
    'mixed_polls',
    'Antworten aus zwei Umfragen gehören nicht in eine Stimme'
);

SELECT is(
    (SELECT public.rpc_vote_poll(ARRAY['aaaaaaaa-0000-0000-0000-000000000004']::uuid[])
        ->> 'status'),
    'not_invited',
    'Wer nicht gemeint ist, stimmt auch nicht ab'
);

SELECT is(
    (SELECT public.rpc_retract_poll_vote('99999999-0000-0000-0000-000000000001')
        ->> 'status'),
    'ok',
    'Die eigene Stimme lässt sich zurückziehen'
);

SELECT is(
    (SELECT count(*) FROM public.poll_votes
      WHERE profile_id = '22222222-1111-0000-0000-000000000003')::int,
    0,
    'und ist danach weg'
);

-- Abgelaufene Umfrage
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.polls SET expires_at = NOW() - INTERVAL '1 day'
 WHERE id = '99999999-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT is(
    (SELECT public.rpc_vote_poll(ARRAY['aaaaaaaa-0000-0000-0000-000000000001']::uuid[])
        ->> 'status'),
    'expired',
    'Nach dem Ablaufdatum nimmt die Umfrage nichts mehr an'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.polls SET expires_at = NOW() + INTERVAL '20 days'
 WHERE id = '99999999-0000-0000-0000-000000000001';

-- Ein direkter Schreibversuch bleibt wirkungslos.
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT throws_ok(
    $$ INSERT INTO public.poll_votes (option_id, profile_id)
       VALUES ('aaaaaaaa-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000003') $$,
    '42501',
    NULL,
    'Direkt in die Stimmtabelle schreiben geht nicht'
);

-- ============================================================ Ergebnisse
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT votes FROM public.v_poll_results
      WHERE option_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
    2,
    'Bei offenen Ergebnissen zählt jeder mit'
);

SELECT is(
    (SELECT count(*) FROM public.v_poll_results
      WHERE poll_id = '99999999-0000-0000-0000-000000000002')::int,
    0,
    'Verborgene Ergebnisse bekommt ein Mitglied gar nicht erst'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.v_poll_results
      WHERE poll_id = '99999999-0000-0000-0000-000000000002')::int,
    2,
    'Die Administratorin sieht sie trotzdem'
);

-- Auch ein Mitglied im Vorstand sieht die Trikotumfrage — aber ohne Ergebnisse.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
INSERT INTO public.group_members (group_id, profile_id)
VALUES ('33333333-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000004'); END $$;

SELECT is(
    (SELECT count(*) FROM public.polls
      WHERE id = '99999999-0000-0000-0000-000000000002')::int,
    1,
    'Wer in der Zielgruppe ist, sieht die Umfrage'
);

SELECT is(
    (SELECT count(*) FROM public.v_poll_results
      WHERE poll_id = '99999999-0000-0000-0000-000000000002')::int,
    0,
    'aber die verborgenen Ergebnisse trotzdem nicht'
);

SELECT * FROM finish();
ROLLBACK;
