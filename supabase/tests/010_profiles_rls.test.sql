-- RLS und Spaltenschutz auf public.profiles (Zielbild 5).
--
-- Jede Policy braucht einen positiven und einen negativen Fall — eine Policy, die nur
-- positiv geprüft ist, ist nicht geprüft.

BEGIN;
SELECT plan(22);

-- Feste IDs aus supabase/seed.sql
-- admin   22222222-0000-0000-0000-000000000001  Anna Admin
-- trainer 22222222-0000-0000-0000-000000000003  Tina Trainerin
-- leader  22222222-0000-0000-0000-000000000005  Meik Mannschaft
-- guest   22222222-0000-0000-0000-000000000008  Gustav Gast
-- member  22222222-1111-0000-0000-000000000001  Spieler 01

-- ============================================================ anonym
DO $$ BEGIN PERFORM tests.logout(); END $$;

-- anon hat seit der Rechte-Migration gar kein Tabellenrecht mehr — nicht nur
-- keine Zeilen, sondern keinen Zugriff.
SELECT throws_ok(
    $$ SELECT count(*) FROM public.profiles $$,
    '42501',
    NULL,
    'Anonym ist kein einziges Profil sichtbar'
);

SELECT throws_ok(
    $$ SELECT count(*) FROM public.venues $$,
    '42501',
    NULL,
    'Anonym ist kein Ort sichtbar'
);

SELECT ok(
    (SELECT club_name FROM public.get_public_club_info()) = 'TTC Musterstadt',
    'Der Vereinsname ist auch ohne Anmeldung lesbar (für den Anmeldebildschirm)'
);

SELECT ok(
    public.rpc_validate_registration_code('TESTCODE'),
    'Der gültige Registrierungscode wird anonym bestätigt'
);

SELECT ok(
    NOT public.rpc_validate_registration_code('FALSCH'),
    'Ein falscher Registrierungscode wird abgelehnt'
);

-- ============================================================ Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT cmp_ok(
    (SELECT count(*) FROM public.profiles)::int, '>', 20,
    'Ein aktives Mitglied sieht den ganzen Verein'
);

SELECT lives_ok(
    $$ UPDATE public.profiles SET first_name = 'Umbenannt' WHERE id = auth.uid() $$,
    'Ein Mitglied darf seinen eigenen Namen ändern'
);

SELECT throws_ok(
    $$ UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid() $$,
    '42501',
    NULL,
    'Ein Mitglied darf sich nicht selbst zum Admin machen'
);

-- Bewusst ein anderer Wert als der aktuelle: der Trigger vergleicht alt gegen neu,
-- ein Update auf denselben Wert ist keine Aenderung.
SELECT throws_ok(
    $$ UPDATE public.profiles SET status = 'unconfirmed' WHERE id = auth.uid() $$,
    '42501',
    NULL,
    'Ein Mitglied darf seinen Status nicht ändern'
);

SELECT throws_ok(
    $$ UPDATE public.profiles SET qttr = 2000 WHERE id = auth.uid() $$,
    '42501',
    NULL,
    'Ein Mitglied darf seine QTTR-Punkte nicht ändern'
);

SELECT lives_ok(
    $$ UPDATE public.profiles SET first_name = 'Geaendert'
        WHERE id = '22222222-0000-0000-0000-000000000001' $$,
    'Ein Update auf ein fremdes Profil läuft ins Leere, statt zu scheitern (RLS filtert die Zeile weg)'
);

SELECT is(
    (SELECT first_name FROM public.profiles WHERE id = '22222222-0000-0000-0000-000000000001'),
    'Anna',
    'Das fremde Profil ist tatsächlich unverändert geblieben'
);

SELECT throws_ok(
    $$ INSERT INTO public.venues (name, city) VALUES ('Fremde Halle', 'Musterstadt') $$,
    '42501',
    NULL,
    'Ein Mitglied darf keinen Ort anlegen'
);

SELECT throws_ok(
    $$ INSERT INTO public.groups (name) VALUES ('Heimliche Gruppe') $$,
    '42501',
    NULL,
    'Ein Mitglied darf keine Gruppe anlegen'
);

-- Kontaktdaten: Spieler 02 hat contact_visible = false (Default)
SELECT is(
    (SELECT email FROM public.v_members_directory
      WHERE id = '22222222-1111-0000-0000-000000000002'),
    NULL,
    'Ohne Freigabe bleibt die E-Mail im Verzeichnis verborgen'
);

SELECT isnt(
    (SELECT email FROM public.v_members_directory WHERE id = auth.uid()),
    NULL,
    'Die eigene E-Mail ist im Verzeichnis immer sichtbar'
);

-- ============================================================ Wartender Zugang
-- Der eigentlich interessante Fall: jemand hat sich per Code registriert und
-- versucht, sich selbst freizuschalten.
DO $$
BEGIN
    PERFORM tests.create_auth_user(
        '22222222-0000-0000-0000-000000000009',
        'petra.pending@example.com'
    );
    PERFORM tests.login_as('22222222-0000-0000-0000-000000000009');
END $$;

SELECT is(
    (SELECT count(*) FROM public.profiles)::int,
    1,
    'Wer auf Freischaltung wartet, sieht nur das eigene Profil'
);

SELECT throws_ok(
    $$ UPDATE public.profiles SET status = 'active' WHERE id = auth.uid() $$,
    '42501',
    NULL,
    'Wer auf Freischaltung wartet, kann sich nicht selbst freischalten'
);

-- ============================================================ Gast
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT ok(
    (SELECT count(*) FROM public.profiles WHERE role = 'member')::int = 0,
    'Ein Gast sieht die Mitgliederliste nicht'
);

SELECT cmp_ok(
    (SELECT count(*) FROM public.profiles WHERE role IN ('admin', 'trainer'))::int, '>', 0,
    'Ein Gast sieht die Ansprechpartner (Admin und Trainer)'
);

-- ============================================================ Admin
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ UPDATE public.profiles SET role = 'team_leader'
        WHERE id = '22222222-1111-0000-0000-000000000003' $$,
    'Der Admin darf Rollen vergeben'
);

SELECT isnt(
    (SELECT email FROM public.v_members_directory
      WHERE id = '22222222-1111-0000-0000-000000000002'),
    NULL,
    'Der Admin sieht Kontaktdaten auch ohne Freigabe'
);

SELECT * FROM finish();
ROLLBACK;
