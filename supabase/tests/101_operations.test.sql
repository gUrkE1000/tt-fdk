-- Betriebssicht: Cron-Status und erneuter Versandversuch (Aufgabe 8.4)

BEGIN;
SELECT plan(7);

-- Eine fehlgeschlagene und eine verschickte Nachricht anlegen.
DO $$
BEGIN
    PERFORM tests.as_service_role();

    INSERT INTO public.notifications
        (id, profile_id, channel, type, subject, body_text, status, attempts, error)
    VALUES
        ('aaaa0000-0000-0000-0000-000000000001',
         '22222222-1111-0000-0000-000000000001', 'email', 'match_reminder',
         'Erinnerung', 'Text', 'failed', 3, 'HTTP 403'),
        ('aaaa0000-0000-0000-0000-000000000002',
         '22222222-1111-0000-0000-000000000001', 'email', 'match_reminder',
         'Erinnerung', 'Text', 'sent', 1, NULL);
END $$;

-- ============================================================ Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ SELECT public.rpc_retry_notification('aaaa0000-0000-0000-0000-000000000001') $$,
    '42501',
    NULL,
    'Ein Mitglied darf keinen Versand wiederholen'
);

SELECT is(
    (SELECT count(*) FROM public.v_cron_status)::int,
    0,
    'und sieht die Jobs nicht'
);

-- ============================================================ Administrator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT public.rpc_retry_notification('aaaa0000-0000-0000-0000-000000000001')),
    true,
    'Der Administrator stellt eine fehlgeschlagene Nachricht zurück'
);

SELECT is(
    (SELECT status::TEXT FROM public.notifications
      WHERE id = 'aaaa0000-0000-0000-0000-000000000001'),
    'pending',
    'sie wartet danach wieder'
);

-- Der Zähler muss zurück: sonst wäre sie nach dem ersten neuen Versuch gleich wieder
-- „failed", weil `attempts` schon bei drei stand.
SELECT is(
    (SELECT attempts FROM public.notifications
      WHERE id = 'aaaa0000-0000-0000-0000-000000000001'),
    0,
    'und fängt mit null Versuchen an'
);

SELECT is(
    (SELECT error FROM public.notifications
      WHERE id = 'aaaa0000-0000-0000-0000-000000000001'),
    NULL,
    'der alte Grund steht nicht mehr dran'
);

-- Eine verschickte Nachricht noch einmal zu verschicken wäre ein Fehler, kein Dienst.
SELECT is(
    (SELECT public.rpc_retry_notification('aaaa0000-0000-0000-0000-000000000002')),
    false,
    'Eine bereits verschickte Nachricht bleibt, wie sie ist'
);

SELECT * FROM finish();
ROLLBACK;
