-- Training: wer sieht welches Training, wer meldet sich zurück, was verbirgt Inkognito?
--
-- Die Nummer 080 statt der im Plan genannten 070: die war schon an die Ersatzkette
-- vergeben.

BEGIN;
SELECT plan(39);

-- Tina (…0003) leitet „Erwachsenentraining" und „Offenes Training",
-- Theo (…0004) leitet das inkognito geführte „Jugendtraining".
-- Spieler 01–03 gehören zum Erwachsenentraining, Spieler 04–05 zum Jugendtraining,
-- Spieler 06 zu keinem.

-- ============================================================ einfaches Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000006'); END $$;

SELECT is(
    (SELECT count(*) FROM public.trainings)::int,
    3,
    'Ein Mitglied sieht alle Trainings, auch die ohne eigene Zuordnung'
);

-- Fünf künftige aus dem Seed plus die vier zurückliegenden für die Statistik (9.9).
SELECT is(
    (SELECT count(*) FROM public.training_sessions)::int,
    9,
    'und alle Trainingstermine'
);

SELECT throws_ok(
    $$ INSERT INTO public.trainings (name, weekday, time_start)
       VALUES ('Heimliches Training', 1, '18:00') $$,
    '42501',
    NULL,
    'Ein Mitglied legt kein Training an'
);

SELECT throws_ok(
    $$ INSERT INTO public.training_sessions (training_id, session_date, starts_at)
       VALUES ('66666666-0000-0000-0000-000000000001', CURRENT_DATE + 30, NOW() + INTERVAL '30 days') $$,
    '42501',
    NULL,
    'und schon gar keinen Termin: die erzeugt nur der Job'
);

-- Ohne passende Policy trifft ein UPDATE keine Zeile; PostgreSQL meldet dabei
-- keinen Fehler, sondern ändert schlicht nichts. Geprüft wird deshalb die Wirkung.
UPDATE public.training_attendance SET status = 'no'
 WHERE session_id = '77777777-0000-0000-0000-000000000001'
   AND profile_id = '22222222-1111-0000-0000-000000000001';

SELECT is(
    (SELECT status::text FROM public.training_attendance
      WHERE session_id = '77777777-0000-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'yes',
    'Ein direkter Schreibversuch auf die Teilnahme bleibt wirkungslos'
);

SELECT is(
    (SELECT yes_count::int FROM public.v_session_counts
      WHERE session_id = '77777777-0000-0000-0000-000000000001'),
    1,
    'Bei einem offen geführten Training sieht jeder den Zähler'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000001', 'yes') $$,
    '42501',
    NULL,
    'Wer einem Training nicht zugeordnet ist, meldet sich dort auch nicht zurück'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000005', 'yes', 1) $$,
    'Zu einem offenen Training darf sich jedes aktive Mitglied melden'
);

-- ============================================================ Gast
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is(
    (SELECT count(*) FROM public.trainings)::int,
    1,
    'Ein Gast sieht nur offene Trainings'
);

SELECT is(
    (SELECT name FROM public.trainings),
    'Offenes Training',
    'und zwar genau das offene'
);

SELECT is(
    (SELECT count(*) FROM public.training_sessions)::int,
    1,
    'Termine sieht der Gast nur zu diesem einen Training'
);

SELECT lives_ok(
    $$ INSERT INTO public.training_members (training_id, profile_id)
       VALUES ('66666666-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000008') $$,
    'In ein offenes Training trägt sich der Gast selbst ein'
);

SELECT throws_ok(
    $$ INSERT INTO public.training_members (training_id, profile_id)
       VALUES ('66666666-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000008') $$,
    '42501',
    NULL,
    'in ein zugeordnetes Training dagegen nicht'
);

-- ============================================================ Inkognito
-- Spieler 04 gehört zum Jugendtraining, sieht aber weder die anderen Namen
-- noch deren Zahl.
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000004'); END $$;

SELECT is(
    (SELECT count(*) FROM public.training_attendance
      WHERE session_id = '77777777-0000-0000-0000-000000000004')::int,
    1,
    'Inkognito: ein Teilnehmer sieht nur die eigene Rückmeldung'
);

SELECT is(
    (SELECT count(*) FROM public.v_session_counts
      WHERE session_id = '77777777-0000-0000-0000-000000000004')::int,
    0,
    'Inkognito: auch den Zähler bekommt er nicht'
);

SELECT is(
    (SELECT count(*) FROM public.training_members
      WHERE training_id = '66666666-0000-0000-0000-000000000002')::int,
    1,
    'Inkognito: und die Zuordnungsliste ebenso wenig'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000004'); END $$;

SELECT is(
    (SELECT count(*) FROM public.training_attendance
      WHERE session_id = '77777777-0000-0000-0000-000000000004')::int,
    2,
    'Der Trainer sieht trotz Inkognito alle Rückmeldungen'
);

SELECT is(
    (SELECT yes_count::int FROM public.v_session_counts
      WHERE session_id = '77777777-0000-0000-0000-000000000004'),
    1,
    'und den Zähler'
);

SELECT is(
    (SELECT count(*) FROM public.training_members
      WHERE training_id = '66666666-0000-0000-0000-000000000002')::int,
    2,
    'und die Zuordnungsliste'
);

-- ============================================================ Teilnahme melden
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000001', 'no') $$,
    'Die eigene Rückmeldung lässt sich jederzeit ändern'
);

SELECT is(
    (SELECT status::text FROM public.training_attendance
      WHERE session_id = '77777777-0000-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'no',
    'und steht danach so in der Tabelle'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000003', 'yes') $$,
    '42501',
    NULL,
    'Zu einem vergangenen Termin meldet sich niemand mehr zurück'
);

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000001', 'yes', 0,
                                                 '22222222-1111-0000-0000-000000000002') $$,
    '42501',
    NULL,
    'und niemand meldet einen anderen zurück'
);

