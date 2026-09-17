-- Prüft die Supabase-Kompatibilitätsschicht selbst (scripts/supabase-compat.sql).
--
-- Diese Tests laufen nur lokal und in der CI. Sie sichern ab, dass die Testumgebung sich
-- gegenüber unseren Migrationen so verhält wie Supabase — andernfalls wären alle folgenden
-- RLS-Tests wertlos, weil sie gegen eine falsche Nachbildung prüfen würden.

BEGIN;
SELECT plan(15);

-- ---------------------------------------------------------------- Rollen
SELECT has_role('anon',          'Rolle anon existiert');
SELECT has_role('authenticated', 'Rolle authenticated existiert');
SELECT has_role('service_role',  'Rolle service_role existiert');

SELECT ok(
    (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'),
    'service_role umgeht RLS, wie in Supabase'
);

SELECT ok(
    NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'authenticated'),
    'authenticated umgeht RLS nicht'
);

-- ---------------------------------------------------------------- Schema auth
SELECT has_schema('auth', 'Schema auth existiert');
SELECT has_table('auth', 'users', 'Tabelle auth.users existiert');
SELECT has_function('auth', 'uid', 'Funktion auth.uid() existiert');

-- ---------------------------------------------------------------- auth.uid()
SELECT is(auth.uid(), NULL, 'auth.uid() ist ohne Anmeldung NULL');

-- Hilfsaufrufe laufen in DO-Bloecken: ein blosses SELECT wuerde eine Ergebniszeile
-- erzeugen, die der TAP-Parser als zusaetzlichen Test zaehlt.
DO $$
BEGIN
    PERFORM tests.create_auth_user(
        '00000000-0000-0000-0000-0000000000a1',
        'compat-test@example.com'
    );
    PERFORM tests.login_as('00000000-0000-0000-0000-0000000000a1');
END $$;

SELECT is(
    auth.uid(),
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    'auth.uid() liefert nach login_as die Benutzer-ID'
);

SELECT is(auth.role(), 'authenticated', 'auth.role() ist nach login_as authenticated');
SELECT is(auth.email(), 'compat-test@example.com', 'auth.email() liefert die E-Mail');

SELECT is(
    current_setting('role'),
    'authenticated',
    'login_as wechselt in die Datenbankrolle authenticated'
);

-- ---------------------------------------------------------------- logout
DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(auth.uid(), NULL, 'auth.uid() ist nach logout wieder NULL');
SELECT is(current_setting('role'), 'anon', 'logout wechselt in die Rolle anon');

SELECT * FROM finish();
ROLLBACK;
