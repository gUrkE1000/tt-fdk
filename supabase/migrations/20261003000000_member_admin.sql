-- ============================================================================
-- Mitgliederverwaltung (Aufgabe 2.2)
--
-- Die Verwaltung selbst braucht kein neues Schema: Anlegen, Ändern und Löschen
-- laufen über `profiles`, `member_rankings` und `group_members`, deren Policies
-- aus der Baseline bereits stimmen. Was fehlt, sind zwei Operationen, die mehr
-- sind als ein UPDATE:
--
--   1. Freischalten. Ein Mitglied, das sich per Vereinscode registriert hat,
--      steht auf `pending_approval`. Das Freischalten ist ein fachlicher Schritt
--      mit Vorbedingung, kein beliebiges Setzen einer Spalte — und ab Aufgabe 4.1
--      hängt daran die Willkommens-Nachricht. Deshalb eine eigene Funktion.
--   2. Massenpflege der QTTR-Werte. Vor jeder Saison kommt eine Liste
--      „Name → QTTR". Ein Aufruf je Zeile wären 30 Anfragen; hier ist es eine.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Der Admin muss auch gelöschte Mitglieder sehen
-- ----------------------------------------------------------------------------

-- Beim Bauen der Mitgliederverwaltung fiel auf, dass der Admin niemanden löschen
-- konnte: PostgreSQL prüft beim UPDATE auch die SELECT-Policy gegen die *neue*
-- Zeile. Die Baseline-Policy verlangte für fremde Zeilen `deleted_at IS NULL` —
-- die gelöschte Zeile wäre also unsichtbar, und der UPDATE scheiterte an
-- „new row violates row-level security policy".
--
-- Der Admin sieht deshalb ab hier jede Zeile. Das ist ohnehin nötig: ohne
-- Sichtbarkeit könnte er ein versehentlich gelöschtes Konto nie wiederherstellen.
-- Für alle anderen bleibt es beim Alten.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR public.is_admin()
        OR (
            public.is_active_member()
            AND deleted_at IS NULL
            AND (
                public.current_member_role() <> 'guest'
                OR role IN ('admin', 'trainer')
            )
        )
    );

-- ----------------------------------------------------------------------------
-- Freischalten
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_activate_member(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_status public.member_status;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Nur ein Administrator kann Mitglieder freischalten.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT status INTO v_status
    FROM public.profiles
    WHERE id = p_profile_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dieses Mitglied gibt es nicht (mehr).' USING ERRCODE = 'no_data_found';
    END IF;

    IF v_status = 'active' THEN
        RETURN;   -- schon freigeschaltet: kein Fehler, nur nichts zu tun
    END IF;

    UPDATE public.profiles
    SET status = 'active'
    WHERE id = p_profile_id;

    -- Ab Aufgabe 4.1 reiht hier `enqueue_notification('welcome', ...)` die
    -- Willkommens-E-Mail ein. Bis dahin ist die Freischaltung nur ein Statuswechsel.
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_activate_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_activate_member(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- QTTR-Massenaktualisierung
-- ----------------------------------------------------------------------------

-- Erwartet ein JSON-Array [{ "id": "<uuid>", "qttr": 1540 }, …]. Ein NULL-Wert
-- löscht den Eintrag; unbekannte IDs werden still übergangen, damit eine
-- eingefügte Liste nicht an einer einzigen Zeile scheitert.
CREATE OR REPLACE FUNCTION public.rpc_update_qttr_bulk(p_values JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Nur ein Administrator kann QTTR-Werte pflegen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF jsonb_typeof(p_values) <> 'array' THEN
        RAISE EXCEPTION 'Erwartet wird eine Liste von { id, qttr }.'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    WITH input AS (
        SELECT (entry ->> 'id')::UUID AS id,
               NULLIF(entry ->> 'qttr', '')::INTEGER AS qttr
        FROM jsonb_array_elements(p_values) AS entry
    ),
    updated AS (
        UPDATE public.profiles p
        SET qttr = input.qttr
        FROM input
        WHERE p.id = input.id AND p.deleted_at IS NULL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM updated;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_qttr_bulk(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_update_qttr_bulk(JSONB) TO authenticated;
