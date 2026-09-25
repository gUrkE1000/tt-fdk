-- Mannschaftsführung: Meldung bei Absage, gesammelte Nachricht für neue Spiele
-- (Migration leader_notifications).

BEGIN;
SELECT plan(19);

-- Meik (05) führt die 1. Herren. Spiel 1 und 2 sind kommende Spiele der 1. Herren,
-- der ganze Kader ist angefragt (Seed). Spieler 03 gehört zum Kader.

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

-- ============================================================ Absage in der App
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;
SELECT lives_ok(
    $$ SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes') $$,
    'Spieler 01 sagt zu'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;
SELECT lives_ok(
    $$ SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'no',
                                            'Bin auf Dienstreise') $$,
    'Spieler 03 sagt ab'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_declined' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000005')::int,
    1,
    'Der Mannschaftsführer erfährt von der Absage'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_declined'
        AND profile_id <> '22222222-0000-0000-0000-000000000005')::int,
    0,
    'sonst niemand'
);

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE type = 'match_declined' AND channel = 'email'),
    'Bin auf Dienstreise',
    'mit der Bemerkung'
);

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE type = 'match_declined' AND channel = 'email'),
    'Stand: 1 von 4 Zusagen',
    'und dem Stand der Zusagen'
);

SELECT matches(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'match_declined' AND channel = 'email'),
    '/match/55555555-0000-0000-0000-000000000001$',
    'Der Link führt auf die Seite des Spiels'
);

SELECT is(
    (SELECT count(*) FROM public.action_tokens
      WHERE profile_id = '22222222-0000-0000-0000-000000000005'
        AND target_id = '55555555-0000-0000-0000-000000000001')::int,
    0,
    'ohne Antwortlink für den Mannschaftsführer'
);

-- Die Bemerkung ändern ist keine neue Absage.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;
SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'no', 'Doch länger');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_declined' AND channel = 'email')::int,
    1,
    'Eine bestehende Absage meldet sich nicht noch einmal'
);

-- Sagt der Mannschaftsführer selbst ab, bekommt er keine Nachricht über sich.
DELETE FROM public.notifications;
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'no');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications WHERE type = 'match_declined')::int,
    0,
    'Die eigene Absage des Mannschaftsführers meldet niemandem etwas'
);

-- ============================================================ Absage über den Link
DELETE FROM public.notifications;

DO $$
DECLARE
    v_token UUID;
BEGIN
    PERFORM tests.as_service_role();
    INSERT INTO public.action_tokens (profile_id, action, target_id, expires_at)
    VALUES ('22222222-0000-0000-0000-000000000006', 'match_response',
            '55555555-0000-0000-0000-000000000002', NOW() + INTERVAL '10 days')
    RETURNING token INTO v_token;

    PERFORM tests.logout();
    PERFORM public.rpc_answer_action_token(v_token, 'no');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_declined' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000005')::int,
    1,
    'Eine Absage über den Link aus der E-Mail meldet sich ebenso'
);

-- ============================================================ Absage durch den Mannschaftsführer
DELETE FROM public.notifications;
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
SELECT public.rpc_manage_player('55555555-0000-0000-0000-000000000002',
                                '22222222-0000-0000-0000-000000000004', 'decline');

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications WHERE type = 'match_declined')::int,
    0,
    'Setzt der Mannschaftsführer jemanden auf Absage, meldet sich nichts'
);

-- ============================================================ Neue Spiele gesammelt
DELETE FROM public.notifications;

DO $$
BEGIN
    PERFORM tests.as_service_role();
    INSERT INTO public.matches (team_id, summary, opponent, dtstart_external, dtend_external)
    VALUES
        ('44444444-0000-0000-0000-000000000001', 'Spiel A', 'TTC Anfang',
         NOW() + INTERVAL '40 days', NOW() + INTERVAL '40 days 4 hours'),
        ('44444444-0000-0000-0000-000000000001', 'Spiel B', 'SV Bemerk',
         NOW() + INTERVAL '47 days', NOW() + INTERVAL '47 days 4 hours');
    INSERT INTO public.matches (team_id, summary, opponent, dtstart_external, dtend_external)
    VALUES ('44444444-0000-0000-0000-000000000001', 'Spiel C', 'TSV Container',
            NOW() + INTERVAL '54 days', NOW() + INTERVAL '54 days 4 hours');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_players_needed' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000005')::int,
    1,
    'Drei neue Spiele, eine E-Mail an den Mannschaftsführer'
);

SELECT is(
    (SELECT subject FROM public.notifications
      WHERE type = 'match_players_needed' AND channel = 'email'),
    'Spieler anfragen: 3 neue Spiele',
    'Der Betreff nennt die Zahl'
);

SELECT ok(
    (SELECT body_text ~ 'TTC Anfang' AND body_text ~ 'SV Bemerk' AND body_text ~ 'TSV Container'
       FROM public.notifications
      WHERE type = 'match_players_needed' AND channel = 'email'),
    'Die E-Mail listet alle drei Spiele'
);

SELECT matches(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'match_players_needed' AND channel = 'email'),
    '/my-games$',
    'Bei mehreren Spielen führt der Link auf die Liste'
);

SELECT ok(
    (SELECT bool_and(scheduled_for > NOW() + INTERVAL '5 minutes')
       FROM public.notifications WHERE type = 'match_players_needed'),
    'Die Nachricht wartet, ob noch weitere Spiele kommen'
);

-- Was der Versand schon beansprucht hat, bleibt, wie es ist.
UPDATE public.notifications SET status = 'sending' WHERE type = 'match_players_needed';

DO $$
BEGIN
    PERFORM tests.as_service_role();
    INSERT INTO public.matches (team_id, summary, opponent, dtstart_external, dtend_external)
    VALUES ('44444444-0000-0000-0000-000000000001', 'Spiel D', 'DJK Danach',
            NOW() + INTERVAL '61 days', NOW() + INTERVAL '61 days 4 hours');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT subject FROM public.notifications
      WHERE type = 'match_players_needed' AND channel = 'email' AND status = 'pending'),
    'Spieler anfragen: 1. Herren gegen DJK Danach am '
        || to_char((NOW() + INTERVAL '61 days') AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
    'Ein Spiel nach dem Versand kommt einzeln, ohne die schon gemeldeten'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_players_needed' AND channel = 'email' AND status = 'sending')::int,
    1,
    'Die beanspruchte Nachricht bleibt unverändert'
);

SELECT * FROM finish();
ROLLBACK;
