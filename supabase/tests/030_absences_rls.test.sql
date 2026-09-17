-- Abwesenheiten: wer sieht welche Zeiträume, und wer sieht den Grund?

BEGIN;
SELECT plan(14);

-- Zwei Abwesenheiten anlegen (als Superuser, RLS greift hier nicht).
INSERT INTO public.absences (id, profile_id, start_date, end_date, comment_private) VALUES
    ('44444444-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000001',
     '2026-10-01', '2026-10-14', 'Urlaub auf Mallorca'),
    ('44444444-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000002',
     '2026-11-01', '2026-11-03', 'Reha nach Kreuzbandriss');

-- ============================================================ eigenes Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.absences)::int,
    1,
    'Ein Mitglied sieht nur die eigene Abwesenheit'
);

SELECT is(
    (SELECT comment_private FROM public.v_absences
      WHERE id = '44444444-0000-0000-0000-000000000001'),
    'Urlaub auf Mallorca',
    'Den eigenen Grund sieht man'
);

SELECT lives_ok(
    $$ INSERT INTO public.absences (profile_id, start_date, end_date)
       VALUES (auth.uid(), '2026-12-01', '2026-12-05') $$,
    'Ein Mitglied darf sich selbst abwesend melden'
);

SELECT throws_ok(
    $$ INSERT INTO public.absences (profile_id, start_date, end_date)
       VALUES ('22222222-1111-0000-0000-000000000002', '2026-12-01', '2026-12-05') $$,
    '42501',
    NULL,
    'Ein Mitglied darf niemanden sonst abwesend melden'
);

SELECT throws_ok(
    $$ INSERT INTO public.absences (profile_id, start_date, end_date)
       VALUES (auth.uid(), '2026-12-10', '2026-12-05') $$,
    '23514',
    NULL,
    'Ein Ende vor dem Anfang weist die Datenbank zurück'
);

SELECT lives_ok(
    $$ DELETE FROM public.absences WHERE id = '44444444-0000-0000-0000-000000000001' $$,
    'Ein Mitglied darf die eigene Abwesenheit wieder löschen'
);

-- ============================================================ Mannschaftsführer
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT cmp_ok(
    (SELECT count(*) FROM public.absences)::int, '>=', 1,
    'Ein Mannschaftsführer sieht die Abwesenheiten des Vereins'
);

SELECT is(
    (SELECT comment_private FROM public.v_absences
      WHERE id = '44444444-0000-0000-0000-000000000002'),
    NULL,
    'Den Grund einer fremden Abwesenheit sieht er nicht'
);

SELECT isnt(
    (SELECT start_date FROM public.v_absences
      WHERE id = '44444444-0000-0000-0000-000000000002'),
    NULL,
    'Den Zeitraum sieht er sehr wohl — sonst könnte er nicht planen'
);

-- ============================================================ anderes Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT is(
    (SELECT count(*) FROM public.absences)::int,
    0,
    'Ein einfaches Mitglied sieht fremde Abwesenheiten gar nicht'
);

-- ============================================================ Selbstlöschung
SELECT lives_ok(
    $$ SELECT public.rpc_delete_my_account() $$,
    'Ein Mitglied darf sein Konto löschen'
);

SELECT isnt(
    (SELECT deleted_at FROM public.profiles WHERE id = '22222222-1111-0000-0000-000000000003'),
    NULL,
    'Das Konto ist danach als gelöscht markiert'
);

SELECT throws_ok(
    $$ UPDATE public.profiles SET deleted_at = NULL WHERE id = auth.uid() $$,
    '42501',
    NULL,
    'Ein gelöschtes Konto kann sich nicht selbst wiederbeleben'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_delete_my_account() $$,
    '42501',
    NULL,
    'Der letzte Administrator darf sich nicht selbst aussperren'
);

SELECT * FROM finish();
ROLLBACK;
