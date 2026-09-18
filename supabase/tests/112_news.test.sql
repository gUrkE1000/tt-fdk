-- Vereinsneuigkeiten (Aufgabe 9.3)

BEGIN;
SELECT plan(8);

-- ============================================================ Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.news)::int,
    2,
    'Ein Mitglied sieht die veröffentlichten Neuigkeiten'
);

-- Die vordatierte gehört nicht dazu — sonst wäre sie nicht vordatiert.
SELECT is(
    (SELECT count(*) FROM public.news
      WHERE id = 'dddddddd-0000-0000-0000-000000000003')::int,
    0,
    'aber keine, deren Zeitpunkt noch nicht da ist'
);

SELECT is(
    (SELECT author_name FROM public.v_news
      WHERE id = 'dddddddd-0000-0000-0000-000000000001'),
    'Anna Admin',
    'mit dem Namen des Verfassers'
);

SELECT throws_ok(
    $$ INSERT INTO public.news (title) VALUES ('Selbst geschrieben') $$,
    '42501',
    NULL,
    'Schreiben darf ein Mitglied nicht'
);

-- ============================================================ Organisator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

SELECT is(
    (SELECT count(*) FROM public.news)::int,
    3,
    'Der Organisator sieht auch die vordatierte'
);

SELECT lives_ok(
    $$ INSERT INTO public.news (title, body_html)
       VALUES ('Neue Trikots', '<p>Ab Montag im Vereinsheim.</p>') $$,
    'und darf schreiben'
);

-- Der Verfasser kommt aus der Sitzung, nicht aus der Eingabe.
SELECT is(
    (SELECT author_id FROM public.news WHERE title = 'Neue Trikots'),
    '22222222-0000-0000-0000-000000000002'::uuid,
    'Der Verfasser wird gesetzt, nicht mitgeschickt'
);

-- Auch ein untergeschobener Verfasser hilft nicht.
DO $$
BEGIN
    INSERT INTO public.news (title, author_id)
    VALUES ('Im fremden Namen', '22222222-0000-0000-0000-000000000001');
END $$;

SELECT is(
    (SELECT author_id FROM public.news WHERE title = 'Im fremden Namen'),
    '22222222-0000-0000-0000-000000000002'::uuid,
    'Niemand schreibt im Namen eines anderen'
);

SELECT * FROM finish();
ROLLBACK;
