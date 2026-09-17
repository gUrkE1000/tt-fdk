-- Enable pgcrypto extension for password hashing if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom enums if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('player', 'team_manager', 'club_admin', 'sportwart');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_response') THEN
        CREATE TYPE public.availability_response AS ENUM ('yes', 'no', 'maybe', 'yes_sub');
    END IF;
END $$;

-- Ensure 'sportwart' value exists in the user_role enum (for older database schemas)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sportwart';
ALTER TYPE public.availability_response ADD VALUE IF NOT EXISTS 'yes_sub';

-- Commit the transaction so that the new enum values are registered
-- and can be used in subsequent statements in the same script.
COMMIT;

-- 1. Club Settings (e.g., global access password)
CREATE TABLE IF NOT EXISTS public.club_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default password (hashed or simple, let's support plain text check or blowfish crypt).
-- We'll use a simple blowfish hash for the default password 'Tischtennis2026'.
-- The application can also update this.
INSERT INTO public.club_settings (key, value)
VALUES ('club_password_hash', crypt('Tischtennis2026', gen_salt('bf', 8)))
ON CONFLICT (key) DO NOTHING;

-- 2. Profiles (now independent of auth.users so Sportwart can create players directly)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'player',
    ttr_points INTEGER NOT NULL DEFAULT 0,
    team_number INTEGER,
    position_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure team_number and position_number columns exist (for older database schemas)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'player';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ttr_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_number INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position_number INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Ensure older schemas get the default UUID generator for the profiles id column
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop legacy foreign key constraint referencing auth.users if it exists to keep profiles independent
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. Teams
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    webcal_url TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 3 teams initially
INSERT INTO public.teams (id, name, short_name, webcal_url, active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Erwachsene I', 'Erwachsene 1', 'webcal://www.mytischtennis.de/community/exportICSCalendar?teamIds=1111111', true),
  ('22222222-2222-2222-2222-222222222222', 'Erwachsene II', 'Erwachsene 2', 'webcal://www.mytischtennis.de/community/exportICSCalendar?teamIds=2222222', true),
  ('33333333-3333-3333-3333-333333333333', 'Erwachsene III', 'Erwachsene 3', 'webcal://www.mytischtennis.de/community/exportICSCalendar?teamIds=3142285', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Team Players (Many-to-Many map players to teams they can play for or are assigned to)
CREATE TABLE IF NOT EXISTS public.team_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, player_id)
);

-- 5. Matches
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    external_uid TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT,
    location TEXT,
    dtstart TIMESTAMPTZ NOT NULL,
    dtend TIMESTAMPTZ NOT NULL,
    is_home BOOLEAN NOT NULL DEFAULT true,
    matchday INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    lineup JSONB,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, external_uid)
);

-- Ensure lineup column exists for older schemas
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lineup JSONB;

-- 6. Availabilities
CREATE TABLE IF NOT EXISTS public.availabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    response public.availability_response NOT NULL,
    comment TEXT,
    version_responded INTEGER NOT NULL, -- Stores the match version at the time of the response
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

-- 7. Sync Runs
CREATE TABLE IF NOT EXISTS public.sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL, -- 'success', 'failed'
    summary_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Match Changes (to log date/time changes, etc.)
CREATE TABLE IF NOT EXISTS public.match_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    old_dtstart TIMESTAMPTZ,
    new_dtstart TIMESTAMPTZ,
    change_type TEXT NOT NULL, -- 'date_time_changed', 'cancelled', 'details_updated'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Absences (Abwesenheiten)
CREATE TABLE IF NOT EXISTS public.absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default test players
INSERT INTO public.profiles (id, name, role, ttr_points, team_number, position_number)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Max Mustermann', 'sportwart', 1600, 1, 1),
  ('d0000000-0000-0000-0000-000000000002', 'Mia Musterfrau', 'player', 1500, 1, 2),
  ('d0000000-0000-0000-0000-000000000003', 'Hans Meier', 'team_manager', 1000, 2, 1)
ON CONFLICT (id) DO NOTHING;

