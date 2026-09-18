-- ============================================================================
-- Ämter (Vereinsrollen, Aufgabe 9.6)
--
-- **Nicht zu verwechseln mit den Benutzerrollen.** `profiles.role` steuert, was
-- jemand in der Anwendung darf, und ist fest vorgegeben (sechs Werte). Ein Amt
-- ist ein frei definierbarer Posten im Verein — Jugendwart, Kassier, Pressewart.
-- Es schaltet **keine einzige Berechtigung** frei.
--
-- Im TT-Planer schalten Ämter genau zwei Dinge frei: Inventar und Bekleidung.
-- Beide Module sind in diesem Nachbau gestrichen (Vereinsentscheidung), also
-- bleibt vom Amt das, was es eigentlich ist: eine Auskunft darüber, wen man bei
-- welchem Anliegen anspricht.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.club_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    -- Die Tätigkeiten als Liste statt als Fließtext: In der Oberfläche steht eine
    -- pro Zeile, und so lässt sie sich auch als eine pro Zeile anzeigen.
    duties      TEXT[] NOT NULL DEFAULT '{}',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT club_roles_name_not_empty CHECK (length(btrim(name)) > 0)
);

DROP TRIGGER IF EXISTS club_roles_updated_at ON public.club_roles;
CREATE TRIGGER club_roles_updated_at
    BEFORE UPDATE ON public.club_roles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ein Amt kann mehrere Inhaber haben (zwei Jugendwarte), ein Mitglied mehrere
-- Ämter (Kassier und Pressewart in Personalunion). Beides ist im Verein normal.
CREATE TABLE IF NOT EXISTS public.club_role_members (
    role_id    UUID NOT NULL REFERENCES public.club_roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (role_id, profile_id)
);

CREATE INDEX IF NOT EXISTS club_role_members_profile_idx
    ON public.club_role_members (profile_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.club_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_role_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_roles        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_role_members TO authenticated;

-- Lesen: jedes aktive Mitglied. Wer der Kassier ist, ist genau die Art Auskunft,
-- für die es dieses Modul gibt — sie zu verbergen hieße, es abzuschaffen.
DROP POLICY IF EXISTS club_roles_select ON public.club_roles;
CREATE POLICY club_roles_select ON public.club_roles
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS club_roles_write ON public.club_roles;
CREATE POLICY club_roles_write ON public.club_roles
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS club_role_members_select ON public.club_role_members;
CREATE POLICY club_role_members_select ON public.club_role_members
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS club_role_members_write ON public.club_role_members;
CREATE POLICY club_role_members_write ON public.club_role_members
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Sicht: Ämter mit Inhabern
--
-- Die Kontaktdaten kommen **nicht** von hier, sondern weiter aus
-- `v_members_directory`: Dort sind E-Mail und Telefon schon maskiert, wenn das
-- Mitglied sie nicht freigegeben hat. Ein Amt zu haben ist kein Grund, die
-- private Handynummer zu veröffentlichen.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_club_role_members
WITH (security_invoker = true) AS
SELECT
    m.role_id,
    m.profile_id,
    p.full_name,
    p.role AS user_role
FROM public.club_role_members m
JOIN public.profiles p ON p.id = m.profile_id
WHERE p.deleted_at IS NULL;

GRANT SELECT ON public.v_club_role_members TO authenticated;
