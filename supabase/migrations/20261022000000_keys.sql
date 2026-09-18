-- ============================================================================
-- Schlüsselverwaltung (Aufgabe 9.1)
--
-- Ein Verein hat wenige Hallenschlüssel und viele Leute, die einen brauchen. Die
-- Frage, die dieses Modul beantwortet, ist immer dieselbe: **Wer hat ihn gerade?**
--
-- Deshalb steht der aktuelle Inhaber als Spalte an `keys` und nicht nur als
-- jüngste Zeile in `key_handovers`. Beides zu führen ist Absicht: Die Spalte ist
-- die Antwort, das Protokoll ist die Begründung. Wäre nur das Protokoll da, hinge
-- die wichtigste Auskunft des Moduls an einer Sortierung — und zwei Übergaben in
-- derselben Sekunde hätten den Schlüssel an die falsche Person gegeben.
--
-- Geschrieben wird beides ausschließlich von `rpc_hand_over_key`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabellen
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.keys (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    -- „nicht definiert" ist erlaubt (Bestandsaufnahme F): ein Schlüssel zum
    -- Gerätewart-Schrank gehört zu keiner Halle.
    venue_id       UUID REFERENCES public.venues(id) ON UPDATE CASCADE ON DELETE SET NULL,
    -- Wer für den Schlüssel geradesteht. Pflicht — ein Schlüssel ohne
    -- Verantwortlichen ist ein verlorener Schlüssel mit Extraschritten.
    responsible_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE,
    -- Wer ihn gerade hat. NULL heißt: liegt beim Verantwortlichen, oder niemand weiß es.
    holder_id      UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    -- Gesetzt: Nur Verantwortlicher und Administrator geben ihn weiter.
    no_forwarding  BOOLEAN NOT NULL DEFAULT false,
    active         BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT keys_name_not_empty CHECK (length(btrim(name)) > 0)
);

DROP TRIGGER IF EXISTS keys_updated_at ON public.keys;
CREATE TRIGGER keys_updated_at
    BEFORE UPDATE ON public.keys
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS keys_holder_idx ON public.keys (holder_id) WHERE holder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS keys_venue_idx  ON public.keys (venue_id);