-- Seed default team_players
INSERT INTO public.team_players (team_id, player_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000002'),
  ('22222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------
-- TRIGGERS & FUNCTIONS
-- ----------------------------------------------------

-- Automatically create profile on user signup (fallback/legacy)
-- If a player registers with a name that matches an unassociated player profile (one created by the Sportwart/Admin
-- and not yet associated with any user in auth.users), that existing profile is used and linked to the email and new id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_name TEXT;
    existing_profile_id UUID;
    lineup_match_rec RECORD;
    updated_lineup JSONB;
    p_id_str TEXT;
    new_id_str TEXT;
BEGIN
    default_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

    -- Check if there is an existing profile with the same name (case-insensitive and trimmed)
    -- that does NOT exist in auth.users (meaning its id is not present in auth.users).
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(default_name))
      AND id NOT IN (SELECT id FROM auth.users)
    LIMIT 1;

    IF existing_profile_id IS NOT NULL THEN
        -- Link the existing profile to the new user by updating its ID to new.id.
        -- This updates references across team_players, availabilities, absences due to ON UPDATE CASCADE.
        UPDATE public.profiles
        SET id = new.id,
            updated_at = NOW()
        WHERE id = existing_profile_id;

        -- Update any matches where this player was stored in the lineup (which is JSONB format array of UUID strings)
        p_id_str := existing_profile_id::text;
        new_id_str := new.id::text;

        FOR lineup_match_rec IN
            SELECT id, lineup
            FROM public.matches
            WHERE lineup @> jsonb_build_array(p_id_str)
        LOOP
            -- Reconstruct lineup array replacing the old id string with the new id string
            SELECT jsonb_agg(
                CASE
                    WHEN elem = to_jsonb(p_id_str) THEN to_jsonb(new_id_str)
                    ELSE elem
                END
            ) INTO updated_lineup
            FROM jsonb_array_elements(lineup_match_rec.lineup) AS elem;

            UPDATE public.matches
            SET lineup = updated_lineup
            WHERE id = lineup_match_rec.id;
        END LOOP;
    ELSE
        -- If no matching unassociated profile exists, insert a brand new profile
        INSERT INTO public.profiles (id, name, role)
        VALUES (new.id, default_name, 'player')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Password verification RPC helper
CREATE OR REPLACE FUNCTION public.verify_club_password(password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    stored_hash TEXT;
BEGIN
    SELECT value INTO stored_hash FROM public.club_settings WHERE key = 'club_password_hash';
    IF stored_hash IS NULL THEN
        -- Fallback to default if not exists
        RETURN false;
    END IF;
    RETURN stored_hash = crypt(password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is club admin
CREATE OR REPLACE FUNCTION public.is_club_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'club_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is team manager or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('team_manager', 'club_admin', 'sportwart')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

-- Club Settings RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read club settings" ON public.club_settings;
CREATE POLICY "Allow anyone to read club settings"
    ON public.club_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage club settings" ON public.club_settings;
CREATE POLICY "Allow anyone to manage club settings"
    ON public.club_settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- Profiles RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read profiles" ON public.profiles;
CREATE POLICY "Allow anyone to read profiles"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage profiles" ON public.profiles;
CREATE POLICY "Allow anyone to manage profiles"
    ON public.profiles FOR ALL
    USING (true)
    WITH CHECK (true);

-- Teams RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read teams" ON public.teams;
CREATE POLICY "Allow anyone to read teams"
    ON public.teams FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage teams" ON public.teams;
CREATE POLICY "Allow anyone to manage teams"
    ON public.teams FOR ALL
    USING (true)
    WITH CHECK (true);

-- Team Players RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read team players" ON public.team_players;
CREATE POLICY "Allow anyone to read team players"
    ON public.team_players FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage team players" ON public.team_players;
CREATE POLICY "Allow anyone to manage team players"
    ON public.team_players FOR ALL
    USING (true)
    WITH CHECK (true);

-- Matches RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read matches" ON public.matches;
CREATE POLICY "Allow anyone to read matches"
    ON public.matches FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage matches" ON public.matches;
CREATE POLICY "Allow anyone to manage matches"
    ON public.matches FOR ALL
    USING (true)
    WITH CHECK (true);

-- Availabilities RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read availabilities" ON public.availabilities;
CREATE POLICY "Allow anyone to read availabilities"
    ON public.availabilities FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage availabilities" ON public.availabilities;
CREATE POLICY "Allow anyone to manage availabilities"
    ON public.availabilities FOR ALL
    USING (true)
    WITH CHECK (true);

-- Sync Runs RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read sync runs" ON public.sync_runs;
CREATE POLICY "Allow anyone to read sync runs"
    ON public.sync_runs FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage sync runs" ON public.sync_runs;
CREATE POLICY "Allow anyone to manage sync runs"
    ON public.sync_runs FOR ALL
    USING (true)
    WITH CHECK (true);

-- Match Changes RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read match changes" ON public.match_changes;
CREATE POLICY "Allow anyone to read match changes"
    ON public.match_changes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage match changes" ON public.match_changes;
CREATE POLICY "Allow anyone to manage match changes"
    ON public.match_changes FOR ALL
    USING (true)
    WITH CHECK (true);

-- Absences RLS Policies
DROP POLICY IF EXISTS "Allow anyone to read absences" ON public.absences;
CREATE POLICY "Allow anyone to read absences"
    ON public.absences FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to manage absences" ON public.absences;
CREATE POLICY "Allow anyone to manage absences"
    ON public.absences FOR ALL
    USING (true)
    WITH CHECK (true);

-- Drop and recreate existing constraints to make sure ON UPDATE CASCADE is active
-- for databases that have already been initialized with the legacy schema.
ALTER TABLE public.team_players DROP CONSTRAINT IF EXISTS team_players_player_id_fkey;
ALTER TABLE public.team_players ADD CONSTRAINT team_players_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.availabilities DROP CONSTRAINT IF EXISTS availabilities_player_id_fkey;
ALTER TABLE public.availabilities ADD CONSTRAINT availabilities_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.absences DROP CONSTRAINT IF EXISTS absences_player_id_fkey;
ALTER TABLE public.absences ADD CONSTRAINT absences_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
