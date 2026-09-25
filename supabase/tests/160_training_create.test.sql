-- Training anlegen, wie der Dialog es tut: INSERT … RETURNING, danach Trainer und
-- Mitglieder eintragen (Migration training_create).

BEGIN;
SELECT plan(12);

-- ============================================================ Administrator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

-- PostgREST schickt `.insert().select('id')` als INSERT … RETURNING; genau das
-- scheiterte an der Lese-Policy.
SELECT lives_ok(
    $$ INSERT INTO public.trainings (id, name, weekday, time_start)
       VALUES ('66666666-0000-0000-0000-0000000000a1', 'Admin-Training', 3, '18:00')
       RETURNING id $$,
    'Der Administrator legt ein Training an und bekommt die id zurück'
);

SELECT is(
    (SELECT count(*) FROM public.training_trainers
      WHERE training_id = '66666666-0000-0000-0000-0000000000a1')::int,
    0,
    'und wird dabei nicht selbst zum Trainer'
);

SELECT lives_ok(
    $$ INSERT INTO public.training_trainers (training_id, profile_id)
       VALUES ('66666666-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-000000000004') $$,
    'Den Trainer trägt er selbst ein'
);

-- ============================================================ Trainer
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.trainings (id, name, weekday, time_start, is_open)
       VALUES ('66666666-0000-0000-0000-0000000000b1', 'Tinas Techniktraining', 4, '18:00', false)
       RETURNING id $$,
    'Ein Trainer legt ein Training an und bekommt die id zurück'
);

SELECT is(
    (SELECT array_agg(profile_id::text) FROM public.training_trainers
      WHERE training_id = '66666666-0000-0000-0000-0000000000b1'),
    ARRAY['22222222-0000-0000-0000-000000000003'],
    'und leitet es danach selbst'
);

SELECT lives_ok(
    $$ INSERT INTO public.training_members (training_id, profile_id)
       VALUES ('66666666-0000-0000-0000-0000000000b1', '22222222-1111-0000-0000-000000000001') $$,
    'Mitglieder ordnet er seinem neuen Training selbst zu'
);

SELECT lives_ok(
    $$ INSERT INTO public.training_trainers (training_id, profile_id)
       VALUES ('66666666-0000-0000-0000-0000000000b1', '22222222-0000-0000-0000-000000000004') $$,
    'und nimmt einen zweiten Trainer dazu'
);

SELECT lives_ok(
    $$ UPDATE public.trainings SET details = 'Aufschlag und Rückschlag'
        WHERE id = '66666666-0000-0000-0000-0000000000b1' $$,
    'Sein neues Training ändert er danach selbst'
);

SELECT is(
    (SELECT details FROM public.trainings WHERE id = '66666666-0000-0000-0000-0000000000b1'),
    'Aufschlag und Rückschlag',
    'und die Änderung kommt an'
);

-- ============================================================ Gast
-- Die Policy prüft jetzt die Spalten der Zeile; für Gäste muss es bei der alten
-- Regel bleiben.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.trainings WHERE id = '66666666-0000-0000-0000-0000000000b1'),
    'Ein Gast sieht ein neues, nicht offenes Training nicht'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.trainings WHERE is_open),
    'ein offenes dagegen schon'
);

-- ============================================================ Rechte
SELECT ok(
    NOT has_function_privilege('authenticated', 'public.add_creator_as_trainer()', 'EXECUTE'),
    'Die Trigger-Funktion ist von außen nicht aufrufbar'
);

SELECT * FROM finish();
ROLLBACK;
