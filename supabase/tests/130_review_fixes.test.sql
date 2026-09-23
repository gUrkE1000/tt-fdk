-- Korrekturen aus dem Code-Review (docs/code-review.md): Spaltenschutz, Prüfungen,
-- Umfrage, Nachrichten, Versandlauf, Cron-Secret und Löschlauf.

BEGIN;
SELECT plan(20);

-- ============================================================ Heute in Berlin (N-1)
SELECT is(
    public.berlin_today(),
    (NOW() AT TIME ZONE 'Europe/Berlin')::date,
    'berlin_today() ist das Datum in deutscher Zeit'
);

-- ============================================================ Spiele (N-3)
-- Meik führt Mannschaft 44…01, Spiel 55…01 gehört ihr.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000005'); END $$;

SELECT throws_ok(
    $$ UPDATE public.matches SET version = version + 5 WHERE id = '55555555-0000-0000-0000-000000000001' $$,
    '42501',
    NULL,
    'Ein Mannschaftsführer setzt die Fassung eines Spiels nicht von Hand'
);

SELECT throws_ok(
    $$ UPDATE public.matches SET external_uid = 'fremd' WHERE id = '55555555-0000-0000-0000-000000000001' $$,
    '42501',
    NULL,
    'Ein Mannschaftsführer ändert die Abgleichskennung nicht'
);

SELECT lives_ok(
    $$ UPDATE public.matches SET comment = 'Treffpunkt 18 Uhr' WHERE id = '55555555-0000-0000-0000-000000000001' $$,
    'Fachliche Angaben ändert der Mannschaftsführer weiterhin'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ UPDATE public.matches SET version = version + 1 WHERE id = '55555555-0000-0000-0000-000000000001' $$,
    'Der Administrator darf die Fassung setzen'
);

-- ============================================================ Profile (N-2, M-3)
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT throws_ok(
    $$ UPDATE public.profiles SET email = 'woanders@example.com' WHERE id = auth.uid() $$,
    '42501',
    NULL,
    'Ein Mitglied ändert die E-Mail nicht am Auth-Dienst vorbei'
);

SELECT throws_ok(
    $$ UPDATE public.profiles SET auth_linked_at = NULL WHERE id = auth.uid() $$,
    '42501',
    NULL,
    'Die Verknüpfung mit dem Konto ist keine Eingabe'
);

SELECT throws_ok(
    $$ UPDATE public.profiles
          SET emails_copies = ARRAY['a@x.de', 'b@x.de', 'c@x.de', 'd@x.de']
        WHERE id = auth.uid() $$,
    '23514',
    NULL,
    'Mehr als drei Kopie-Adressen nimmt die Datenbank nicht an'
);

SELECT throws_ok(
    $$ UPDATE public.profiles SET emails_copies = ARRAY['keine-adresse'] WHERE id = auth.uid() $$,
    '23514',
    NULL,
    'Eine Kopie-Adresse muss wie eine E-Mail-Adresse aussehen'
);

SELECT lives_ok(
    $$ UPDATE public.profiles SET emails_copies = ARRAY['eltern@example.com'] WHERE id = auth.uid() $$,
    'Eine gültige Kopie-Adresse geht'
);

SELECT throws_ok(
    $$ INSERT INTO public.push_subscriptions (profile_id, endpoint, p256dh, auth)
       VALUES (auth.uid(), 'https://intern.example/hook', 'k', 'a') $$,
    '23514',
    NULL,
    'Ein Push-Endpunkt muss zu einem bekannten Push-Dienst gehören'
);

-- ============================================================ Umfrage (N-9)
-- Umfrage 99…01 erlaubt zwei Antworten.
SELECT is(
    public.rpc_vote_poll(ARRAY[
        'aaaaaaaa-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001'
    ]::UUID[]) ->> 'count',
    '1',
    'Eine doppelt geschickte Option zählt einmal'
);

SELECT is(
    public.rpc_vote_poll(ARRAY[
        'aaaaaaaa-0000-0000-0000-000000000001',
        gen_random_uuid()
    ]) ->> 'status',
    'unknown_option',
    'Eine unbekannte Option führt zu einer Auskunft statt zu einem Fehler'
);

-- ============================================================ Nachrichten (N-4)
INSERT INTO public.object_messages (object_type, object_id, author_id, body)
VALUES ('session', '77777777-0000-0000-0000-000000000001',
        '22222222-1111-0000-0000-000000000001', 'Umzugskandidat');

SELECT throws_ok(
    $$ UPDATE public.object_messages SET object_id = gen_random_uuid()
        WHERE body = 'Umzugskandidat' $$,
    '42501',
    NULL,
    'Eine Nachricht lässt sich nicht an ein Objekt hängen, das man nicht sieht'
);

-- ============================================================ Rollen-Helfer (N-9)
DO $$
BEGIN
    PERFORM tests.create_auth_user('22222222-0000-0000-0000-000000000009', 'petra.pending@example.com');
    PERFORM tests.login_as('22222222-0000-0000-0000-000000000009');
END $$;

SELECT is(
    public.current_member_role(),
    NULL,
    'Wer auf Freischaltung wartet, hat noch keine wirksame Rolle'
);

-- ============================================================ Versandlauf (M-1)
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
RESET ROLE;

INSERT INTO public.notifications (profile_id, channel, type, subject, body_text, payload, scheduled_for)
VALUES ('22222222-1111-0000-0000-000000000001', 'email', 'welcome', 'Test', 'Text', '{}', NOW() - INTERVAL '1 minute');

SELECT cmp_ok(
    (SELECT count(*) FROM public.claim_notifications(1000))::int, '>=', 1,
    'Der erste Lauf beansprucht die fällige Nachricht'
);

SELECT is(
    (SELECT count(*) FROM public.claim_notifications(1000))::int,
    0,
    'Ein zweiter, überlappender Lauf bekommt sie nicht noch einmal'
);

-- ============================================================ Cron-Secret (H-3)
UPDATE private.cron_config SET value = 'sehr-geheim' WHERE key = 'cron_secret';

SELECT ok(public.verify_cron_secret('sehr-geheim'), 'Das richtige Cron-Secret wird erkannt');
SELECT ok(NOT public.verify_cron_secret('geraten'), 'Ein falsches Cron-Secret nicht');

-- ============================================================ Löschlauf (M-4)
INSERT INTO public.profiles (id, first_name, last_name, email, status, deleted_at)
VALUES ('22222222-9999-0000-0000-000000000001', 'Weg', 'Gewesen', 'weg@example.com',
        'active', NOW() - INTERVAL '90 days');
SELECT tests.create_auth_user('22222222-9999-0000-0000-000000000001', 'weg@example.com');

SELECT public.run_retention();

SELECT is(
    (SELECT count(*) FROM auth.users WHERE id = '22222222-9999-0000-0000-000000000001')::int,
    0,
    'Nach der Frist verschwindet auch der Auth-Benutzer'
);

SELECT * FROM finish();
ROLLBACK;
