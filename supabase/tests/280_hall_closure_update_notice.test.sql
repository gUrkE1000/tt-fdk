-- Hallensperrung ändern (Migration hall_closure_update_notice): Benachrichtigt wird
-- nur, was neu dazukommt.

BEGIN;
SELECT plan(5);

-- Spiel 1 ist ein Heimspiel der 1. Herren (Mannschaftsführer …0005) in Halle 1.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

-- Die Sperre beginnt am Tag vor dem Spiel und endet dort.
INSERT INTO public.training_cancellations (id, venue_id, from_date, to_date, reason, notify_email)
VALUES ('cccccccc-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
        (SELECT (dtstart AT TIME ZONE 'Europe/Berlin')::date - 1 FROM public.matches
          WHERE id = '55555555-0000-0000-0000-000000000001'),
        (SELECT (dtstart AT TIME ZONE 'Europe/Berlin')::date - 1 FROM public.matches
          WHERE id = '55555555-0000-0000-0000-000000000001'),
        'Renovierung', false);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
DELETE FROM public.notifications;
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

UPDATE public.training_cancellations SET reason = 'Renovierung (Boden)'
 WHERE id = 'cccccccc-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is((SELECT count(*) FROM public.notifications)::int, 0,
    'Nur der Grund geändert: keine Nachricht');

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;
UPDATE public.training_cancellations SET to_date = to_date + 1
 WHERE id = 'cccccccc-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked' AND channel = 'email'
        AND profile_id = '22222222-0000-0000-0000-000000000005')::int,
    1,
    'Verlängert bis auf den Spieltag: Die Mannschaftsführung erfährt es'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;
UPDATE public.training_cancellations SET to_date = to_date + 1
 WHERE id = 'cccccccc-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'match_venue_blocked' AND channel = 'email')::int,
    1,
    'Noch einen Tag länger: keine zweite Nachricht zum selben Spiel'
);

-- Der Trainingstag …0001: Sperre in die Halle des Trainings legen, genau auf den Tag.
DELETE FROM public.notifications;
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;
UPDATE public.training_cancellations
   SET venue_id = (SELECT COALESCE(t.venue_id, public.club_default_venue())
                     FROM public.training_sessions s JOIN public.trainings t ON t.id = s.training_id
                    WHERE s.id = '77777777-0000-0000-0000-000000000001'),
       from_date = (SELECT session_date FROM public.training_sessions
                     WHERE id = '77777777-0000-0000-0000-000000000001'),
       to_date   = (SELECT session_date FROM public.training_sessions
                     WHERE id = '77777777-0000-0000-0000-000000000001')
 WHERE id = 'cccccccc-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT ok(
    (SELECT count(*) FROM public.notifications WHERE type = 'training_cancelled') > 0,
    'Andere Halle bzw. anderer Tag: Die Mitglieder des Trainings erfahren es'
);

DELETE FROM public.notifications;
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;
UPDATE public.training_cancellations SET to_date = from_date
 WHERE id = 'cccccccc-0000-0000-0000-000000000001';

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
SELECT is((SELECT count(*) FROM public.notifications)::int, 0,
    'Unverändert gespeichert: keine Nachricht');

SELECT * FROM finish();
ROLLBACK;
