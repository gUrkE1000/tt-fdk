-- Schlüsselverwaltung: wer darf weitergeben, und was steht an der Trainingskarte?

BEGIN;
SELECT plan(18);

-- ============================================================ Sichtbarkeit
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.keys)::int,
    2,
    'Jedes Mitglied sieht die Schlüssel des Vereins'
);

SELECT is(
    (SELECT holder_name FROM public.v_keys
      WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'),
    'Spieler 01',
    'mit dem Namen des aktuellen Inhabers'
);

-- Auch ein Gast: Er sieht offene Trainings, also auch, ob sie aufgeschlossen werden.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is(
    (SELECT count(*) FROM public.keys)::int,
    2,
    'Ein Gast auch — ein Schlüssel ist Vereinsinfrastruktur'
);

SELECT throws_ok(
    $$ INSERT INTO public.keys (name, responsible_id)
       VALUES ('Nachschlüssel', '22222222-0000-0000-0000-000000000001') $$,
    '42501',
    NULL,
    'Anlegen darf nur der Administrator'
);

-- ============================================================ Weitergabe
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT public.may_hand_over_key('bbbbbbbb-0000-0000-0000-000000000001')),
    true,
    'Der aktuelle Inhaber darf weitergeben'
);

SELECT is(
    (SELECT public.may_hand_over_key('bbbbbbbb-0000-0000-0000-000000000002')),
    false,
    'Wer einen Schlüssel nicht hat, gibt ihn auch nicht weiter'
);

SELECT is(
    (SELECT public.rpc_hand_over_key(
        'bbbbbbbb-0000-0000-0000-000000000001',
        '22222222-1111-0000-0000-000000000002') ->> 'status'),
    'ok',
    'Die Übergabe geht durch'
);

SELECT is(
    (SELECT holder_id FROM public.keys WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'),
    '22222222-1111-0000-0000-000000000002'::uuid,
    'und der Schlüssel liegt danach beim neuen Inhaber'
);

-- Das Protokoll ist der Grund, warum sich später nachvollziehen lässt, wo er hinkam.
SELECT is(
    (SELECT count(*) FROM public.key_handovers
      WHERE key_id = 'bbbbbbbb-0000-0000-0000-000000000001'
        AND from_profile_id = '22222222-1111-0000-0000-000000000001'
        AND to_profile_id   = '22222222-1111-0000-0000-000000000002')::int,
    1,
    'Die Übergabe steht im Protokoll'
);

-- Und der alte Inhaber kann ihn nicht mehr weiterreichen.
SELECT is(
    (SELECT public.rpc_hand_over_key(
        'bbbbbbbb-0000-0000-0000-000000000001',
        '22222222-1111-0000-0000-000000000003') ->> 'status'),
    'not_allowed',
    'Wer ihn abgegeben hat, gibt ihn nicht noch einmal weiter'
);

-- ============================================================ Keine Weitergabe
DO $$
BEGIN
    PERFORM tests.as_service_role();
    UPDATE public.keys
       SET holder_id = '22222222-1111-0000-0000-000000000001'
     WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
    PERFORM tests.login_as('22222222-1111-0000-0000-000000000001');
END $$;

SELECT is(
    (SELECT public.may_hand_over_key('bbbbbbbb-0000-0000-0000-000000000002')),
    false,
    'Bei „keine Weitergabe" darf auch der Inhaber nicht weitergeben'
);

SELECT is(
    (SELECT public.rpc_hand_over_key(
        'bbbbbbbb-0000-0000-0000-000000000002',
        '22222222-1111-0000-0000-000000000002') ->> 'status'),
    'not_allowed',
    'die RPC lehnt entsprechend ab'
);

-- Der Verantwortliche darf trotzdem — sonst wäre ein Schlüssel bei einem
-- ausgetretenen Mitglied für immer verloren.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT public.rpc_hand_over_key(
        'bbbbbbbb-0000-0000-0000-000000000002',
        NULL) ->> 'status'),
    'ok',
    'Der Verantwortliche holt ihn zurück'
);

SELECT is(
    (SELECT holder_id FROM public.keys WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'),
    NULL,
    'und danach hat ihn niemand'
);

SELECT is(
    (SELECT public.rpc_hand_over_key(
        'bbbbbbbb-0000-0000-0000-000000000002',
        NULL) ->> 'status'),
    'unchanged',
    'Dieselbe Übergabe zweimal erzeugt keinen zweiten Protokolleintrag'
);

SELECT is(
    (SELECT public.rpc_hand_over_key(
        'bbbbbbbb-0000-0000-0000-000000000002',
        '22222222-0000-0000-0000-000000000009') ->> 'status'),
    'unknown_member',
    'An ein unbekanntes Mitglied geht gar nichts'
);

-- ============================================================ Trainingskarte
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000002'); END $$;

-- Spieler 02 hat den Hallenschlüssel (siehe Übergabe oben) und ist mit „late"
-- zum ersten Termin gemeldet — das zählt als anwesend.
SELECT is(
    (SELECT has_key_holder FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000001'),
    true,
    'Die Trainingskarte weiß, dass jemand mit Schlüssel kommt'
);

SELECT is(
    (SELECT has_key_holder FROM public.v_session_keys
      WHERE session_id = '77777777-0000-0000-0000-000000000002'),
    false,
    'und beim nächsten Termin, dass niemand kommt'
);

SELECT * FROM finish();
ROLLBACK;
