-- Trainingsstatistik: wer sie sehen darf (Aufgabe 9.9)

BEGIN;
SELECT plan(9);

-- ============================================================ Voreinstellung: admins
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT public.may_see_training_statistics('66666666-0000-0000-0000-000000000001')),
    false,
    'Ein Mitglied sieht die Statistik nicht — Voreinstellung ist „admins"'
);

SELECT is(
    (SELECT count(*) FROM public.v_training_statistics)::int,
    0,
    'und bekommt entsprechend keine Zeile'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT ok(
    (SELECT count(*) FROM public.v_training_statistics)::int > 0,
    'Der Administrator sieht sie'
);

-- Die Trainerin dieses Trainings auch.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT is(
    (SELECT public.may_see_training_statistics('66666666-0000-0000-0000-000000000001')),
    true,
    'Die Trainerin ihres Trainings ebenfalls'
);

-- ============================================================ „all"
DO $$
BEGIN
    PERFORM tests.as_service_role();
    UPDATE public.trainings SET statistics_visibility = 'all'
     WHERE id = '66666666-0000-0000-0000-000000000001';
    PERFORM tests.login_as('22222222-1111-0000-0000-000000000001');
END $$;

SELECT is(
    (SELECT public.may_see_training_statistics('66666666-0000-0000-0000-000000000001')),
    true,
    'Bei „all" sieht sie jedes Mitglied'
);

-- ============================================================ „groups"
DO $$
BEGIN
    PERFORM tests.as_service_role();
    UPDATE public.trainings SET statistics_visibility = 'groups'
     WHERE id = '66666666-0000-0000-0000-000000000001';
    INSERT INTO public.training_statistics_groups (training_id, group_id)
    VALUES ('66666666-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
    PERFORM tests.login_as('22222222-1111-0000-0000-000000000001');
END $$;

-- Spieler 01 ist nicht in der Gruppe „Hobby".
SELECT is(
    (SELECT public.may_see_training_statistics('66666666-0000-0000-0000-000000000001')),
    false,
    'Bei „groups" sieht sie nur, wer in einer der Gruppen ist'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000010'); END $$;

SELECT is(
    (SELECT public.may_see_training_statistics('66666666-0000-0000-0000-000000000001')),
    true,
    'ein Mitglied der Gruppe dagegen schon'
);

-- ============================================================ Was gezählt wird
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

-- Künftige Termine sagen nichts über Anwesenheit.
SELECT is(
    (SELECT count(*) FROM public.v_training_statistics
      WHERE session_date > CURRENT_DATE)::int,
    0,
    'Künftige Termine zählen nicht mit'
);

-- „Keine Rückmeldung" ist etwas anderes als eine Absage.
SELECT is(
    (SELECT count(*) FROM public.v_training_statistics
      WHERE profile_id = '22222222-1111-0000-0000-000000000002'
        AND status = 'none')::int,
    2,
    'Fehlende Rückmeldungen bleiben von Absagen getrennt'
);

SELECT * FROM finish();
ROLLBACK;
