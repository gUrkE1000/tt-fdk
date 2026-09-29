-- Globale Suche (docs/suche.md): Die Suche findet genau, was das Mitglied auch auf den
-- Seiten sehen würde. Jeder Fall mit positivem und negativem Gegenstück.
--
-- Personen aus dem Seed:
--   …0001 Anna Admin (admin, Vorstand, Kassier, 1. Herren)
--   …0002 Olaf Organisator (organizer, Vorstand)
--   …0003 Tina Trainerin (trainer, Jugendwart)
--   …0008 Gustav Gast (guest)
--   …0009 Petra Pending (pending_approval)
--   1111…0001 Spieler 01 (member, 2. Herren, Erwachsenentraining)
--   1111…0004/0005 Spieler 04/05 (Jugendtraining, inkognito)

BEGIN;
SELECT plan(44);

-- ============================================================ Vorbereitung
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

-- Kontaktdaten: Spieler 02 gibt sie frei, Spieler 03 nicht.
UPDATE public.profiles SET contact_visible = true,  mobile_phone = '0171 5550202'
 WHERE id = '22222222-1111-0000-0000-000000000002';
UPDATE public.profiles SET contact_visible = false, mobile_phone = '0171 5550303',
       member_number = 'M-4711'
 WHERE id = '22222222-1111-0000-0000-000000000003';

-- Schreibweisen: Umlaut und Klang.
UPDATE public.profiles SET last_name = 'Müller' WHERE id = '22222222-1111-0000-0000-000000000006';
UPDATE public.profiles SET last_name = 'Meier'  WHERE id = '22222222-1111-0000-0000-000000000007';

-- Ein gelöschtes Konto.
UPDATE public.profiles SET last_name = 'Geloescht', deleted_at = NOW()
 WHERE id = '22222222-1111-0000-0000-000000000020';

-- Ein privater Abwesenheitsgrund.
INSERT INTO public.absences (profile_id, start_date, end_date, comment_private)
VALUES ('22222222-1111-0000-0000-000000000001', CURRENT_DATE + 30, CURRENT_DATE + 40,
        'Knieoperation');

-- Eine Mitteilung an Spieler 01, je Kanal eine Zeile.
INSERT INTO public.notifications (profile_id, channel, type, subject, body_text, status, scheduled_for)
VALUES
    ('22222222-1111-0000-0000-000000000001', 'email', 'welcome', 'Xylophonkonzert', 'Text', 'sent', NOW() - INTERVAL '1 hour'),
    ('22222222-1111-0000-0000-000000000001', 'push',  'welcome', 'Xylophonkonzert', 'Text', 'sent', NOW() - INTERVAL '1 hour');

-- Je eine Nachricht am Spiel der 2. Herren (Spieler 01 gehört dazu) und der 1. Herren
-- (gehört er nicht).
INSERT INTO public.object_messages (object_type, object_id, author_id, body)
VALUES ('match', '55555555-0000-0000-0000-000000000003',
        '22222222-0000-0000-0000-000000000006', 'Wer bringt die Zelluloidbälle mit?'),
       ('match', '55555555-0000-0000-0000-000000000001',
        '22222222-0000-0000-0000-000000000005', 'Treffpunkt Parkplatz Kiefernweg');

-- Petra (wartet auf Freischaltung) bekommt ein Konto zum Anmelden.
SELECT tests.create_auth_user('22222222-0000-0000-0000-000000000009', 'petra.pending@example.com');

-- ============================================================ Aufruf
DO $$ BEGIN PERFORM tests.logout(); END $$;
SELECT throws_ok(
    $$ SELECT * FROM public.rpc_search('herren') $$,
    '42501', NULL,
    'Ohne Anmeldung gibt es keine Suche'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000009'); END $$;
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('herren') $$,
    'Wer noch nicht freigeschaltet ist, findet nichts'
);

-- ============================================================ Mitglied
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is_empty($$ SELECT * FROM public.rpc_search('a') $$, 'Ein Zeichen ist keine Suche');
SELECT is_empty($$ SELECT * FROM public.rpc_search('   ') $$, 'Leere Eingabe: nichts');

SELECT is(
    (SELECT target FROM public.rpc_search('nachbar') WHERE kind = 'match'),
    '/match/55555555-0000-0000-0000-000000000001',
    'Wortanfang findet das Spiel gegen den TTC Nachbarstadt'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('borrusia nachbarstat') WHERE kind = 'match')
    OR EXISTS (SELECT 1 FROM public.rpc_search('nachbarstat') WHERE kind = 'match'),
    'Tippfehler werden verziehen'
);

SELECT results_eq(
    $$ SELECT kind, title FROM public.rpc_search('h2') ORDER BY kind $$,
    $$ VALUES ('match'::TEXT, '2. Herren – SV Musterdorf'::TEXT), ('team', '2. Herren') $$,
    '„H2" findet die 2. Herren und ihr Spiel'
);

SELECT is(
    (SELECT count(*)::INT FROM public.rpc_search('herren heim') WHERE kind = 'match'),
    3,
    'Mehrere Wörter: alle müssen passen (drei Heimspiele)'
);

SELECT ok(
    (SELECT mine FROM public.rpc_search('musterdorf') WHERE kind = 'match')
    AND (SELECT my_status FROM public.rpc_search('musterdorf') WHERE kind = 'match') = 'none',
    'Das Spiel der eigenen Mannschaft ist „meins", die Rückmeldung fehlt noch'
);

