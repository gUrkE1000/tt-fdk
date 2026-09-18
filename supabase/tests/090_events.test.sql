-- Vereinstermine: wer darf anlegen, wer antworten, und was verhindert die Frist.

BEGIN;
SELECT plan(21);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- ============================================================ Lesen und Anlegen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000006'); END $$;

SELECT is(
    (SELECT count(*) FROM public.club_events)::int,
    3,
    'Jedes aktive Mitglied sieht alle Vereinstermine'
);

SELECT throws_ok(
    $$ INSERT INTO public.club_events (name, starts_at)
       VALUES ('Heimliches Fest', NOW() + INTERVAL '10 days') $$,
    '42501',
    NULL,
    'Ein Mitglied legt keinen Vereinstermin an'
);

UPDATE public.event_participations SET status = 'no'
 WHERE event_id = '88888888-0000-0000-0000-000000000001'
   AND profile_id = '22222222-1111-0000-0000-000000000001';

SELECT is(
    (SELECT status::text FROM public.event_participations
      WHERE event_id = '88888888-0000-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'yes',
    'Ein direkter Schreibversuch auf die Teilnahme bleibt wirkungslos'
);

-- Ein Gast sieht Vereinstermine ebenfalls — anders als Spieltermine.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is(
    (SELECT count(*) FROM public.club_events)::int,
    3,
    'Auch ein Gast sieht die Vereinstermine'
);

-- ============================================================ Antworten
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000006'); END $$;

SELECT is(
    (SELECT public.rpc_set_event_participation(
        '88888888-0000-0000-0000-000000000001', 'yes', 2) ->> 'status'),
    'ok',
    'Eine Zusage mit Gästen geht durch'
);

SELECT is(
    (SELECT guests FROM public.event_participations
      WHERE event_id = '88888888-0000-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000006'),
    2,
    'und die Gäste stehen an der Zeile'
);

SELECT is(
    (SELECT public.rpc_set_event_participation(
        '88888888-0000-0000-0000-000000000003', 'yes') ->> 'status'),
    'closed',
    'Zu einem vergangenen Termin nimmt niemand mehr teil'
);

-- Anmeldefrist
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.club_events SET participate_until = CURRENT_DATE - 1
 WHERE id = '88888888-0000-0000-0000-000000000002';

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000006'); END $$;

SELECT is(
    (SELECT public.rpc_set_event_participation(
        '88888888-0000-0000-0000-000000000002', 'yes') ->> 'status'),
    'closed',
    'Nach der Anmeldefrist ist Schluss, auch wenn der Termin noch kommt'
);

-- Teilnehmergrenze
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.club_events SET participate_until = NULL, max_participants = 4
 WHERE id = '88888888-0000-0000-0000-000000000002';

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000006'); END $$;

SELECT is(
    (SELECT public.rpc_set_event_participation(
        '88888888-0000-0000-0000-000000000002', 'yes', 3) ->> 'status'),
    'ok',
    'Vier Plätze fassen eine Person mit drei Gästen'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000007'); END $$;

SELECT is(
    (SELECT public.rpc_set_event_participation(
        '88888888-0000-0000-0000-000000000002', 'yes') ->> 'status'),
    'full',
    'der fünfte Platz nicht'
);

SELECT is(
    (SELECT public.rpc_set_event_participation(
        '88888888-0000-0000-0000-000000000002', 'no') ->> 'status'),
    'ok',
    'Absagen kann man trotzdem'
);

-- ============================================================ Einladung
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.club_events (id, name, starts_at)
       VALUES ('88888888-0000-0000-0000-000000000009', 'Sommerfest 2', NOW() + INTERVAL '30 days') $$,
    'Der Organisator legt einen Termin an'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(DISTINCT profile_id) FROM public.notifications
      WHERE type = 'event_invitation')::int,
    (SELECT count(*) FROM public.profiles WHERE status = 'active' AND deleted_at IS NULL)::int,
    'Die Einladung geht an den ganzen Verein'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.action_tokens
         WHERE action = 'event_response'
           AND target_id = '88888888-0000-0000-0000-000000000009'
    ),
    'und trägt einen Antwortlink ohne Anmeldung'
);

-- Ein Termin in der Vergangenheit lädt niemanden ein.
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

INSERT INTO public.club_events (name, starts_at)
VALUES ('Längst vorbei', NOW() - INTERVAL '5 days');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*) FROM public.notifications WHERE type = 'event_invitation')::int,
    0,
    'Ein Termin in der Vergangenheit lädt niemanden mehr ein'
);

-- ============================================================ Antwort über den Link
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT public.rpc_describe_action_token(
        (SELECT token FROM public.action_tokens
          WHERE action = 'event_response'
            AND profile_id = '22222222-1111-0000-0000-000000000008'
          LIMIT 1)) ->> 'action'),
    'event_response',
    'Der Link sagt, worum es geht, bevor er etwas speichert'
);

SELECT is(
    (SELECT public.rpc_answer_action_token(
        (SELECT token FROM public.action_tokens
          WHERE action = 'event_response'
            AND profile_id = '22222222-1111-0000-0000-000000000008'
          LIMIT 1), 'yes') ->> 'status'),
    'ok',
    'und speichert die Zusage'
);

SELECT is(
    (SELECT source::text FROM public.event_participations
      WHERE event_id = '88888888-0000-0000-0000-000000000009'
        AND profile_id = '22222222-1111-0000-0000-000000000008'),
    'link',
    'Die Zeile hält fest, dass die Antwort per Link kam'
);

SELECT is(
    (SELECT public.rpc_answer_action_token(
        (SELECT token FROM public.action_tokens
          WHERE action = 'event_response'
            AND profile_id = '22222222-1111-0000-0000-000000000008'
            AND used_at IS NOT NULL
          LIMIT 1), 'no') ->> 'status'),
    'used',
    'Ein zweites Mal geht derselbe Link nicht'
);

-- ============================================================ Offene Rückmeldungen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000009'); END $$;

SELECT ok(
    (SELECT count(*) FROM public.v_open_participations
      WHERE kind = 'event'
        AND profile_id = '22222222-1111-0000-0000-000000000009')::int > 0,
    'Ein Vereinstermin ohne Antwort steht in den offenen Rückmeldungen'
);

SELECT is(
    (SELECT count(*) FROM public.v_open_participations
      WHERE kind = 'event'
        AND id = '88888888-0000-0000-0000-000000000009'
        AND profile_id = '22222222-1111-0000-0000-000000000008')::int,
    0,
    'wer geantwortet hat, steht dort nicht mehr'
);

SELECT * FROM finish();
ROLLBACK;
