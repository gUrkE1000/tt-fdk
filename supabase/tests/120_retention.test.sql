-- Aufbewahrung und Löschung (Aufgabe 10.1)
--
-- Das Schema versprach seit der Baseline „endgültig nach 30 Tagen" — getan hat es
-- niemand. Diese Datei hält fest, dass es jetzt wirklich passiert.

BEGIN;
SELECT plan(9);

-- ============================================================ Vorbereitung
DO $$
BEGIN
    PERFORM tests.as_service_role();

    -- Ein Mitglied, das vor 60 Tagen gelöscht wurde, und eines von gestern.
    UPDATE public.profiles SET deleted_at = NOW() - INTERVAL '60 days'
     WHERE id = '22222222-1111-0000-0000-000000000006';

    UPDATE public.profiles SET deleted_at = NOW() - INTERVAL '1 day'
     WHERE id = '22222222-1111-0000-0000-000000000007';

    INSERT INTO public.notifications
        (id, profile_id, channel, type, subject, body_text, status, created_at)
    VALUES
        ('eeee0000-0000-0000-0000-000000000001',
         '22222222-1111-0000-0000-000000000001', 'email', 'match_reminder',
         'Alt', 'Text', 'sent', NOW() - INTERVAL '400 days'),
        ('eeee0000-0000-0000-0000-000000000002',
         '22222222-1111-0000-0000-000000000001', 'email', 'match_reminder',
         'Neu', 'Text', 'sent', NOW() - INTERVAL '10 days');

    INSERT INTO public.absences (id, profile_id, start_date, end_date, comment_private)
    VALUES
        ('eeee0000-0000-0000-0000-000000000003',
         '22222222-1111-0000-0000-000000000001',
         (NOW() - INTERVAL '800 days')::date, (NOW() - INTERVAL '790 days')::date, 'Kur'),
        ('eeee0000-0000-0000-0000-000000000004',
         '22222222-1111-0000-0000-000000000001',
         (NOW() + INTERVAL '10 days')::date, (NOW() + INTERVAL '20 days')::date, 'Urlaub');
END $$;

-- ============================================================ Der Lauf
SELECT ok(
    (SELECT (public.run_retention() ->> 'profiles')::int) = 1,
    'Ein vor 60 Tagen gelöschtes Konto verschwindet endgültig'
);

SELECT is(
    (SELECT count(*) FROM public.profiles
      WHERE id = '22222222-1111-0000-0000-000000000006')::int,
    0,
    'und ist danach wirklich weg, nicht nur unsichtbar'
);

-- Die Gnadenfrist schützt vor dem versehentlichen Löschen.
SELECT is(
    (SELECT count(*) FROM public.profiles
      WHERE id = '22222222-1111-0000-0000-000000000007')::int,
    1,
    'Ein gestern gelöschtes Konto bleibt zunächst stehen'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE id = 'eeee0000-0000-0000-0000-000000000001')::int,
    0,
    'Nachrichten älter als ein Jahr werden gelöscht'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE id = 'eeee0000-0000-0000-0000-000000000002')::int,
    1,
    'jüngere bleiben'
);

SELECT is(
    (SELECT count(*) FROM public.absences
      WHERE id = 'eeee0000-0000-0000-0000-000000000003')::int,
    0,
    'Abwesenheiten mit privatem Grund verschwinden nach zwei Jahren'
);

SELECT is(
    (SELECT count(*) FROM public.absences
      WHERE id = 'eeee0000-0000-0000-0000-000000000004')::int,
    1,
    'künftige selbstverständlich nicht'
);

-- ============================================================ Rechte
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_run_retention() $$,
    '42501',
    NULL,
    'Ein Mitglied stößt den Löschlauf nicht an'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_run_retention() $$,
    'Der Administrator darf ihn anstoßen — etwa nach einer Löschanfrage'
);

SELECT * FROM finish();
ROLLBACK;
