-- ============================================================================
-- Vereinsplaner — Schema-Baseline v2
--
-- Umfang dieser Migration: Verein, Mitglieder, Ränge, Gruppen, Orte, Rechte.
-- Mannschaften und Spiele folgen in Aufgabe 3.1, Benachrichtigungen in 4.1,
-- Training in 6.1.
--
-- Grundlagen: docs/zielbild.md Abschnitt 3.1, 3.8 und 5.
--
-- Konventionen:
--   * Enum-Werte und Bezeichner englisch, Oberflächentexte deutsch (src/lib/labels.ts).
--   * Alle Tabellen mit RLS; Policies stehen direkt bei der Tabelle.
--   * Idempotent: die Datei darf mehrfach laufen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Aufzählungstypen
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'admin',        -- Vereinsadministrator
            'team_leader',  -- Mannschaftsführer
            'trainer',      -- Trainer
            'organizer',    -- Organisator: Vereinstermine, Umfragen, Neuigkeiten
            'member',       -- Mitglied
            'guest'         -- Gast: sieht nur offene Trainings und Vereinstermine
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
        CREATE TYPE public.member_status AS ENUM (
            'active',
            'pending_approval',  -- hat sich per Code registriert, wartet auf Freischaltung
            'unconfirmed'        -- angelegt oder eingeladen, noch nie angemeldet
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
        CREATE TYPE public.gender AS ENUM ('male', 'female', 'unspecified');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ranking_type') THEN
        -- Die 15 Rangtypen des TT-Planers (Bestandsaufnahme G).
        CREATE TYPE public.ranking_type AS ENUM (
            'men', 'women',
            'seniors_40', 'seniors_50', 'seniors_60', 'seniors_70', 'seniors_75',
            'youth_19', 'youth_15', 'youth_13', 'youth_11',
            'girls_19', 'girls_15', 'girls_13', 'girls_11'
        );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Schema private: Konfiguration, die nie über die API erreichbar sein darf
-- ----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- Wird ab Aufgabe 3.3 von den pg_cron-Jobs gelesen (Funktions-URL, Cron-Secret).
-- Liegt bewusst in `private`: PostgREST veröffentlicht nur `public`.
CREATE TABLE IF NOT EXISTS private.cron_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 3. Gemeinsame Hilfsfunktion: updated_at pflegen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Vereinseinstellungen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS club_settings_updated_at ON public.club_settings;
CREATE TRIGGER club_settings_updated_at
    BEFORE UPDATE ON public.club_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defaults nach Zielbild 3.8. ON CONFLICT DO NOTHING: bestehende Werte bleiben.
INSERT INTO public.club_settings (key, value) VALUES
    ('club_name',                 'Mein Tischtennisverein'),
    ('club_short_name',           'MTTV'),
    ('club_aliases',              ''),     -- kommagetrennt, für die Heim/Auswärts-Erkennung
    ('website_url',               ''),
    ('facebook_url',              ''),
    ('instagram_url',             ''),
    ('youtube_url',               ''),
    ('whatsapp_url',              ''),
    ('about_html',                ''),
    ('welcome_email_html',        ''),
    ('bundesland',                'NW'),   -- steuert Feiertage und Schulferien (Aufgabe 6.2)
    ('timezone',                  'Europe/Berlin'),
    ('app_url',                   ''),     -- Basis für Links in Benachrichtigungen
    ('open_reminder_days',        '14'),
    ('open_reminder_time',        '18:00'),
    ('event_reminder_hours',      '24'),
    ('notification_sender_name',  'Vereinsplaner'),
    ('notification_sender_email', ''),
    ('registration_code',         ''),     -- leer = Selbstregistrierung aus
    ('default_venue_id',          '')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Mitglieder
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    -- Bewusst KEIN Fremdschlüssel auf auth.users: der Admin legt Mitglieder an, lange
    -- bevor (und auch ohne dass) sie sich jemals anmelden. Beim ersten Login übernimmt
    -- handle_new_user() die id des Auth-Benutzers; alle Verweise hängen deshalb an
    -- ON UPDATE CASCADE.
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    first_name            TEXT NOT NULL DEFAULT '',
    last_name             TEXT NOT NULL DEFAULT '',
    full_name             TEXT GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,

    email                 TEXT,
    phone                 TEXT,
    mobile_phone          TEXT,
    gender                public.gender NOT NULL DEFAULT 'unspecified',
    birthday              DATE,
    member_number         TEXT,

    role                  public.user_role NOT NULL DEFAULT 'member',
    status                public.member_status NOT NULL DEFAULT 'unconfirmed',

    no_games              BOOLEAN NOT NULL DEFAULT false,  -- reiner Trainingsteilnehmer
    qttr                  INTEGER,

    -- Sichtbarkeit, die das Mitglied selbst steuert (Bestandsaufnahme G)
    contact_visible       BOOLEAN NOT NULL DEFAULT false,
    hide_birthday         BOOLEAN NOT NULL DEFAULT false,

    -- Benachrichtigungen (Zielbild 3.6); die Matrix folgt in Aufgabe 4.1
    emails_copies         TEXT[] NOT NULL DEFAULT '{}',    -- z. B. Eltern
    reminder_games_hours  INTEGER NOT NULL DEFAULT 24,

    auth_linked_at        TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ,     -- Soft-Delete, endgültig nach 30 Tagen

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT profiles_reminder_hours_check CHECK (reminder_games_hours BETWEEN 0 AND 336)
);

