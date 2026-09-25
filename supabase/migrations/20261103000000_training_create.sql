-- ============================================================================
-- Training anlegen: Lese-Policy und Trainer-Eintrag des Anlegenden
--
-- 1. `trainings_select` fragte `can_see_training(id)`. Die Funktion sucht das
--    Training per id in der Tabelle — beim INSERT … RETURNING, wie PostgREST es
--    für `.insert().select()` schickt, prüft PostgreSQL die Lese-Policy aber am
--    neuen Datensatz, bevor er in der Tabelle steht. Die Suche fand nichts, und
--    jedes Anlegen scheiterte mit „new row violates row-level security policy",
--    auch für den Administrator. Die Policy prüft deshalb die Spalten der Zeile
--    selbst und fragt die Funktion nur noch für Gäste.
--
-- 2. Ein Trainer darf ein Training anlegen, aber Trainer und Mitglieder nur bei
--    Trainings eintragen, die er leitet — und direkt nach dem Anlegen leitet er
--    noch keines. Der Trigger unten trägt ihn deshalb als Trainer ein. Legt der
--    Administrator an, bleibt die Zuordnung leer: Er legt Trainings für andere an.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lese-Policy
-- ----------------------------------------------------------------------------

-- Gleiche Regel wie `can_see_training`: Mitglieder sehen alle Trainings, Gäste nur
-- offene oder solche, denen sie zugeordnet sind. Für Gäste darf die Funktion die
-- Zeile nachschlagen — sie legen keine Trainings an.
DROP POLICY IF EXISTS trainings_select ON public.trainings;
CREATE POLICY trainings_select ON public.trainings
    FOR SELECT TO authenticated
    USING (
        public.is_active_member()
        AND (
            public.current_member_role() <> 'guest'
            OR is_open
            OR public.can_see_training(id)
        )
    );

-- ----------------------------------------------------------------------------
-- 2. Wer anlegt, leitet
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_creator_as_trainer()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    -- Ohne Anmeldung (Service Role, Seed, Import) gibt es niemanden einzutragen.
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        INSERT INTO public.training_trainers (training_id, profile_id)
        VALUES (NEW.id, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.add_creator_as_trainer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_creator_as_trainer() TO service_role;

DROP TRIGGER IF EXISTS trainings_add_creator_as_trainer ON public.trainings;
CREATE TRIGGER trainings_add_creator_as_trainer
    AFTER INSERT ON public.trainings
    FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_trainer();