-- Das Protokoll. Zeilen werden nie geändert oder gelöscht: Ein Schlüsselweg, den
-- man nachträglich zurechtrücken kann, beantwortet die Frage „wo ist er
-- hingekommen?" nicht mehr.
CREATE TABLE IF NOT EXISTS public.key_handovers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id          UUID NOT NULL REFERENCES public.keys(id) ON UPDATE CASCADE ON DELETE CASCADE,
    from_profile_id UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    to_profile_id   UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    -- Wer die Übergabe eingetragen hat. Meist der Abgebende, bei einer Korrektur
    -- durch den Administrator aber nicht.
    recorded_by     UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS key_handovers_key_idx
    ON public.key_handovers (key_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Rechte-Helfer
-- ----------------------------------------------------------------------------

-- Wer einen Schlüssel weitergeben darf.
--
-- Der aktuelle Inhaber darf es — das ist der Normalfall und der Grund, warum das
-- Modul existiert. Bei `no_forwarding` darf er es nicht: Dann bestimmt allein,
-- wer geradesteht, wohin der Schlüssel geht. Verantwortlicher und Administrator
-- dürfen immer, sonst wäre ein Schlüssel bei einem ausgetretenen Mitglied für
-- immer verloren.
CREATE OR REPLACE FUNCTION public.may_hand_over_key(p_key_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.keys k
         WHERE k.id = p_key_id
           AND k.active
           AND (
                public.is_admin()
             OR k.responsible_id = auth.uid()
             OR (k.holder_id = auth.uid() AND NOT k.no_forwarding)
           )
    );
$$;

REVOKE ALL ON FUNCTION public.may_hand_over_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.may_hand_over_key(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Übergabe
-- ----------------------------------------------------------------------------

-- Die einzige Stelle, die `holder_id` ändert.
--
-- Rückgabewert als jsonb statt einer Ausnahme: Die Oberfläche soll den Grund
-- anzeigen können („der Schlüssel darf nicht weitergegeben werden"), ohne eine
-- Fehlermeldung der Datenbank auseinanderzunehmen.
CREATE OR REPLACE FUNCTION public.rpc_hand_over_key(
    p_key_id UUID,
    p_to     UUID,
    p_note   TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_key    public.keys%ROWTYPE;
    v_target public.profiles%ROWTYPE;
BEGIN
    -- FOR UPDATE: Zwei Übergaben desselben Schlüssels zur selben Zeit sollen sich
    -- nacheinander abspielen, nicht nebeneinander.
    SELECT * INTO v_key FROM public.keys WHERE id = p_key_id FOR UPDATE;

    IF NOT FOUND OR NOT v_key.active THEN
        RETURN jsonb_build_object('status', 'gone');
    END IF;

    IF NOT public.may_hand_over_key(p_key_id) THEN
        RETURN jsonb_build_object('status', 'not_allowed');
    END IF;

    -- NULL heißt „zurück an niemanden" — der Schlüssel liegt wieder beim
    -- Verantwortlichen. Ein gültiges Ziel, kein Fehler.
    IF p_to IS NOT NULL THEN
        SELECT * INTO v_target FROM public.profiles
         WHERE id = p_to AND deleted_at IS NULL AND status = 'active';

        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'unknown_member');
        END IF;
    END IF;

    IF v_key.holder_id IS NOT DISTINCT FROM p_to THEN
        RETURN jsonb_build_object('status', 'unchanged');
    END IF;

    INSERT INTO public.key_handovers (key_id, from_profile_id, to_profile_id, recorded_by, note)
    VALUES (p_key_id, v_key.holder_id, p_to, auth.uid(), COALESCE(btrim(p_note), ''));

    UPDATE public.keys SET holder_id = p_to WHERE id = p_key_id;

    RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_hand_over_key(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_hand_over_key(UUID, UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_handovers ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.keys          TO authenticated;
GRANT SELECT ON public.key_handovers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.keys TO authenticated;

-- Lesen: jedes aktive Mitglied. Ein Schlüssel ist Vereinsinfrastruktur, und die
-- Trainingskarte muss zeigen können, ob jemand mit Schlüssel kommt. Ein Gast ist
-- davon nicht ausgenommen — er sieht offene Trainings, also auch, ob sie
-- aufgeschlossen werden.
DROP POLICY IF EXISTS keys_select ON public.keys;
CREATE POLICY keys_select ON public.keys
    FOR SELECT TO authenticated
    USING (public.is_active_member());

-- Anlegen, ändern, löschen: nur der Administrator. `holder_id` ändert auch er
-- nicht direkt — dafür gibt es die RPC, die das Protokoll mitschreibt.
DROP POLICY IF EXISTS keys_write ON public.keys;
CREATE POLICY keys_write ON public.keys
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Das Protokoll ist lesbar wie der Schlüssel selbst und für niemanden
-- beschreibbar: Zeilen entstehen nur in `rpc_hand_over_key`.
DROP POLICY IF EXISTS key_handovers_select ON public.key_handovers;
CREATE POLICY key_handovers_select ON public.key_handovers
    FOR SELECT TO authenticated
    USING (public.is_active_member());

-- ----------------------------------------------------------------------------
-- 5. Sichten
-- ----------------------------------------------------------------------------

-- Schlüssel mit Namen statt Kennungen — für die Liste unter „Orte & Schlüssel"
-- und den Reiter „Schlüssel" der Übersicht.
CREATE OR REPLACE VIEW public.v_keys
WITH (security_invoker = true) AS
SELECT
    k.id,
    k.name,
    k.venue_id,
    v.name AS venue_name,
    k.responsible_id,
    r.full_name AS responsible_name,
    k.holder_id,
    h.full_name AS holder_name,
    k.no_forwarding,
    k.active,
    public.may_hand_over_key(k.id) AS may_hand_over
FROM public.keys k
LEFT JOIN public.venues   v ON v.id = k.venue_id
LEFT JOIN public.profiles r ON r.id = k.responsible_id
LEFT JOIN public.profiles h ON h.id = k.holder_id;

GRANT SELECT ON public.v_keys TO authenticated;

-- Schlüssellage je Trainingstermin (Zielbild 4.4: `requires_key_owner`).
--
-- Bewusst **ohne** `security_invoker`, aus demselben Grund wie bei
-- `v_session_counts`: Ob jemand mit Schlüssel kommt, muss stimmen, auch wenn die
-- Teilnehmerliste verborgen ist. Der **Name** hängt dagegen an der Sichtbarkeit
-- der Liste — sonst verriete der Hinweis „Schlüssel: Max Mustermann" bei einem
-- inkognito geführten Training genau das, was Inkognito verbergen soll.
CREATE OR REPLACE VIEW public.v_session_keys AS
SELECT
    s.id AS session_id,
    EXISTS (
        SELECT 1
          FROM public.training_attendance a
          JOIN public.keys k ON k.holder_id = a.profile_id
         WHERE a.session_id = s.id
           AND a.status IN ('yes', 'late')
           AND k.active
           AND k.venue_id = t.venue_id
    ) AS has_key_holder,
    CASE WHEN public.may_see_session_roster(s.id) THEN (
        SELECT p.full_name
          FROM public.training_attendance a
          JOIN public.keys k     ON k.holder_id = a.profile_id
          JOIN public.profiles p ON p.id = a.profile_id
         WHERE a.session_id = s.id
           AND a.status IN ('yes', 'late')
           AND k.active
           AND k.venue_id = t.venue_id
         ORDER BY p.full_name
         LIMIT 1
    ) END AS holder_name
FROM public.training_sessions s
JOIN public.trainings t ON t.id = s.training_id
WHERE public.can_see_training(t.id);

GRANT SELECT ON public.v_session_keys TO authenticated;