-- E-Mail ist optional (Mitglieder ohne E-Mail sind möglich), aber eindeutig.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
    ON public.profiles (LOWER(email)) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_full_name_idx ON public.profiles (full_name);
CREATE INDEX IF NOT EXISTS profiles_active_idx ON public.profiles (status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Ränge je Altersklasse
-- ----------------------------------------------------------------------------

-- Im TT-Planer steht am Mitglied je Altersklasse ein Rang wie "1.2" (Mannschaft 1,
-- Position 2). Hier als eigene Zeile je Typ, damit sich Mannschaft und Position
-- auswerten lassen statt in einem Textfeld zu stecken.
CREATE TABLE IF NOT EXISTS public.member_rankings (
    profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    ranking_type    public.ranking_type NOT NULL,
    team_number     INTEGER NOT NULL,
    position_number INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (profile_id, ranking_type),
    CONSTRAINT member_rankings_team_check CHECK (team_number BETWEEN 1 AND 99),
    CONSTRAINT member_rankings_position_check CHECK (position_number BETWEEN 1 AND 99)
);

DROP TRIGGER IF EXISTS member_rankings_updated_at ON public.member_rankings;
CREATE TRIGGER member_rankings_updated_at
    BEFORE UPDATE ON public.member_rankings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Gruppen
-- ----------------------------------------------------------------------------

-- Gruppen sind die Adressierungsdimension neben den Mannschaften: Trainings,
-- Umfragen und Statistik-Sichtbarkeit greifen darauf zu. Eine Gruppe hat, wie im
-- TT-Planer, nur einen Namen.
CREATE TABLE IF NOT EXISTS public.groups (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS groups_updated_at ON public.groups;
CREATE TRIGGER groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.group_members (
    group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, profile_id)
);

-- ----------------------------------------------------------------------------
-- 8. Orte
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.venues (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        TEXT NOT NULL,
    address                     TEXT NOT NULL DEFAULT '',
    postal_code                 TEXT,
    city                        TEXT NOT NULL DEFAULT '',
    -- "Maximale Anzahl gleichzeitiger Spieltermine" (Bestandsaufnahme F).
    -- NULL = nicht begrenzt. Eine Tischbelegung gibt es bewusst nicht.
    max_games                   INTEGER,
    allow_training_at_max_games BOOLEAN NOT NULL DEFAULT false,
    training_only               BOOLEAN NOT NULL DEFAULT false,
    active                      BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT venues_max_games_check CHECK (max_games IS NULL OR max_games > 0)
);

DROP TRIGGER IF EXISTS venues_updated_at ON public.venues;
CREATE TRIGGER venues_updated_at
    BEFORE UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. Rechte-Hilfsfunktionen
--
-- Alle SECURITY DEFINER und STABLE. Sie lesen profiles und werden von den
-- profiles-Policies benutzt — ohne DEFINER liefe das in eine Rekursion.
-- search_path ist fest gesetzt, damit die Funktionen nicht über einen
-- untergeschobenen Suchpfad umgelenkt werden können.
-- ----------------------------------------------------------------------------

-- Heißt bewusst nicht current_role(): das ist in SQL bereits ein Schlüsselwort
-- für die aktuelle Datenbankrolle.
CREATE OR REPLACE FUNCTION public.current_member_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.profiles
     WHERE id = auth.uid() AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid()
           AND deleted_at IS NULL
           AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid()
           AND deleted_at IS NULL
           AND status = 'active'
           AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_organizer_or_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid()
           AND deleted_at IS NULL
           AND status = 'active'
           AND role IN ('admin', 'organizer')
    );
