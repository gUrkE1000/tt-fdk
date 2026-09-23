-- handle_new_user(): wie aus einem Auth-Benutzer ein Vereinsmitglied wird (Zielbild 4.5).
--
-- Drei Wege sind zu unterscheiden:
--   a) eingeladen/angelegt — vorhandenes Profil wird übernommen,
--   b) Selbstregistrierung mit gültigem Vereinscode — neues Profil, wartet auf Freischaltung,
--   c) alles andere — abgelehnt.
--
-- Der Test läuft als Superuser, damit die Vorbereitung nicht an RLS scheitert.

BEGIN;
SELECT plan(15);

-- Uwe ist im Seed als 'unconfirmed' angelegt und noch nicht verknüpft.
-- Rang und Gruppenmitgliedschaft hängen an seiner alten ID: beides muss die
-- Verknüpfung überleben (ON UPDATE CASCADE).
INSERT INTO public.member_rankings (profile_id, ranking_type, team_number, position_number)
VALUES ('22222222-0000-0000-0000-00000000000a', 'men', 4, 1);

INSERT INTO public.group_members (group_id, profile_id)
VALUES ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-00000000000a');

SELECT is(
    (SELECT auth_linked_at FROM public.profiles WHERE id = '22222222-0000-0000-0000-00000000000a'),
    NULL,
    'Vor der ersten Anmeldung ist das Profil nicht verknüpft'
);

-- ============================================================ a) Ohne Nachweis
-- Wer die Adresse eines angelegten Mitglieds kennt, darf dessen Profil nicht per
-- Registrierung übernehmen — auch nicht mit gültigem Vereinscode. Sonst bände er das
-- Profil an ein Konto, dessen Passwort er kennt (Code-Review K-2).
SELECT throws_ok(
    $$ SELECT tests.signup('uwe.unconfirmed@example.com',
                           '{"registration_code":"TESTCODE"}'::jsonb) $$,
    '42501',
    NULL,
    'Eine vorhandene Adresse wird ohne Einladung nicht übernommen'
);

SELECT is(
    (SELECT auth_linked_at FROM public.profiles WHERE id = '22222222-0000-0000-0000-00000000000a'),
    NULL,
    'Das Profil bleibt nach dem Versuch unverknüpft'
);

-- ============================================================ a) Eingeladen
DO $$
BEGIN
    PERFORM tests.signup(
        'uwe.unconfirmed@example.com',
        '{"first_name":"Uwe","last_name":"Uneingeladen"}'::jsonb,
        '99999999-0000-0000-0000-000000000001',
        p_invited := true
    );
END $$;

SELECT is(
    (SELECT email FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000001'),
    'uwe.unconfirmed@example.com',
    'Das vorhandene Profil trägt jetzt die ID des Auth-Benutzers'
);

SELECT is(
    (SELECT status FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000001'),
    'active'::public.member_status,
    'Aus eingeladen wird mit der ersten Anmeldung aktiv'
);

SELECT isnt(
    (SELECT auth_linked_at FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000001'),
    NULL,
    'Der Zeitpunkt der Verknüpfung ist festgehalten'
);

SELECT is(
    (SELECT count(*) FROM public.profiles WHERE id = '22222222-0000-0000-0000-00000000000a')::int,
    0,
    'Es entsteht kein zweites Profil — die alte ID ist verschwunden'
);

SELECT is(
    (SELECT count(*) FROM public.profiles WHERE LOWER(email) = 'uwe.unconfirmed@example.com')::int,
    1,
    'Die E-Mail kommt weiterhin genau einmal vor'
);

SELECT is(
    (SELECT team_number FROM public.member_rankings
      WHERE profile_id = '99999999-0000-0000-0000-000000000001' AND ranking_type = 'men'),
    4,
    'Der Rang ist auf die neue ID mitgewandert'
);

SELECT is(
    (SELECT count(*) FROM public.group_members
      WHERE profile_id = '99999999-0000-0000-0000-000000000001')::int,
    1,
    'Die Gruppenmitgliedschaft ist auf die neue ID mitgewandert'
);

-- ============================================================ c) Abgelehnt
SELECT throws_ok(
    $$ SELECT tests.signup('fremder@example.com', '{}'::jsonb) $$,
    '42501',
    NULL,
    'Eine unbekannte E-Mail ohne Vereinscode bekommt kein Konto'
);

SELECT throws_ok(
    $$ SELECT tests.signup('fremder@example.com', '{"registration_code":"FALSCH"}'::jsonb) $$,
    '42501',
    NULL,
    'Ein falscher Vereinscode bekommt kein Konto'
);

-- ============================================================ b) Selbstregistrierung
DO $$
BEGIN
    PERFORM tests.signup(
        'neu@example.com',
        '{"first_name":"Nina","last_name":"Neu","registration_code":"TESTCODE"}'::jsonb,
        '99999999-0000-0000-0000-000000000002'
    );
END $$;

SELECT is(
    (SELECT status FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000002'),
    'pending_approval'::public.member_status,
    'Mit gültigem Code entsteht ein Profil, das auf Freischaltung wartet'
);

SELECT is(
    (SELECT role FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000002'),
    'member'::public.user_role,
    'Selbstregistrierte bekommen die Rolle Mitglied, nichts Höheres'
);

SELECT is(
    (SELECT full_name FROM public.profiles WHERE id = '99999999-0000-0000-0000-000000000002'),
    'Nina Neu',
    'Vor- und Nachname stammen aus den Registrierungsdaten'
);

SELECT * FROM finish();
ROLLBACK;
