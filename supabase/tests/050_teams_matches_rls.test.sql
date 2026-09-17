-- Mannschaften und Spieltermine: wer darf lesen, wer schreiben?

BEGIN;
SELECT plan(20);

-- Meik führt die 1. Herren, Mara die 2., Mike die 3.
-- Spieler 01 ist ein einfaches Mitglied ohne Amt.

-- ============================================================ einfaches Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.teams)::int,
    3,
    'Jedes aktive Mitglied sieht alle Mannschaften'
);

SELECT is(
    (SELECT count(*) FROM public.matches)::int,
    4,
    'und alle Spieltermine'
);

SELECT throws_ok(
    $$ INSERT INTO public.teams (name, size) VALUES ('4. Herren', 4) $$,
    '42501',
    NULL,
    'Ein Mitglied legt keine Mannschaft an'
);

-- Ohne passende Policy trifft ein UPDATE keine Zeile. PostgreSQL meldet dabei keinen
-- Fehler, sondern ändert schlicht nichts — geprüft wird deshalb die Wirkung.
UPDATE public.match_participations SET response = 'yes'
 WHERE match_id = '55555555-0000-0000-0000-000000000001'
   AND profile_id = '22222222-0000-0000-0000-000000000005';

SELECT is(
    (SELECT response::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000005'),
    'none',
    'Ein direkter Schreibversuch auf die Beteiligung bleibt wirkungslos'
);

SELECT is(
    (SELECT count(*) FROM public.match_changes)::int,
    0,
    'Das Prüfprotokoll sieht ein einfaches Mitglied nicht'
);

-- ============================================================ Mannschaftsführer
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.team_members (team_id, profile_id, kind, rank)
       VALUES ('44444444-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000009', 'substitute', 3) $$,
    'Der Mannschaftsführer pflegt den eigenen Kader'
);

SELECT throws_ok(
    $$ INSERT INTO public.team_members (team_id, profile_id, kind, rank)
       VALUES ('44444444-0000-0000-0000-000000000003',
               '22222222-1111-0000-0000-000000000009', 'substitute', 3) $$,
    '42501',
    NULL,
    'aber nicht den einer fremden Mannschaft'
);

SELECT throws_ok(
    $$ INSERT INTO public.team_members (team_id, profile_id, kind)
       VALUES ('44444444-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000010', 'regular') $$,
    '23514',
    NULL,
    'Ein fünfter Stammspieler passt nicht in eine 4er-Mannschaft'
);

SELECT throws_ok(
    $$ INSERT INTO public.team_members (team_id, profile_id, kind, rank)
       VALUES ('44444444-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000011', 'substitute', 1) $$,
    '23505',
    NULL,
    'Zwei Ersatzspieler auf demselben Rang gibt es nicht'
);

UPDATE public.teams SET name = 'Erste' WHERE id = '44444444-0000-0000-0000-000000000001';

SELECT is(
    (SELECT name FROM public.teams WHERE id = '44444444-0000-0000-0000-000000000001'),
    '1. Herren',
    'Die Mannschaft selbst ändert nur der Administrator'
);

SELECT lives_ok(
    $$ INSERT INTO public.matches (team_id, summary, opponent, dtstart_external, dtend_external)
       VALUES ('44444444-0000-0000-0000-000000000001', 'Nachholspiel', 'TTC Nachbarstadt',
               NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days 4 hours') $$,
    'Der Mannschaftsführer legt ein Spiel der eigenen Mannschaft an'
);

SELECT throws_ok(
    $$ INSERT INTO public.matches (team_id, summary, opponent, dtstart_external, dtend_external)
       VALUES ('44444444-0000-0000-0000-000000000003', 'Nachholspiel', 'TTC Nachbarstadt',
               NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days 4 hours') $$,
    '42501',
    NULL,
    'aber keins für eine fremde Mannschaft'
);

DELETE FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001';

SELECT is(
    (SELECT count(*) FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001')::int,
    1,
    'Löschen darf nur der Administrator'
);

SELECT is(
    (SELECT required_players FROM public.matches WHERE summary = 'Nachholspiel'),
    4,
    'Die Sollzahl kommt aus der Mannschaftsgröße'
);

SELECT is(
    (SELECT count(*) FROM public.match_participations
      WHERE match_id = (SELECT id FROM public.matches WHERE summary = 'Nachholspiel'))::int,
    7,
    'Beim Anlegen bekommt der ganze Kader eine offene Zeile'
);

SELECT is(
    (SELECT count(DISTINCT response)::int FROM public.match_participations
      WHERE match_id = (SELECT id FROM public.matches WHERE summary = 'Nachholspiel')),
    1,
    'und zwar ausschließlich mit „keine Antwort"'
);

-- ============================================================ Gast
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is(
    (SELECT count(*) FROM public.teams)::int,
    3,
    'Ein Gast sieht die Mannschaften — die Spielpläne sind vereinsöffentlich'
);

-- ============================================================ Administrator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ UPDATE public.teams SET name = 'Erste Herren'
        WHERE id = '44444444-0000-0000-0000-000000000001' $$,
    'Der Administrator ändert die Mannschaft'
);

SELECT lives_ok(
    $$ DELETE FROM public.matches WHERE summary = 'Nachholspiel' $$,
    'und löscht Spieltermine'
);

SELECT is(
    (SELECT count(*) FROM public.match_participations
      WHERE match_id NOT IN (SELECT id FROM public.matches))::int,
    0,
    'Mit dem Spiel verschwindet auch die Beteiligung'
);

SELECT * FROM finish();
ROLLBACK;
