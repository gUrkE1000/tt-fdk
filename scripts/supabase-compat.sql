-- Supabase-Kompatibilitätsschicht für eine native PostgreSQL-Instanz.
--
-- Zweck: Migrationen, RLS-Policies, Trigger und RPCs lokal und in der CI testen zu können,
-- ohne eine vollständige Supabase-Instanz (Docker) zu betreiben. Bildet genau die Teile nach,
-- auf die unsere Migrationen zugreifen:
--   * die Rollen anon / authenticated / service_role
--   * das Schema auth mit auth.users und auth.uid() / auth.role() / auth.email()
--   * die Extensions, die Supabase vorinstalliert hat
--   * Testhilfen zum Rollenwechsel (Schema tests)
--
-- Diese Datei ist KEINE Migration. Sie läuft nur lokal und in der CI, nie gegen das
-- Supabase-Projekt — dort existiert all das bereits.

-- ---------------------------------------------------------------- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgtap;

-- ---------------------------------------------------------------- Rollen
-- In Supabase existieren diese Rollen bereits. service_role umgeht RLS, genau wie dort.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ---------------------------------------------------------------- Schema auth
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Nur die Spalten, die unsere Migrationen tatsächlich lesen.
CREATE TABLE IF NOT EXISTS auth.users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE,
    encrypted_password  TEXT,
    raw_user_meta_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auth.uid() liest die Claim "sub" aus der per set_config gesetzten JWT-Claim-Struktur.
-- Genau so verhält sich Supabase: PostgREST setzt request.jwt.claims je Anfrage.
-- Der Cast nach json ist bewusst gegen den leeren String abgesichert: ist keine Sitzung
-- gesetzt, liefert current_setting je nach Situation NULL oder '' — beides muss NULL ergeben.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
    );
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(NULLIF(auth.jwt() ->> 'role', ''), 'anon');
$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(auth.jwt() ->> 'email', '');
$$;

GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role(), auth.email()
    TO anon, authenticated, service_role;

-- ---------------------------------------------------------------- Testhilfen
CREATE SCHEMA IF NOT EXISTS tests;

-- E-Mail zu einer Benutzer-ID. Eigene Funktion mit SECURITY DEFINER, damit login_as
-- selbst im Invoker-Kontext bleiben kann: ein Rollenwechsel per set_config wirkt nur
-- dann über das Funktionsende hinaus.
CREATE OR REPLACE FUNCTION tests._email_of(p_user UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT email FROM auth.users WHERE id = p_user;
$$;

-- Meldet die laufende Transaktion als dieser Benutzer an: setzt die JWT-Claims und
-- wechselt in die Rolle authenticated. Wirkt nur bis zum Ende der Transaktion.
CREATE OR REPLACE FUNCTION tests.login_as(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_email TEXT;
BEGIN
    v_email := tests._email_of(p_user);

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object('sub', p_user::text, 'role', 'authenticated', 'email', v_email)::text,
        true
    );
    PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- Meldet ab: anonymer Zugriff, keine Claims.
CREATE OR REPLACE FUNCTION tests.logout()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'anon', true);
END;
$$;

-- Zurück zur Sicht der Edge Functions (umgeht RLS).
CREATE OR REPLACE FUNCTION tests.as_service_role()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('role', 'service_role', true);
END;
$$;

-- Legt einen Auth-Benutzer als reine Testvorrichtung an, OHNE den Trigger
-- on_auth_user_created auszulösen. Für Fälle, in denen das Profil schon existiert
-- oder gar nicht gebraucht wird.
CREATE OR REPLACE FUNCTION tests.create_auth_user(
    p_id    UUID,
    p_email TEXT,
    p_meta  JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- session_replication_role = replica schaltet Trigger transaktionslokal ab;
    -- sauberer als ALTER TABLE, das eine exklusive Sperre nähme.
    PERFORM set_config('session_replication_role', 'replica', true);
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (p_id, p_email, p_meta);
    PERFORM set_config('session_replication_role', 'origin', true);
    RETURN p_id;
END;
$$;

-- Registriert einen Benutzer auf dem echten Weg: der Trigger on_auth_user_created
-- läuft mit. Damit lässt sich prüfen, ob Verknüpfung und Codeprüfung greifen.
CREATE OR REPLACE FUNCTION tests.signup(
    p_email TEXT,
    p_meta  JSONB DEFAULT '{}'::jsonb,
    p_id    UUID DEFAULT gen_random_uuid()
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (p_id, p_email, p_meta);
    RETURN p_id;
END;
$$;

GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO anon, authenticated, service_role;
