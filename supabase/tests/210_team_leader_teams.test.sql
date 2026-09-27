-- Mannschaftsführer legen Mannschaften an, ändern ihre eigenen und löschen welche
-- (Migration team_leader_teams).

BEGIN;
SELECT plan(10);

-- Meik führt die 1. Herren, Mike die 3. Spieler 01 ist ein einfaches Mitglied.

-- ============================================================ Mannschaftsführer
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.teams (id, name, size)
       VALUES ('44444444-0000-0000-0000-0000000000a1', '4. Herren', 4) $$,
    'Ein Mannschaftsführer legt eine Mannschaft an'
);

SELECT ok(
    public.leads_team('44444444-0000-0000-0000-0000000000a1'),
    'und führt sie danach selbst'
);

SELECT lives_ok(
    $$ INSERT INTO public.team_members (team_id, profile_id, kind)
       VALUES ('44444444-0000-0000-0000-0000000000a1',
               '22222222-1111-0000-0000-000000000009', 'regular') $$,
    'also pflegt er auch ihren Kader'
);

UPDATE public.teams SET name = 'Vierte Herren' WHERE id = '44444444-0000-0000-0000-0000000000a1';

SELECT is(
    (SELECT name FROM public.teams WHERE id = '44444444-0000-0000-0000-0000000000a1'),
    'Vierte Herren',
    'Die eigene Mannschaft ändert er selbst'
);

SELECT lives_ok(
    $$ DELETE FROM public.teams WHERE id = '44444444-0000-0000-0000-000000000003' $$,
    'Er löscht auch eine fremde Mannschaft'
);

SELECT is(
    (SELECT count(*) FROM public.teams WHERE id = '44444444-0000-0000-0000-000000000003')::int,
    0,
    'und sie ist danach weg'
);

SELECT is(
    (SELECT count(*) FROM public.matches
      WHERE team_id = '44444444-0000-0000-0000-000000000003')::int,
    0,
    'samt ihren Spielterminen'
);

SELECT throws_ok(
    $$ INSERT INTO public.team_leaders (team_id, profile_id)
       VALUES ('44444444-0000-0000-0000-0000000000a1',
               '22222222-0000-0000-0000-000000000006') $$,
    '42501',
    NULL,
    'Wer eine Mannschaft führt, legt weiter nur der Administrator fest'
);

-- ============================================================ einfaches Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

DELETE FROM public.teams WHERE id = '44444444-0000-0000-0000-000000000002';

SELECT is(
    (SELECT count(*) FROM public.teams WHERE id = '44444444-0000-0000-0000-000000000002')::int,
    1,
    'Ein Mitglied löscht keine Mannschaft'
);

-- ============================================================ Administrator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

INSERT INTO public.teams (id, name, size)
VALUES ('44444444-0000-0000-0000-0000000000a2', 'Damen', 4);

SELECT is(
    (SELECT count(*) FROM public.team_leaders
      WHERE team_id = '44444444-0000-0000-0000-0000000000a2')::int,
    0,
    'Legt der Administrator an, wählt er die Führung selbst'
);

SELECT * FROM finish();
ROLLBACK;
