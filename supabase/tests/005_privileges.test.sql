-- Rechte auf Funktionen, Tabellen und Spalten (Code-Review K-1, H-1, H-2).
--
-- Die übrigen Tests prüfen, was Policies und RPCs tun. Dieser prüft, wer sie überhaupt
-- aufrufen darf. Supabase vergibt EXECUTE auf neue Funktionen automatisch an anon und
-- authenticated; ohne diesen Test fiele eine vergessene Einschränkung erst auf, wenn
-- jemand sie ausnutzt.
--
-- Wer eine neue öffentliche Funktion braucht, trägt sie hier UND in der Migration ein.

BEGIN;
SELECT plan(12);

-- ============================================================ Funktionen

SELECT is_empty(
    $$ SELECT p.oid::regprocedure::text
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind = 'f'
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
          AND p.proname NOT IN ('get_public_club_info', 'rpc_validate_registration_code',
                                'rpc_answer_action_token', 'rpc_describe_action_token')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') $$,
    'anon darf nur die vier öffentlichen Funktionen ausführen'
);

SELECT is_empty(
    $$ SELECT p.oid::regprocedure::text
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind = 'f'
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND p.proname NOT LIKE 'rpc\_%'
          AND p.proname NOT IN (
              'get_public_club_info',
              'current_member_role', 'is_active_member', 'is_admin', 'is_organizer_or_admin',
              'is_playing_member', 'can_see_absences', 'leads_team', 'leads_match',
              'trains', 'trains_session', 'can_see_training', 'may_see_training_roster',
              'may_see_session_roster', 'may_join_training', 'is_poll_target',
              'may_see_poll_results', 'may_hand_over_key', 'can_see_message_object',
              'may_see_training_statistics', 'berlin_today', 'valid_email_list',
              'belongs_to_team', 'can_see_match',
              -- Sichten rufen sie mit den Rechten des Aufrufers
              'club_default_venue', 'is_my_training_session', 'key_duty_for')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') $$,
    'authenticated darf außer rpc_* nur die Prädikate der Policies ausführen'
);

SELECT ok(
    NOT has_function_privilege('authenticated',
        'public.enqueue_notification(uuid, text, jsonb, boolean, timestamptz)', 'EXECUTE'),
    'Benachrichtigungen einreihen darf nur der Server'
);

SELECT ok(
    has_function_privilege('service_role',
        'public.enqueue_notification(uuid, text, jsonb, boolean, timestamptz)', 'EXECUTE'),
    'service_role darf weiterhin einreihen'
);

SELECT throws_ok(
    $$ SET LOCAL ROLE anon;
       SELECT public.enqueue_notification('22222222-0000-0000-0000-000000000002', 'welcome') $$,
    '42501',
    NULL,
    'Ohne Anmeldung lässt sich keine E-Mail auslösen'
);
RESET ROLE;

SELECT ok(
    has_function_privilege('anon', 'public.rpc_answer_action_token(uuid, text)', 'EXECUTE'),
    'Der Antwort-Link funktioniert weiterhin ohne Anmeldung'
);

-- ============================================================ Tabellen

SELECT is_empty(
    $$ SELECT c.relname
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND NOT c.relrowsecurity
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') $$,
    'Jede Tabelle in public hat RLS'
);

SELECT is_empty(
    $$ SELECT c.relname
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
          AND has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') $$,
    'anon liest keine Tabelle und keine Sicht'
);

-- ============================================================ Spalten

SELECT tests.login_as('22222222-1111-0000-0000-000000000002');

SELECT throws_ok(
    $$ SELECT email FROM public.profiles WHERE id <> auth.uid() $$,
    '42501',
    NULL,
    'Ein Mitglied liest E-Mail-Adressen nicht an der Freigabe vorbei aus der Tabelle'
);

SELECT lives_ok(
    $$ SELECT id, full_name, role FROM public.profiles $$,
    'Name und Rolle bleiben für Mitglieder lesbar'
);

SELECT ok(
    (SELECT id = '22222222-1111-0000-0000-000000000002' AND email IS NOT NULL
       FROM public.rpc_my_profile()),
    'Das eigene Profil kommt vollständig über rpc_my_profile'
);

SELECT throws_ok(
    $$ SELECT comment_private FROM public.absences $$,
    '42501',
    NULL,
    'Der private Abwesenheitsgrund ist über die Tabelle nicht lesbar'
);

SELECT * FROM finish();
ROLLBACK;
