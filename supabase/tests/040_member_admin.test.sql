-- Mitgliederverwaltung: Freischalten, QTTR-Massenpflege, Rangdaten, Löschen.

BEGIN;
SELECT plan(19);

-- Anna ist Admin, Meik Mannschaftsführer, Petra wartet auf Freischaltung.

-- ============================================================ Freischalten
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_activate_member('22222222-0000-0000-0000-000000000009') $$,
    '42501',
    NULL,
    'Ein Mannschaftsführer kann niemanden freischalten'
);

SELECT is(
    (SELECT status::text FROM public.profiles WHERE id = '22222222-0000-0000-0000-000000000009'),
    'pending_approval',
    'Der Status bleibt dabei unverändert'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_activate_member('22222222-0000-0000-0000-000000000009') $$,
    'Der Admin schaltet frei'
);

SELECT is(
    (SELECT status::text FROM public.profiles WHERE id = '22222222-0000-0000-0000-000000000009'),
    'active',
    'Danach ist das Mitglied aktiv'
);

SELECT lives_ok(
    $$ SELECT public.rpc_activate_member('22222222-0000-0000-0000-000000000009') $$,
    'Zweimal freischalten ist kein Fehler'
);

SELECT throws_ok(
    $$ SELECT public.rpc_activate_member('99999999-9999-9999-9999-999999999999') $$,
    'P0002',
    NULL,
    'Ein unbekanntes Mitglied wird abgewiesen'
);

-- ============================================================ QTTR in Massen
SELECT is(
    public.rpc_update_qttr_bulk(
        jsonb_build_array(
            jsonb_build_object('id', '22222222-0000-0000-0000-000000000005', 'qttr', 1700),
            jsonb_build_object('id', '22222222-0000-0000-0000-000000000006', 'qttr', 1600),
            jsonb_build_object('id', '99999999-9999-9999-9999-999999999999', 'qttr', 1000)
        )
    ),
    2,
    'Zwei von drei Zeilen treffen ein Mitglied, die unbekannte wird übergangen'
);

SELECT is(
    (SELECT qttr FROM public.profiles WHERE id = '22222222-0000-0000-0000-000000000005'),
    1700,
    'Der neue QTTR-Wert steht am Mitglied'
);

SELECT is(
    public.rpc_update_qttr_bulk(
        jsonb_build_array(
            jsonb_build_object('id', '22222222-0000-0000-0000-000000000005', 'qttr', NULL)
        )
    ),
    1,
    'Ein leerer Wert wird angenommen'
);

SELECT is(
    (SELECT qttr FROM public.profiles WHERE id = '22222222-0000-0000-0000-000000000005'),
    NULL,
    'und löscht den QTTR-Wert'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_update_qttr_bulk('[]'::jsonb) $$,
    '42501',
    NULL,
    'Ohne Adminrechte keine QTTR-Massenpflege'
);

-- ============================================================ Anlegen und Ändern
SELECT throws_ok(
    $$ INSERT INTO public.profiles (first_name, last_name, email)
       VALUES ('Neues', 'Mitglied', 'neu@example.com') $$,
    '42501',
    NULL,
    'Ein Mannschaftsführer legt keine Mitglieder an'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.profiles (id, first_name, last_name, email, role)
       VALUES ('55555555-0000-0000-0000-000000000001', 'Neues', 'Mitglied',
               'neu@example.com', 'member') $$,
    'Der Admin legt ein Mitglied ohne Anmeldung an'
);

SELECT is(
    (SELECT status::text FROM public.profiles WHERE id = '55555555-0000-0000-0000-000000000001'),
    'unconfirmed',
    'Ein so angelegtes Mitglied gilt als unbestätigt'
);

SELECT lives_ok(
    $$ INSERT INTO public.member_rankings (profile_id, ranking_type, team_number, position_number)
       VALUES ('55555555-0000-0000-0000-000000000001', 'men', 3, 4) $$,
    'Der Admin pflegt Rangdaten'
);

SELECT throws_ok(
    $$ INSERT INTO public.member_rankings (profile_id, ranking_type, team_number, position_number)
       VALUES ('55555555-0000-0000-0000-000000000001', 'women', 0, 1) $$,
    '23514',
    NULL,
    'Mannschaft 0 gibt es nicht'
);

-- Löschen ist ein Soft-Delete: die Zeile bleibt, verschwindet aber aus den Listen.
SELECT lives_ok(
    $$ UPDATE public.profiles SET deleted_at = NOW()
       WHERE id = '55555555-0000-0000-0000-000000000001' $$,
    'Der Admin löscht ein Mitglied'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.profiles
      WHERE id = '55555555-0000-0000-0000-000000000001')::int,
    0,
    'Ein gelöschtes Mitglied taucht für andere nicht mehr auf'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.profiles
      WHERE id = '55555555-0000-0000-0000-000000000001')::int,
    1,
    'Der Admin sieht es weiterhin — sonst könnte er es nie wiederherstellen'
);

SELECT * FROM finish();
ROLLBACK;
