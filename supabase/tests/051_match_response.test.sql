-- Rückmeldung, Spielerverwaltung und die Automatik der Aufstellung.

BEGIN;
SELECT plan(26);

-- Spiel 1: 1. Herren (4er), Kader = Tina (Rang 1.1), Meik (1.2), Anna (1.3),
-- Mara (1.4) als Stamm; Theo (Ersatzrang 1) und Olaf (Ersatzrang 2) als Ersatz.
-- Meik führt die Mannschaft.

-- ============================================================ eigene Rückmeldung
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT lives_ok(
    $$ SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes', 'Bin dabei') $$,
    'Ein Spieler sagt für sich selbst zu'
);

SELECT is(
    (SELECT response::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    'yes',
    'Die Zusage steht in der Beteiligung'
);

SELECT is(
    (SELECT version_responded FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    1,
    'zusammen mit der Fassung des Termins, für die sie gilt'
);

SELECT is(
    (SELECT source::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    'self',
    'und dem Vermerk, dass sie von der Person selbst kommt'
);

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    1,
    'Die einzige Zusage steht auf Position 1'
);

-- Das Prüfprotokoll liest nur, wer die Mannschaft führt.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT is(
    (SELECT count(*) FROM public.match_changes
      WHERE match_id = '55555555-0000-0000-0000-000000000001' AND change_type = 'response')::int,
    1,
    'Die Änderung steht im Prüfprotokoll'
);

-- ============================================================ Reihenfolge der Automatik
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000006'); END $$;
DO $$ BEGIN PERFORM public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes'); END $$;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$ BEGIN PERFORM public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes'); END $$;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;
DO $$ BEGIN PERFORM public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes'); END $$;

SELECT is(
    (SELECT string_agg(p.first_name, ',' ORDER BY mp.lineup_position)
       FROM public.match_participations mp
       JOIN public.profiles p ON p.id = mp.profile_id
      WHERE mp.match_id = '55555555-0000-0000-0000-000000000001'
        AND mp.lineup_position IS NOT NULL),
    'Tina,Meik,Anna,Mara',
    'Die Stammspieler stehen in der Reihenfolge ihrer Ränge, nicht in der ihrer Zusage'
);

-- Ein Ersatzspieler sagt zu: er reiht sich hinter den Stammspielern ein.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000004'); END $$;
DO $$ BEGIN PERFORM public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes'); END $$;

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000004'),
    5,
    'Der Ersatzspieler landet auf Position 5 — der Ersatzbank'
);

-- Absage eines Stammspielers: alle rücken auf.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$ BEGIN PERFORM public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'no'); END $$;

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000005'),
    NULL,
    'Wer absagt, verliert seinen Platz'
);

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000004'),
    4,
    'und der Ersatzspieler rückt in die Aufstellung nach'
);

-- ============================================================ Spielerverwaltung
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000007'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                       '22222222-0000-0000-0000-000000000005', 'add') $$,
    '42501',
    NULL,
    'Der Mannschaftsführer einer fremden Mannschaft verwaltet hier niemanden'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                       '22222222-0000-0000-0000-000000000005', 'add') $$,
    '42501',
    NULL,
    'Ein einfaches Mitglied erst recht nicht'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                       '22222222-0000-0000-0000-000000000005', 'fliegen') $$,
    '22023',
    NULL,
    'Eine erfundene Aktion wird abgewiesen'
);

-- „Vorerst entfernt": Tina bleibt zugesagt, steht aber nicht mehr in der Aufstellung.
DO $$ BEGIN PERFORM public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                             '22222222-0000-0000-0000-000000000003', 'remove'); END $$;

SELECT is(
    (SELECT removed FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    true,
    'Der Mannschaftsführer nimmt einen Spieler vorerst heraus'
);

SELECT is(
    (SELECT response::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    'yes',
    'Die Zusage der Person bleibt dabei bestehen'
);

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    NULL,
    'aber die Aufstellung kennt sie nicht mehr'
);

-- Zurücksetzen macht alles rückgängig.
DO $$ BEGIN PERFORM public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                             '22222222-0000-0000-0000-000000000003', 'reset'); END $$;

SELECT is(
    (SELECT response::text || '/' || removed::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    'none/false',
    'Zurücksetzen stellt den Ausgangszustand her'
);

-- Jemanden hinzufügen, der gar nicht im Kader steht.
DO $$ BEGIN PERFORM public.rpc_manage_player('55555555-0000-0000-0000-000000000001',
                                             '22222222-1111-0000-0000-000000000007', 'add'); END $$;

SELECT is(
    (SELECT response::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-1111-0000-0000-000000000007'),
    'yes',
    'Der Mannschaftsführer holt jemanden von außerhalb des Kaders dazu'
);

-- ============================================================ Aufstellung von Hand
DO $$ BEGIN PERFORM public.rpc_set_lineup(
    '55555555-0000-0000-0000-000000000001',
    jsonb_build_array(
        jsonb_build_object('profile_id', '22222222-0000-0000-0000-000000000001', 'position', 1),
        jsonb_build_object('profile_id', '22222222-0000-0000-0000-000000000006', 'position', 2)
    )
); END $$;

SELECT is(
    (SELECT lineup_locked FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000001'),
    true,
    'Eine von Hand gesetzte Aufstellung sperrt die Automatik'
);

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000001'),
    1,
    'und steht so, wie sie gesetzt wurde'
);

-- Ab jetzt ändert eine neue Zusage nichts mehr an den Positionen.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;
DO $$ BEGIN PERFORM public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes'); END $$;

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000002'),
    NULL,
    'Eine gesperrte Aufstellung fasst die Automatik nicht mehr an'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;
DO $$ BEGIN PERFORM public.rpc_unlock_lineup('55555555-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000002'),
    4,
    'Nach dem Entsperren rechnet sie wieder — Olaf steht als zweiter Ersatz auf Position 4'
);

-- ============================================================ Meldeschluss
DO $$
BEGIN
    PERFORM tests.as_service_role();
    UPDATE public.teams SET block_participants_after = CURRENT_DATE - 1
     WHERE id = '44444444-0000-0000-0000-000000000001';
END $$;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_set_match_response('55555555-0000-0000-0000-000000000001', 'yes') $$,
    '42501',
    NULL,
    'Nach dem Meldeschluss der Mannschaft geht keine Rückmeldung mehr'
);

-- ============================================================ Sicht auf den Stand
DO $$
BEGIN
    PERFORM tests.as_service_role();
    UPDATE public.teams SET block_participants_after = NULL
     WHERE id = '44444444-0000-0000-0000-000000000001';
    INSERT INTO public.absences (profile_id, start_date, end_date)
    SELECT '22222222-1111-0000-0000-000000000001',
           (dtstart AT TIME ZONE 'Europe/Berlin')::date - 1,
           (dtstart AT TIME ZONE 'Europe/Berlin')::date + 1
      FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000003';
END $$;

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000006'); END $$;

SELECT is(
    (SELECT status FROM public.v_match_lineup_status
      WHERE match_id = '55555555-0000-0000-0000-000000000003'
        AND profile_id = '22222222-1111-0000-0000-000000000001'),
    'absent',
    'Wer im Urlaub ist, erscheint im Dialog als abwesend'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT is(
    (SELECT status FROM public.v_match_lineup_status
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000005'),
    'declined',
    'Wer abgesagt hat, steht unter den Absagen'
);

SELECT is(
    (SELECT status FROM public.v_match_lineup_status
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000006'),
    'lineup',
    'und wer aufgestellt ist, in der Aufstellung'
);

SELECT * FROM finish();
ROLLBACK;
