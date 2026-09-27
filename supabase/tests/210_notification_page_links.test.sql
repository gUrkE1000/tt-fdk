-- Benachrichtigungen führen auch auf die Seite des Termins
-- (Migration notification_page_links, Entscheidung E-2).

BEGIN;
SELECT plan(14);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;

-- ============================================================ Mit Antwort-Link
SELECT public.enqueue_notification(
    '22222222-0000-0000-0000-000000000001', 'match_reminder',
    public.match_payload('55555555-0000-0000-0000-000000000001'));

SELECT is(
    (SELECT payload ->> 'page' FROM public.notifications
      WHERE type = 'match_reminder' AND channel = 'email'),
    'http://localhost:5173/match/55555555-0000-0000-0000-000000000001',
    'Die Nutzlast eines Spiels trägt die Adresse seiner Seite'
);

SELECT matches(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'match_reminder' AND channel = 'email'),
    '/r/[0-9a-f-]+$',
    'Der Link bleibt der Antwort-Link'
);

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE type = 'match_reminder' AND channel = 'email'),
    E'/r/[0-9a-f-]+\n\nAnsehen: http://localhost:5173/match/55555555-0000-0000-0000-000000000001$',
    'Unter dem Antwort-Link steht die Seite des Spiels'
);

SELECT is(
    (SELECT body_text FROM public.notifications WHERE type = 'match_reminder' AND channel = 'push'),
    (SELECT body_text FROM public.notifications WHERE type = 'match_reminder' AND channel = 'email'),
    'Push und E-Mail haben denselben Text'
);

SELECT public.enqueue_notification(
    '22222222-0000-0000-0000-000000000001', 'event_invitation',
    public.event_payload('88888888-0000-0000-0000-000000000001'));

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE type = 'event_invitation' AND channel = 'email'),
    'Ansehen: http://localhost:5173/event/88888888-0000-0000-0000-000000000001$',
    'Ein Vereinstermin führt auf seine Seite'
);

SELECT public.enqueue_notification(
    '22222222-0000-0000-0000-000000000001', 'training_attendance_request',
    public.training_payload('77777777-0000-0000-0000-000000000001')
        || jsonb_build_object('action', 'training_response',
                              'target_id', '77777777-0000-0000-0000-000000000001'));

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE type = 'training_attendance_request' AND channel = 'email'),
    'Ansehen: http://localhost:5173/training/77777777-0000-0000-0000-000000000001$',
    'Ein Trainingstermin führt auf seine Seite'
);

-- ============================================================ Ohne Antwort-Link
DELETE FROM public.notifications;

SELECT public.enqueue_notification(
    '22222222-0000-0000-0000-000000000001', 'substitute_found',
    public.match_payload('55555555-0000-0000-0000-000000000001') - 'action' - 'target_id');

SELECT is(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'substitute_found' AND channel = 'email'),
    'http://localhost:5173/match/55555555-0000-0000-0000-000000000001',
    'Ohne Antwort führt der Link auf die Seite statt auf die Startseite'
);

SELECT unalike(
    (SELECT body_text FROM public.notifications
      WHERE type = 'substitute_found' AND channel = 'email'),
    '%Ansehen:%',
    'und steht nicht doppelt da'
);

SELECT ok(
    (SELECT NOT (payload ? 'token') FROM public.notifications
      WHERE type = 'substitute_found' AND channel = 'email'),
    'ohne Antwort-Token'
);

-- Die Mannschaftsführung bekam schon bisher die Seite als Link.
SELECT public.enqueue_notification(
    '22222222-0000-0000-0000-000000000005', 'match_declined',
    public.match_page_payload('55555555-0000-0000-0000-000000000001'));

SELECT unalike(
    (SELECT body_text FROM public.notifications
      WHERE type = 'match_declined' AND channel = 'email'),
    '%Ansehen:%',
    'Ist der Link schon die Seite, kommt keine zweite Zeile dazu'
);

-- Ein eigenes Ziel (Umfragen, Neuigkeiten) bleibt stehen.
SELECT public.enqueue_notification(
    '22222222-0000-0000-0000-000000000001', 'poll_created',
    jsonb_build_object('title', 'Sommerfest', 'link', 'http://localhost:5173/votes'));

SELECT is(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'poll_created' AND channel = 'email'),
    'http://localhost:5173/votes',
    'Ein eigenes Ziel bleibt, wie es ist'
);

-- Ohne Termin bleibt es bei der Startseite.
SELECT public.enqueue_notification('22222222-0000-0000-0000-000000000001', 'welcome');

SELECT is(
    (SELECT payload ->> 'link' FROM public.notifications
      WHERE type = 'welcome' AND channel = 'email'),
    'http://localhost:5173',
    'Ohne Termin führt der Link auf die Startseite'
);

-- ============================================================ Nachricht am Termin
DELETE FROM public.notifications;

INSERT INTO public.object_messages (object_type, object_id, author_id, body)
VALUES ('match', '55555555-0000-0000-0000-000000000001',
        '22222222-0000-0000-0000-000000000001', 'Wer fährt?');

SELECT is(
    (SELECT DISTINCT payload ->> 'link' FROM public.notifications WHERE type = 'object_message'),
    'http://localhost:5173/match/55555555-0000-0000-0000-000000000001',
    'Eine Nachricht am Spiel führt auf das Spiel'
);

SELECT unalike(
    (SELECT body_text FROM public.notifications WHERE type = 'object_message' LIMIT 1),
    '%Ansehen:%',
    'ohne zweite Zeile'
);

SELECT * FROM finish();
ROLLBACK;
