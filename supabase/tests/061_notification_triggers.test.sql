-- Was löst welche Benachrichtigung aus?

BEGIN;
SELECT plan(18);

DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- ============================================================ neues Spiel
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

DO $$
BEGIN
    INSERT INTO public.matches (id, team_id, summary, opponent, dtstart_external, dtend_external)
    VALUES ('66666666-0000-0000-0000-000000000001',
            '44444444-0000-0000-0000-000000000001',
            'Nachholspiel', 'TTC Nachbarstadt',
            NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days 4 hours');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(DISTINCT profile_id) FROM public.notifications
      WHERE type = 'match_created')::int,
    6,
    'Ein neues Spiel fragt den ganzen Kader'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_created' AND channel = 'email')::int,
    6,
    'je Person eine E-Mail'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT matches(
    (SELECT subject FROM public.notifications
      WHERE type = 'match_created' LIMIT 1),
    'TTC Nachbarstadt',
    'mit dem Gegner im Betreff'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.action_tokens WHERE action = 'match_response')::int,
    6,
    'und je Person ein Antwortlink'
);

-- Ein Spiel in der Vergangenheit lädt niemanden mehr ein.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$
BEGIN
    INSERT INTO public.matches (team_id, summary, opponent, dtstart_external, dtend_external)
    VALUES ('44444444-0000-0000-0000-000000000001', 'Altes Spiel', 'SC Altstadt',
            NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days' + INTERVAL '4 hours');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications)::int,
    0,
    'Ein bereits gespieltes Spiel erzeugt keine Einladung'
);

-- ============================================================ Verlegung
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$
BEGIN
    PERFORM tests.as_service_role();
    UPDATE public.matches
       SET dtstart_external = NOW() + INTERVAL '31 days',
           dtend_external   = NOW() + INTERVAL '31 days 4 hours',
           version = version + 1
     WHERE id = '66666666-0000-0000-0000-000000000001';
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(DISTINCT profile_id) FROM public.notifications
      WHERE type = 'match_changed')::int,
    6,
    'Eine Verlegung erreicht den ganzen Kader'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT matches(
    (SELECT body_text FROM public.notifications WHERE type = 'match_changed' LIMIT 1),
    'gilt nicht mehr',
    'und sagt deutlich, dass die alte Rückmeldung hinfällig ist'
);

-- Eine Änderung ohne neue Fassung ist keine Nachricht wert.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$
BEGIN
    UPDATE public.matches SET comment = 'Bitte pünktlich sein'
     WHERE id = '66666666-0000-0000-0000-000000000001';
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications)::int,
    0,
    'Ein geänderter Kommentar löst keine Benachrichtigung aus'
);

-- Absage des Spiels.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$
BEGIN
    UPDATE public.matches SET active = false, cancel_reason = 'Halle gesperrt'
     WHERE id = '66666666-0000-0000-0000-000000000001';
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(DISTINCT profile_id) FROM public.notifications
      WHERE type = 'match_changed')::int,
    6,
    'Ein abgesagtes Spiel erreicht ebenfalls den ganzen Kader'
);

-- ============================================================ Spielerverwaltung
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

DO $$
BEGIN
    PERFORM public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                     '22222222-1111-0000-0000-000000000007', 'add');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'player_added'
        AND profile_id = '22222222-1111-0000-0000-000000000007'
        AND channel = 'email')::int,
    1,
    'Wer hinzugefügt wird, bekommt eine E-Mail'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$
BEGIN
    PERFORM public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                     '22222222-1111-0000-0000-000000000007', 'remove');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'player_removed' AND channel = 'email')::int,
    1,
    'Wer herausgenommen wird, ebenfalls'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$
BEGIN
    PERFORM public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                     '22222222-1111-0000-0000-000000000007', 'reset');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications)::int,
    0,
    'Ein Zurücksetzen dagegen bleibt still — es sagt nichts über die Teilnahme aus'
);

-- Die Direkt-E-Mail geht auch gegen eine abgewählte Einstellung raus.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

INSERT INTO public.notification_preferences (profile_id, type, email, push)
VALUES ('22222222-1111-0000-0000-000000000007', 'player_added', false, false);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$
BEGIN
    PERFORM public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                     '22222222-1111-0000-0000-000000000007', 'add');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'player_added' AND channel = 'email')::int,
    1,
    'Eine Direkt-E-Mail lässt sich nicht abbestellen'
);

-- ============================================================ Aufstellung setzen
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$
BEGIN
    PERFORM public.rpc_set_lineup(
        '55555555-0000-0000-0000-000000000001',
        jsonb_build_array(
            jsonb_build_object('profile_id', '22222222-0000-0000-0000-000000000003', 'position', 1),
            jsonb_build_object('profile_id', '22222222-0000-0000-0000-000000000006', 'position', 2)
        )
    );
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(DISTINCT profile_id) FROM public.notifications
      WHERE type = 'match_assigned')::int,
    2,
    'Wer neu in der Aufstellung steht, wird benachrichtigt'
);

-- Beim zweiten Mal mit derselben Aufstellung gibt es nichts Neues zu melden.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$
BEGIN
    PERFORM public.rpc_set_lineup(
        '55555555-0000-0000-0000-000000000001',
        jsonb_build_array(
            jsonb_build_object('profile_id', '22222222-0000-0000-0000-000000000003', 'position', 1),
            jsonb_build_object('profile_id', '22222222-0000-0000-0000-000000000006', 'position', 2)
        )
    );
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications)::int,
    0,
    'Eine unveränderte Aufstellung benachrichtigt niemanden erneut'
);

-- ============================================================ Aufstellung teilen
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT is(
    public.rpc_share_lineup('55555555-0000-0000-0000-000000000001', 'Aufstellung: Tina, Mara'),
    2,
    'Der Aufstellungstext geht an die Aufgestellten'
);

SELECT throws_ok(
    $$ SELECT public.rpc_share_lineup('55555555-0000-0000-0000-000000000001', '   ') $$,
    '22023',
    NULL,
    'Ein leerer Text wird abgewiesen'
);

-- ============================================================ Freischaltung
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

DO $$
BEGIN
    PERFORM public.rpc_activate_member('22222222-0000-0000-0000-000000000009');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'welcome'
        AND profile_id = '22222222-0000-0000-0000-000000000009'
        AND channel = 'email')::int,
    1,
    'Die Freischaltung schickt eine Willkommens-E-Mail'
);

SELECT * FROM finish();
ROLLBACK;
