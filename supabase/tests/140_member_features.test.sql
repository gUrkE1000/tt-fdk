-- Verbesserungen aus Mitgliedersicht: Bemerkung beim Training, Antwort-Link fürs
-- Training, offene Umfragen, Meldung neuer Umfragen und Neuigkeiten.

BEGIN;
SELECT plan(32);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- Spieler 01 (…1111…0001) gehört zum Erwachsenentraining, Spieler 10 nicht.

-- ============================================================ Bemerkung beim Training
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance(
           '77777777-0000-0000-0000-000000000002', 'late', 0, NULL, 'komme erst 19:30') $$,
    'Wer später kommt, kann dazuschreiben, wann'
);

SELECT is(
    (SELECT comment FROM public.v_session_participants
      WHERE session_id = '77777777-0000-0000-0000-000000000002'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'komme erst 19:30',
    'Die Bemerkung steht in der Teilnehmerliste'
);

SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000002', 'yes');

SELECT is(
    (SELECT comment FROM public.v_session_participants
      WHERE session_id = '77777777-0000-0000-0000-000000000002'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'komme erst 19:30',
    'Ein Knopfdruck ohne Bemerkung lässt die alte stehen'
);

SELECT public.rpc_set_training_attendance(
    '77777777-0000-0000-0000-000000000002', 'yes', 0, NULL, '');

SELECT is(
    (SELECT comment FROM public.v_session_participants
      WHERE session_id = '77777777-0000-0000-0000-000000000002'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    '',
    'Eine leere Bemerkung löscht sie'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance(
           '77777777-0000-0000-0000-000000000002', 'late', 0, NULL, repeat('x', 501)) $$,
    '23514',
    NULL,
    'Mehr als 500 Zeichen werden abgelehnt'
);

-- ============================================================ Antwort-Link Training
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT public.enqueue_training_reminder(
    '77777777-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000003');

SELECT ok(
    (SELECT bool_and(payload ->> 'link' LIKE 'http://localhost:5173/r/%')
       FROM public.notifications
      WHERE type = 'training_attendance_request'
        AND profile_id = '22222222-1111-0000-0000-000000000003'),
    'Die Trainings-Erinnerung enthält jetzt einen Antwort-Link'
);

SELECT is(
    (SELECT action::text FROM public.action_tokens
      WHERE profile_id = '22222222-1111-0000-0000-000000000003'),
    'training_response',
    'mit einem Token für genau diesen Zweck'
);

SELECT ok(
    (SELECT expires_at FROM public.action_tokens
      WHERE profile_id = '22222222-1111-0000-0000-000000000003')
    = (SELECT starts_at FROM public.training_sessions
        WHERE id = '77777777-0000-0000-0000-000000000002'),
    'Der Link gilt bis zum Beginn des Trainings'
);

-- Der erzeugte Token bekommt einen festen Wert: Ohne Anmeldung ist die Tabelle
-- unsichtbar, und genau so ruft die Link-Seite auf.
UPDATE public.action_tokens SET token = '7a7a7a7a-0000-0000-0000-000000000009'
 WHERE profile_id = '22222222-1111-0000-0000-000000000003';

-- Feste Token für die Grenzfälle.
INSERT INTO public.action_tokens (token, profile_id, action, target_id, expires_at) VALUES
    -- Spieler 10 gehört nicht zum Erwachsenentraining.
    ('7a7a7a7a-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000010',
     'training_response', '77777777-0000-0000-0000-000000000002', NOW() + INTERVAL '10 days'),
    -- Vergangener Termin, Token noch nicht abgelaufen.
    ('7a7a7a7a-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000002',
     'training_response', '77777777-0000-0000-0000-000000000003', NOW() + INTERVAL '10 days'),
    -- Theo leitet das Jugendtraining; das wird gleich voll.
    ('7a7a7a7a-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004',
     'training_response', '77777777-0000-0000-0000-000000000004', NOW() + INTERVAL '10 days'),
    ('7a7a7a7a-0000-0000-0000-000000000004', '22222222-1111-0000-0000-000000000002',
     'training_response', '77777777-0000-0000-0000-000000000002', NOW() + INTERVAL '10 days');

UPDATE public.trainings SET max_participants = 2
 WHERE id = '66666666-0000-0000-0000-000000000002';

DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(
    public.rpc_describe_action_token('7a7a7a7a-0000-0000-0000-000000000009') ->> 'action',
    'training_response',
    'Die Link-Seite erkennt ein Training'
);

SELECT matches(
    public.rpc_describe_action_token('7a7a7a7a-0000-0000-0000-000000000009') ->> 'summary',
    '^Erwachsenentraining am ',
    'und nennt, welches'
);

SELECT is(
    public.rpc_answer_action_token('7a7a7a7a-0000-0000-0000-000000000009', 'late') ->> 'status',
    'ok',
    'Eine Trainingsrückmeldung über den Link wird angenommen'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT results_eq(
    $$ SELECT status::text, source::text FROM public.training_attendance
        WHERE session_id = '77777777-0000-0000-0000-000000000002'
          AND profile_id = '22222222-1111-0000-0000-000000000003' $$,
    $$ VALUES ('late', 'link') $$,
    'und steht mit Herkunft „Link" in der Teilnahme'
);

DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(
    public.rpc_answer_action_token('7a7a7a7a-0000-0000-0000-000000000009', 'yes') ->> 'status',
    'used',
    'Der Link ist danach verbraucht'
);

SELECT is(
    public.rpc_answer_action_token('7a7a7a7a-0000-0000-0000-000000000004', 'unclear') ->> 'status',
    'invalid_answer',
    '„Unsicher" gibt es beim Training nicht'
);

SELECT is(
    public.rpc_answer_action_token('7a7a7a7a-0000-0000-0000-000000000001', 'yes') ->> 'status',
    'not_assigned',
    'Wer nicht zum Training gehört, kann auch über den Link nicht zusagen'
);

SELECT is(
    public.rpc_answer_action_token('7a7a7a7a-0000-0000-0000-000000000002', 'yes') ->> 'status',
    'started',
    'Nach Beginn nimmt auch der Link nichts mehr an'
);

SELECT is(
    public.rpc_answer_action_token('7a7a7a7a-0000-0000-0000-000000000003', 'yes') ->> 'status',
    'full',
    'Ein volles Training lehnt die Zusage ab'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.training_sessions SET cancelled = true
 WHERE id = '77777777-0000-0000-0000-000000000002';
DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(
    public.rpc_describe_action_token('7a7a7a7a-0000-0000-0000-000000000004') ->> 'status',
    'cancelled',
    'Ein ausgefallenes Training sagt das, statt Knöpfe anzubieten'
);

-- ============================================================ Link der Terminumfrage
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

INSERT INTO public.reschedule_polls (id, match_id, options) VALUES
    ('7b7b7b7b-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001',
     ARRAY[NOW() + INTERVAL '20 days']);

INSERT INTO public.action_tokens (token, profile_id, action, target_id, expires_at) VALUES
    ('7a7a7a7a-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000003',
     'poll_vote', '7b7b7b7b-0000-0000-0000-000000000001', NOW() + INTERVAL '10 days');

DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT results_eq(
    $$ SELECT r ->> 'status', r ->> 'action'
         FROM public.rpc_describe_action_token('7a7a7a7a-0000-0000-0000-000000000005') r $$,
    $$ VALUES ('ok', 'poll_vote') $$,
    'Der Link der Terminumfrage wird erkannt statt als „nicht unterstützt" abgewiesen'
);

-- ============================================================ offene Umfragen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT results_eq(
    $$ SELECT id FROM public.v_my_open_polls ORDER BY id $$,
    $$ VALUES ('99999999-0000-0000-0000-000000000003'::uuid) $$,
    'Offen ist nur, wo die eigene Stimme fehlt und man gemeint ist'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.v_my_open_polls)::int,
    3,
    'Der Vorstand sieht zusätzlich die Umfrage, die nur an ihn geht'
);

-- ============================================================ neue Umfrage melden
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_announce_poll('99999999-0000-0000-0000-000000000002') $$,
    '42501',
    NULL,
    'Ein Mitglied kann keine Umfrage an alle melden'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

SELECT is(
    public.rpc_announce_poll('99999999-0000-0000-0000-000000000002'),
    2,
    'Die Meldung erreicht genau die Zielgruppe (Vorstand: Anna und Olaf)'
);

SELECT is(
    public.rpc_announce_poll('99999999-0000-0000-0000-000000000002'),
    0,
    'Ein zweiter Aufruf meldet nichts ein zweites Mal'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT ok(
    (SELECT bool_and(payload ->> 'link' = 'http://localhost:5173/votes')
       FROM public.notifications WHERE type = 'poll_created'),
    'Der Link führt zu den Umfragen'
);

SELECT is(
    (SELECT DISTINCT subject FROM public.notifications WHERE type = 'poll_created'),
    'Neue Umfrage: Neue Trikotfarbe',
    'Der Betreff nennt die Umfrage'
);

-- Abgelaufene Umfragen meldet niemand mehr.
UPDATE public.polls SET expires_at = NOW() - INTERVAL '1 hour'
 WHERE id = '99999999-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

SELECT is(
    public.rpc_announce_poll('99999999-0000-0000-0000-000000000001'),
    0,
    'Eine abgelaufene Umfrage wird nicht mehr gemeldet'
);

-- ============================================================ Neuigkeit melden
INSERT INTO public.news (id, title, body_html, published_at) VALUES
    ('7c7c7c7c-0000-0000-0000-000000000001', 'Hallenzeiten im Winter', '<p>…</p>', NOW()),
    ('7c7c7c7c-0000-0000-0000-000000000002', 'Einladung zur JHV', '<p>…</p>',
     NOW() + INTERVAL '3 days');

SELECT is(
    public.rpc_announce_news('7c7c7c7c-0000-0000-0000-000000000001'),
    (SELECT count(*)::int FROM public.profiles WHERE deleted_at IS NULL AND status = 'active'),
    'Eine Neuigkeit erreicht alle aktiven Mitglieder'
);

SELECT is(
    public.rpc_announce_news('7c7c7c7c-0000-0000-0000-000000000001'),
    0,
    'und nur einmal'
);

SELECT public.rpc_announce_news('7c7c7c7c-0000-0000-0000-000000000002');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT ok(
    (SELECT bool_and(scheduled_for >= NOW() + INTERVAL '3 days' - INTERVAL '1 minute')
       FROM public.notifications
      WHERE type = 'news_published' AND payload ->> 'title' = 'Einladung zur JHV'),
    'Eine vordatierte Neuigkeit wird erst zum Veröffentlichungstermin gemeldet'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_announce_news('7c7c7c7c-0000-0000-0000-000000000001') $$,
    '42501',
    NULL,
    'Ein Mitglied kann keine Neuigkeit melden'
);

DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT ok(
    NOT has_function_privilege('anon', 'public.rpc_announce_poll(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated',
            'public.apply_training_answer(uuid, uuid, text)', 'EXECUTE'),
    'Die neuen Funktionen sind nur dort aufrufbar, wo sie hingehören'
);

SELECT * FROM finish();
ROLLBACK;
