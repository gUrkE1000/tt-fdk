-- Kalender-Abo (Migration calendar_subscription) und Ende der Schlüsselverwaltung
-- (Migration remove_key_management).

BEGIN;
SELECT plan(18);

-- Meik (…0005) führt die 1. Herren (Heimspiel 1, Auswärtsspiel 2, vergangenes 4) und
-- ist dem Erwachsenentraining zugeordnet. Spieler 09 gehört zu keiner Mannschaft.

-- ============================================================ Schlüsselverwaltung weg
SELECT ok(to_regclass('public.keys') IS NULL, 'Die Tabelle keys gibt es nicht mehr');
SELECT ok(to_regclass('public.key_handovers') IS NULL, 'key_handovers auch nicht');
SELECT ok(to_regclass('public.v_keys') IS NULL, 'und die Sicht v_keys nicht');
SELECT hasnt_column('public', 'v_session_keys', 'holder_name',
    'Die Terminkarte nennt keine Schlüsselinhaber mehr');
SELECT has_column('public', 'v_session_keys', 'duty_name',
    'wohl aber den Schlüsseldienst');

-- ============================================================ Abo-Einstellungen
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT is(
    (public.rpc_my_calendar_subscription() ->> 'include_trainings')::boolean,
    false,
    'Trainings sind anfangs nicht im Abo'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_calendar_trainings(true) $$,
    'Das Mitglied nimmt seine Trainings dazu'
);

SELECT is(
    (public.rpc_my_calendar_subscription() ->> 'include_trainings')::boolean,
    true,
    'und das gilt für denselben Link'
);

SELECT throws_ok(
    $$ SELECT * FROM public.calendar_feed_items(
           '22222222-0000-0000-0000-000000000005', NOW() - INTERVAL '30 days', true) $$,
    '42501',
    NULL,
    'Die Einträge liest nur der Server — fremde Kalender bleiben zu'
);

-- ============================================================ Inhalt
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT set_eq(
    $$ SELECT title FROM public.calendar_feed_items(
           '22222222-0000-0000-0000-000000000005', NOW() - INTERVAL '30 days', false)
        WHERE kind = 'match' $$,
    ARRAY['1. Herren – TTC Nachbarstadt (Heim)',
          '1. Herren – TSV Beispieldorf (Auswärts)',
          '1. Herren – SC Altstadt (Heim)'],
    'Heim- und Auswärtsspiele der eigenen Mannschaft, als solche benannt'
);

SELECT is(
    (SELECT count(*) FROM public.calendar_feed_items(
         '22222222-0000-0000-0000-000000000005', NOW() - INTERVAL '30 days', false)
      WHERE kind = 'training')::int,
    0,
    'Ohne Schalter keine Trainings'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.calendar_feed_items(
                '22222222-0000-0000-0000-000000000005', NOW() - INTERVAL '30 days', true)
             WHERE uid = 'training-77777777-0000-0000-0000-000000000001'),
    'Mit Schalter das eigene Training'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.calendar_feed_items(
                    '22222222-0000-0000-0000-000000000005', NOW() - INTERVAL '30 days', true)
                 WHERE uid = 'training-77777777-0000-0000-0000-000000000004'),
    'aber kein fremdes, nicht offenes Training'
);

SELECT is(
    (SELECT count(*) FROM public.calendar_feed_items(
         '22222222-1111-0000-0000-000000000009', NOW() - INTERVAL '30 days', false)
      WHERE kind = 'match')::int,
    0,
    'Wer zu keiner Mannschaft gehört, bekommt keine Spiele'
);

-- Angefragt für ein Spiel einer fremden Mannschaft: dann steht es drin.
INSERT INTO public.match_participations (match_id, profile_id, response, source)
VALUES ('55555555-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000009', 'yes', 'leader');

SELECT is(
    (SELECT description FROM public.calendar_feed_items(
         '22222222-1111-0000-0000-000000000009', NOW() - INTERVAL '30 days', false)
      WHERE uid = 'match-55555555-0000-0000-0000-000000000003') LIKE '%Deine Rückmeldung: Zusage%',
    true,
    'Ein Spiel mit Anfrage steht drin, mit der eigenen Rückmeldung'
);

-- Hallensperre: für alle, ganztägig.
INSERT INTO public.training_cancellations (venue_id, from_date, to_date, reason)
VALUES ('11111111-0000-0000-0000-000000000002', CURRENT_DATE + 10, CURRENT_DATE + 11, 'Turnier');

SELECT is(
    (SELECT title || '|' || all_day::text
       || '|' || to_char(starts_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
       || '|' || ((ends_at AT TIME ZONE 'Europe/Berlin')::date - (starts_at AT TIME ZONE 'Europe/Berlin')::date)::text
       FROM public.calendar_feed_items(
         '22222222-1111-0000-0000-000000000009', NOW() - INTERVAL '30 days', false)
      WHERE kind = 'venue_blocked'),
    'Halle gesperrt: Gymnasium Musterstadt (Turnier)|true|00:00|2',
    'Jede Hallensperre steht drin — ganztägig, beide Tage'
);

-- Ein abgesagtes Spiel bleibt stehen, als abgesagt.
UPDATE public.matches SET active = false, cancel_reason = 'zurückgezogen'
 WHERE id = '55555555-0000-0000-0000-000000000001';

SELECT is(
    (SELECT title || '|' || cancelled::text FROM public.calendar_feed_items(
         '22222222-0000-0000-0000-000000000005', NOW() - INTERVAL '30 days', false)
      WHERE uid = 'match-55555555-0000-0000-0000-000000000001'),
    '1. Herren – TTC Nachbarstadt (Heim) – fällt aus|true',
    'Ein abgesagtes Spiel bleibt als „fällt aus" im Kalender'
);

SELECT is(
    (SELECT count(*) FROM public.calendar_feed_items(
         '22222222-0000-0000-0000-000000000005', NOW() + INTERVAL '10 days', false)
      WHERE kind = 'match')::int,
    1,
    'Der Zeitraum gilt: ab in zehn Tagen nur noch das Auswärtsspiel'
);

SELECT * FROM finish();
ROLLBACK;