-- Das Jugendtraining hat vier Plätze, zwei sind vergeben.
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000004', 'yes', 3) $$,
    '23514',
    NULL,
    'Mehr Gäste als Plätze weist die Teilnehmergrenze ab'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000004', 'yes', 1) $$,
    'so viele, wie noch hineinpassen, dagegen nicht'
);

-- Ein abgesagter Termin nimmt keine Rückmeldung mehr an.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
UPDATE public.training_sessions
   SET cancelled = true, cancel_reason = 'Halle gesperrt'
 WHERE id = '77777777-0000-0000-0000-000000000002';

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000002', 'yes') $$,
    '42501',
    NULL,
    'Ein abgesagter Termin nimmt keine Rückmeldung an'
);

-- Der Trainer darf für andere melden.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000001', 'yes', 0,
                                                 '22222222-1111-0000-0000-000000000001') $$,
    'Der Trainer meldet ein Mitglied selbst zurück'
);

SELECT is(
    (SELECT source::text FROM public.training_attendance
      WHERE session_id = '77777777-0000-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'trainer',
    'und die Zeile trägt danach den Trainer als Quelle'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_training_attendance('77777777-0000-0000-0000-000000000003', 'yes', 0,
                                                 '22222222-1111-0000-0000-000000000001') $$,
    'Nachtragen kann der Trainer auch für einen vergangenen Termin'
);

-- ============================================================ Trainer- und Adminrechte
SELECT lives_ok(
    $$ UPDATE public.trainings SET details = 'Neue Zeiten ab Januar'
        WHERE id = '66666666-0000-0000-0000-000000000001' $$,
    'Das eigene Training ändert der Trainer selbst'
);

UPDATE public.trainings SET name = 'Entführtes Training'
 WHERE id = '66666666-0000-0000-0000-000000000002';

SELECT is(
    (SELECT name FROM public.trainings WHERE id = '66666666-0000-0000-0000-000000000002'),
    'Jugendtraining',
    'ein fremdes dagegen nicht'
);

SELECT lives_ok(
    $$ INSERT INTO public.training_cancellations (training_id, from_date, to_date, reason)
       VALUES ('66666666-0000-0000-0000-000000000001', CURRENT_DATE + 20, CURRENT_DATE + 27, 'Osterferien') $$,
    'Sein Training sagt der Trainer selbst ab'
);

SELECT throws_ok(
    $$ INSERT INTO public.training_cancellations (venue_id, from_date, to_date, reason)
       VALUES ('11111111-0000-0000-0000-000000000001', CURRENT_DATE + 20, CURRENT_DATE + 27, 'Wahllokal') $$,
    '42501',
    NULL,
    'eine ganze Halle sperrt er nicht'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.training_cancellations (venue_id, from_date, to_date, reason)
       VALUES ('11111111-0000-0000-0000-000000000001', CURRENT_DATE + 20, CURRENT_DATE + 27, 'Wahllokal') $$,
    'Der Administrator sperrt die Halle'
);

-- Als Administrator, damit hier nur die Bedingung der Tabelle greifen kann und
-- nicht schon die Policy abweist.
SELECT throws_ok(
    $$ INSERT INTO public.training_cancellations (training_id, venue_id, from_date, to_date)
       VALUES ('66666666-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
               CURRENT_DATE, CURRENT_DATE) $$,
    '23514',
    NULL,
    'Ein Ausfall gilt entweder einem Training oder einem Ort, nie beidem'
);

-- ============================================================ Feiertage
SELECT lives_ok(
    $$ INSERT INTO public.holidays (bundesland, kind, name, start_date, end_date)
       VALUES ('NW', 'public', 'Tag des Tischtennis', '2026-07-01', '2026-07-01') $$,
    'Feiertage pflegt der Administrator'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000006'); END $$;

SELECT is(
    (SELECT count(*) FROM public.holidays WHERE name = 'Tag des Tischtennis')::int,
    1,
    'lesen dürfen sie alle'
);

-- Der Import aus Aufgabe 6.2 ist eine Migration und muss deshalb hier ankommen.
SELECT is(
    (SELECT start_date::text FROM public.holidays
      WHERE bundesland = 'NW' AND kind = 'public' AND name = 'Karfreitag'
        AND start_date BETWEEN '2026-01-01' AND '2026-12-31'),
    '2026-04-03',
    'Die eingespielten gesetzlichen Feiertage stehen in der Datenbank'
);

SELECT throws_ok(
    $$ INSERT INTO public.holidays (bundesland, kind, name, start_date, end_date)
       VALUES ('NW', 'public', 'Tag der Ausrede', '2026-11-11', '2026-11-11') $$,
    '42501',
    NULL,
    'schreiben nicht'
);

SELECT * FROM finish();
ROLLBACK;