$$;

-- ----------------------------------------------------------------------------
-- 10. Spaltenschutz auf profiles
--
-- RLS entscheidet über ganze Zeilen. Ein Mitglied darf seine eigene Zeile ändern —
-- aber nicht seine Rolle. Diese Unterscheidung geht nur über einen Trigger.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    -- Ohne angemeldeten Benutzer (Migrationen, Edge Functions mit service_role)
    -- greift der Schutz nicht.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.qttr IS DISTINCT FROM OLD.qttr
       OR NEW.member_number IS DISTINCT FROM OLD.member_number
       OR NEW.no_games IS DISTINCT FROM OLD.no_games
    THEN
        RAISE EXCEPTION
            'Rolle, Status, QTTR, Mitgliedsnummer und die Kennzeichnung als Mannschaftsspieler darf nur ein Administrator ändern.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_columns ON public.profiles;
CREATE TRIGGER profiles_protect_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ----------------------------------------------------------------------------
-- 11. Anmeldung: Profil mit Auth-Benutzer verknüpfen
--
-- Zwei Wege führen zu einem Konto (Zielbild 4.5):
--   a) Der Verein hat das Mitglied angelegt oder eingeladen — dann existiert bereits
--      ein Profil mit dieser E-Mail und wird übernommen.
--   b) Selbstregistrierung mit gültigem Vereinscode — dann entsteht ein neues Profil
--      im Status pending_approval, das ein Admin freischalten muss.
-- Alles andere wird abgewiesen: eine unbekannte E-Mail bekommt kein Konto.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_id      UUID;
    v_first_name       TEXT;
    v_last_name        TEXT;
    v_supplied_code    TEXT;
    v_registration_code TEXT;
BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data ->> 'first_name', '');
    v_last_name  := COALESCE(NEW.raw_user_meta_data ->> 'last_name', '');

    -- a) Vorhandenes, noch nicht verknüpftes Profil mit gleicher E-Mail übernehmen.
    SELECT id INTO v_existing_id
      FROM public.profiles
     WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
       AND auth_linked_at IS NULL
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.profiles
           SET id = NEW.id,
               auth_linked_at = NOW(),
               -- Eingeladene gelten mit der ersten Anmeldung als aktiv.
               status = CASE WHEN status = 'unconfirmed' THEN 'active' ELSE status END,
               first_name = CASE WHEN first_name = '' THEN v_first_name ELSE first_name END,
               last_name  = CASE WHEN last_name  = '' THEN v_last_name  ELSE last_name  END
         WHERE id = v_existing_id;

        RETURN NEW;
    END IF;

    -- b) Selbstregistrierung: nur mit gültigem Vereinscode.
    v_supplied_code := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'registration_code', '')), '');
    SELECT NULLIF(TRIM(value), '') INTO v_registration_code
      FROM public.club_settings WHERE key = 'registration_code';

    IF v_registration_code IS NULL OR v_supplied_code IS DISTINCT FROM v_registration_code THEN
        RAISE EXCEPTION
            'Diese E-Mail-Adresse ist im Verein nicht bekannt. Bitte den Registrierungslink des Vereins nutzen oder beim Administrator melden.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.profiles (id, first_name, last_name, email, status, role, auth_linked_at)
    VALUES (
        NEW.id,
        v_first_name,
        v_last_name,
        NEW.email,
        'pending_approval',
        'member',
        NOW()
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 12. Öffentliche RPCs (ohne Anmeldung aufrufbar)
-- ----------------------------------------------------------------------------

-- Der Anmeldebildschirm braucht den Vereinsnamen, bevor jemand angemeldet ist.
-- Gibt bewusst nur diese beiden Werte heraus, nicht die gesamte Einstellungstabelle.
CREATE OR REPLACE FUNCTION public.get_public_club_info()
RETURNS TABLE (club_name TEXT, club_short_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT
        (SELECT value FROM public.club_settings WHERE key = 'club_name'),
        (SELECT value FROM public.club_settings WHERE key = 'club_short_name');
$$;

-- Prüft den Vereinscode auf der Registrierungsseite. Gibt nur wahr/falsch zurück,
-- damit der Code selbst nicht über die API abfließt.
CREATE OR REPLACE FUNCTION public.rpc_validate_registration_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.club_settings
         WHERE key = 'registration_code'
           AND NULLIF(TRIM(value), '') IS NOT NULL
           AND TRIM(value) = TRIM(COALESCE(p_code, ''))
    );
$$;

REVOKE ALL ON FUNCTION public.get_public_club_info() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_validate_registration_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_club_info() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_validate_registration_code(TEXT) TO anon, authenticated;

-- Die Rechte-Helfer dürfen Angemeldete aufrufen, Anonyme nicht.
REVOKE ALL ON FUNCTION public.current_member_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_organizer_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_member_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_organizer_or_admin() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 13. Mitgliederverzeichnis: Kontaktdaten nur bei Freigabe
--
-- Die Sichtbarkeit von E-Mail und Telefon ist eine Spalten-, keine Zeilenfrage —
-- deshalb eine View statt einer Policy. security_invoker: die RLS von profiles
-- gilt weiterhin für den Aufrufer.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_members_directory
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.full_name,
    p.role,
    p.status,
    p.no_games,
    p.qttr,
    CASE WHEN p.contact_visible OR public.is_admin() OR p.id = auth.uid()
         THEN p.email END AS email,
    CASE WHEN p.contact_visible OR public.is_admin() OR p.id = auth.uid()
         THEN p.phone END AS phone,
    CASE WHEN p.contact_visible OR public.is_admin() OR p.id = auth.uid()
         THEN p.mobile_phone END AS mobile_phone,
    CASE WHEN NOT p.hide_birthday OR public.is_admin() OR p.id = auth.uid()
         THEN p.birthday END AS birthday
FROM public.profiles p
WHERE p.deleted_at IS NULL;

GRANT SELECT ON public.v_members_directory TO authenticated;

-- ----------------------------------------------------------------------------
-- 14. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.club_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues          ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.club_settings, public.profiles, public.member_rankings,
       public.groups, public.group_members, public.venues
    TO authenticated;

-- --- club_settings ----------------------------------------------------------
-- Lesen: angemeldete aktive Mitglieder, außer Schlüsseln mit Präfix secret_.
DROP POLICY IF EXISTS club_settings_select ON public.club_settings;
CREATE POLICY club_settings_select ON public.club_settings
    FOR SELECT TO authenticated
    USING (public.is_active_member() AND key NOT LIKE 'secret\_%');

DROP POLICY IF EXISTS club_settings_write ON public.club_settings;
CREATE POLICY club_settings_write ON public.club_settings
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --- profiles ---------------------------------------------------------------
-- Lesen: die eigene Zeile immer (auch vor der Freischaltung, sonst käme niemand
-- an seinen Status). Sonst: aktive Mitglieder sehen den Verein; ein Gast sieht
-- nur Ansprechpartner.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR (
            public.is_active_member()
            AND deleted_at IS NULL
            AND (
                public.current_member_role() <> 'guest'
                OR role IN ('admin', 'trainer')
            )
        )
    );

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

-- Ändern: die eigene Zeile oder alles als Admin. Welche Spalten das Mitglied dabei
-- nicht anfassen darf, entscheidet der Trigger aus Abschnitt 10.
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_delete ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- --- member_rankings --------------------------------------------------------
DROP POLICY IF EXISTS member_rankings_select ON public.member_rankings;
CREATE POLICY member_rankings_select ON public.member_rankings
    FOR SELECT TO authenticated
    USING (public.is_active_member() OR profile_id = auth.uid());

DROP POLICY IF EXISTS member_rankings_write ON public.member_rankings;
CREATE POLICY member_rankings_write ON public.member_rankings
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --- groups -----------------------------------------------------------------
DROP POLICY IF EXISTS groups_select ON public.groups;
CREATE POLICY groups_select ON public.groups
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS groups_write ON public.groups;
CREATE POLICY groups_write ON public.groups
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS group_members_select ON public.group_members;
CREATE POLICY group_members_select ON public.group_members
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS group_members_write ON public.group_members;
CREATE POLICY group_members_write ON public.group_members
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --- venues -----------------------------------------------------------------
DROP POLICY IF EXISTS venues_select ON public.venues;
CREATE POLICY venues_select ON public.venues
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS venues_write ON public.venues;
CREATE POLICY venues_write ON public.venues
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
