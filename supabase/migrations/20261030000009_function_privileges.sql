-- ============================================================================
-- Rechte auf Funktionen und Tabellen (Code-Review K-1)
--
-- Supabase gibt anon und authenticated per ALTER DEFAULT PRIVILEGES ausdrücklich
-- EXECUTE auf jede neue Funktion im Schema public. `REVOKE … FROM PUBLIC`, wie es in
-- allen bisherigen Migrationen steht, nimmt dieses ausdrückliche Recht NICHT zurück.
-- Damit war jede interne Funktion — enqueue_notification, apply_event_answer,
-- run_retention … — über /rest/v1/rpc/ mit dem öffentlichen Anon-Key aufrufbar.
--
-- Diese Migration dreht das um: Niemand darf etwas, das nicht unten steht.
-- Sie steht bewusst als letzte im Block, damit sie alle Funktionen davor erfasst.
-- supabase/tests/005_privileges.test.sql prüft die Listen bei jedem CI-Lauf.
--
-- Für neue Funktionen heißt das ab jetzt: Wer sie von außen aufrufbar machen will,
-- schreibt das GRANT ausdrücklich dazu (und ergänzt bei Bedarf die Liste im Test).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Künftige Objekte: keine automatischen Rechte mehr für anon und authenticated
-- ----------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- anon braucht keine einzige Tabelle oder Sicht: Alles vor der Anmeldung läuft über
-- die vier öffentlichen Funktionen unten. RLS hielt anon schon bisher draußen —
-- ohne Tabellenrecht gilt das auch dann, wenn eine Policy einmal zu weit gerät.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ----------------------------------------------------------------------------
-- 2. Bestehende Funktionen: allen alles nehmen, dann gezielt freigeben
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    f RECORD;
    -- Ohne Anmeldung aufrufbar: Anmeldeseite, Registrierung, Antwort-Link.
    v_anon TEXT[] := ARRAY[
        'get_public_club_info',
        'rpc_validate_registration_code',
        'rpc_answer_action_token',
        'rpc_describe_action_token'
    ];
    -- Für Angemeldete: alle rpc_* (sie prüfen den Aufrufer selbst) plus die
    -- Prädikate und Helfer, die RLS-Policies, CHECK-Constraints und
    -- security_invoker-Sichten mit den Rechten des Aufrufers auswerten.
    v_authenticated TEXT[] := ARRAY[
        'current_member_role', 'is_active_member', 'is_admin', 'is_organizer_or_admin',
        'is_playing_member', 'can_see_absences', 'leads_team', 'leads_match',
        'trains', 'trains_session', 'can_see_training', 'may_see_training_roster',
        'may_see_session_roster', 'may_join_training', 'is_poll_target',
        'may_see_poll_results', 'may_hand_over_key', 'can_see_message_object',
        'may_see_training_statistics', 'berlin_today', 'valid_email_list'
    ];
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig, p.proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prokind = 'f'
           -- Funktionen von Extensions (pgTAP lokal, pgcrypto …) bleiben unberührt.
           AND NOT EXISTS (
               SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
           )
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);

        IF f.proname = ANY (v_anon) THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f.sig);
        ELSIF f.proname = ANY (v_authenticated) OR f.proname LIKE 'rpc\_%' THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Gleiches für die Funktionen im Schema private
--
-- Das Schema ist für anon/authenticated ohnehin gesperrt (kein USAGE). Der Vollständig-
-- keit halber trotzdem: Die Trigger-Funktionen der Cron-Jobs gehören niemandem außer
-- dem Eigentümer.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'private' AND p.prokind = 'f'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    END LOOP;
END $$;