SELECT ok(
    NOT (SELECT can_manage FROM public.rpc_search('musterdorf') WHERE kind = 'match'),
    'Ein Mitglied darf das Spiel nicht verwalten'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('mueller') WHERE title = 'Spieler Müller')
    AND EXISTS (SELECT 1 FROM public.rpc_search('MÜLLER') WHERE title = 'Spieler Müller')
    AND EXISTS (SELECT 1 FROM public.rpc_search('muller') WHERE title = 'Spieler Müller'),
    'Umlaute: Müller = Mueller = MÜLLER ≈ Muller'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('mayer') WHERE title = 'Spieler Meier'),
    'Klang: Mayer findet Meier'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('kasse') WHERE kind = 'office' AND title = 'Kassier'),
    'Ämter: „kasse" findet den Kassier'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('trainings') WHERE kind = 'training'),
    'Endungen: „trainings" findet Trainings'
);

-- ---------------------------------------------------------- Kontaktdaten
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('5550303') $$,
    'Eine nicht freigegebene Nummer findet niemanden'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('5550202') $$,
    'Auch eine freigegebene Nummer ist kein Suchfeld (keine Rückwärtssuche)'
);
SELECT is(
    (SELECT meta ->> 'mobile_phone' FROM public.rpc_search('spieler 02') WHERE kind = 'member'),
    '0171 5550202',
    'Angezeigt wird die freigegebene Nummer'
);
SELECT is(
    (SELECT meta ->> 'mobile_phone' FROM public.rpc_search('spieler 03') WHERE kind = 'member'),
    NULL,
    'Die nicht freigegebene nicht'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('spieler03 example') $$,
    'E-Mail ist für Mitglieder kein Suchfeld'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('4711') $$,
    'Mitgliedsnummer auch nicht'
);

-- ---------------------------------------------------------- Verborgenes
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('knieoperation') $$,
    'Abwesenheitsgründe sind nicht durchsuchbar'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('geloescht') $$,
    'Gelöschte Konten findet niemand'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('spieler 04') WHERE kind <> 'member' $$,
    'Personensuche verrät keine Teilnahme am Inkognito-Training'
);
SELECT ok(
    (SELECT concat(subtitle, meta::TEXT) FROM public.rpc_search('spieler 04') WHERE kind = 'member')
        NOT ILIKE '%jugend%',
    '… auch nicht in der Trefferzeile'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('trikot') $$,
    'Eine Umfrage an eine fremde Gruppe findet man nicht'
);
SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('weihnachtsfeier') WHERE kind = 'poll'),
    'Eine Umfrage an den ganzen Verein schon'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('spieler 01') WHERE kind = 'poll' $$,
    'Stimmen sind nicht durchsuchbar'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('vorankuendigung') $$,
    'Eine vordatierte Neuigkeit findet ein Mitglied nicht'
);
SELECT is(
    (SELECT count(*)::INT FROM public.rpc_search('xylophonkonzert') WHERE kind = 'notification'),
    1,
    'Die eigene Mitteilung, einmal statt je Kanal'
);
SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('zelluloidbaelle') WHERE kind = 'message'),
    'Nachrichten am Spiel der eigenen Mannschaft sind durchsuchbar'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('kiefernweg') $$,
    'Nachrichten an Spielen, die man nicht sieht, nicht'
);

-- ---------------------------------------------------------- Zeitraum
SELECT is(
    (SELECT array_agg(DISTINCT kind ORDER BY kind)
       FROM public.rpc_search('', NULL, now(), now() + INTERVAL '10 days')),
    ARRAY['match', 'session']::TEXT[],
    'Reine Zeitfrage: nur Termine, einzelne Trainingstermine inklusive'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('spieler', NULL, now(), now() + INTERVAL '10 days') $$,
    'Mit Zeitraum kommen keine Personen'
);

-- ============================================================ Gast
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('herren') WHERE kind IN ('team', 'match') $$,
    'Ein Gast findet weder Mannschaften noch Spiele'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('spieler') WHERE kind = 'member' $$,
    'Ein Gast findet keine Mitspieler'
);
SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('tina') WHERE kind = 'member'),
    'aber Trainer'
);
SELECT results_eq(
    $$ SELECT title FROM public.rpc_search('training') WHERE kind = 'training' $$,
    $$ VALUES ('Offenes Training'::TEXT) $$,
    'Ein Gast findet nur offene Trainings'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('zelluloidbaelle') $$,
    'und keine Nachrichten an Spielen'
);

-- Treffer ⊆ Sichtbares
SELECT is_empty(
    $$ SELECT id FROM public.rpc_search('spieler trainer admin', ARRAY['member'], NULL, NULL, 50)
       EXCEPT SELECT id FROM public.v_members_directory $$,
    'Jeder gefundene Mensch steht auch im Verzeichnis des Gasts'
);

-- ============================================================ Organisator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000002'); END $$;

SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('vorankuendigung') WHERE kind = 'news'),
    'Der Organisator findet die vordatierte Neuigkeit'
);

-- ============================================================ Administrator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT title FROM public.rpc_search('4711') WHERE kind = 'member'),
    'Spieler 03',
    'Der Admin sucht auch nach Mitgliedsnummer'
);
SELECT ok(
    EXISTS (SELECT 1 FROM public.rpc_search('trikot') WHERE kind = 'poll'),
    'und findet jede Umfrage'
);
SELECT is_empty(
    $$ SELECT * FROM public.rpc_search('xylophonkonzert') $$,
    'Fremde Mitteilungen findet auch der Admin nicht'
);
SELECT ok(
    (SELECT can_manage FROM public.rpc_search('musterdorf') WHERE kind = 'match'),
    'Der Admin darf jedes Spiel verwalten'
);

SELECT * FROM finish();
ROLLBACK;
