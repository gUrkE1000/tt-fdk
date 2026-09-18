-- Ämter: wer sie sieht und wer sie pflegt (Aufgabe 9.6)

BEGIN;
SELECT plan(6);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT count(*) FROM public.club_roles)::int,
    2,
    'Jedes Mitglied sieht die Ämter des Vereins'
);

SELECT is(
    (SELECT full_name FROM public.v_club_role_members
      WHERE role_id = 'cccccccc-0000-0000-0000-000000000002'),
    'Anna Admin',
    'und wer sie innehat'
);

-- Die Tätigkeiten stehen als Liste, nicht als Fließtext.
SELECT is(
    (SELECT array_length(duties, 1) FROM public.club_roles
      WHERE id = 'cccccccc-0000-0000-0000-000000000001'),
    3,
    'Die Tätigkeiten bleiben einzeln erhalten'
);

SELECT throws_ok(
    $$ INSERT INTO public.club_roles (name) VALUES ('Pressewart') $$,
    '42501',
    NULL,
    'Ein Amt anlegen darf nur der Administrator'
);

SELECT throws_ok(
    $$ INSERT INTO public.club_role_members (role_id, profile_id)
       VALUES ('cccccccc-0000-0000-0000-000000000002',
               '22222222-1111-0000-0000-000000000001') $$,
    '42501',
    NULL,
    'und sich selbst zum Kassier machen erst recht nicht'
);

-- Ein Amt gibt keine Rechte. Die Trainerin hat eins — Mannschaften sieht sie
-- deshalb trotzdem nicht anders als vorher.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000003'); END $$;

SELECT is(
    (SELECT public.current_member_role()::TEXT),
    'trainer',
    'Ein Amt ändert die Benutzerrolle nicht'
);

SELECT * FROM finish();
ROLLBACK;
