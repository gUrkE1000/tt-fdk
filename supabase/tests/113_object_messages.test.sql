-- Nachrichten am Termin (Aufgabe 9.2)

BEGIN;
SELECT plan(12);

-- ============================================================ Schreiben
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.object_messages (object_type, object_id, author_id, body)
       VALUES ('session', '77777777-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000001', 'Wer bringt Bälle mit?') $$,
    'Wer den Termin sieht, darf schreiben'
);

SELECT is(
    (SELECT author_name FROM public.v_object_messages
      WHERE body = 'Wer bringt Bälle mit?'),
    'Spieler 01',
    'Die Nachricht trägt den Namen des Verfassers'
);

-- Im fremden Namen geht nichts.
SELECT throws_ok(
    $$ INSERT INTO public.object_messages (object_type, object_id, author_id, body)
       VALUES ('session', '77777777-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000002', 'Nicht von mir') $$,
    '42501',
    NULL,
    'Niemand schreibt im Namen eines anderen'
);

-- Leere Nachrichten auch nicht.
SELECT throws_ok(
    $$ INSERT INTO public.object_messages (object_type, object_id, author_id, body)
       VALUES ('session', '77777777-0000-0000-0000-000000000001',
               '22222222-1111-0000-0000-000000000001', '   ') $$,
    '23514',
    NULL,
    'Eine leere Nachricht ist keine'
);

-- An einen Termin, den man nicht sieht, erst recht nicht.
SELECT throws_ok(
    $$ INSERT INTO public.object_messages (object_type, object_id, author_id, body)
       VALUES ('session', '00000000-0000-0000-0000-000000000000',
               '22222222-1111-0000-0000-000000000001', 'Ins Leere') $$,
    '42501',
    NULL,
    'und nicht an einen Termin, den es nicht gibt'
);

-- ============================================================ Zähler
SELECT is(
    (SELECT message_count FROM public.v_object_message_counts
      WHERE object_type = 'session' AND object_id = '77777777-0000-0000-0000-000000000001'),
    1,
    'Der Zähler für die Karte stimmt'
);

-- ============================================================ Gast
-- Ein Gast sieht keine Spieltermine (siehe `is_playing_member`) — also auch keine
-- Nachrichten daran.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is(
    (SELECT public.can_see_message_object('match', '55555555-0000-0000-0000-000000000001')),
    false,
    'Ein Gast sieht keine Nachrichten an Spielterminen'
);

-- ============================================================ Ändern und löschen
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000002'); END $$;

-- Eine fremde Nachricht lässt sich nicht ändern: Das UPDATE trifft keine Zeile.
DO $$
BEGIN
    UPDATE public.object_messages SET body = 'Umgeschrieben'
     WHERE body = 'Wer bringt Bälle mit?';
END $$;

SELECT is(
    (SELECT count(*) FROM public.object_messages WHERE body = 'Umgeschrieben')::int,
    0,
    'Eine fremde Nachricht ändert niemand'
);

DO $$
BEGIN
    DELETE FROM public.object_messages WHERE body = 'Wer bringt Bälle mit?';
END $$;

SELECT is(
    (SELECT count(*) FROM public.object_messages WHERE body = 'Wer bringt Bälle mit?')::int,
    1,
    'und löscht sie auch nicht'
);

-- Der Administrator darf aufräumen.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

DO $$
BEGIN
    DELETE FROM public.object_messages WHERE body = 'Wer bringt Bälle mit?';
END $$;

SELECT is(
    (SELECT count(*) FROM public.object_messages WHERE body = 'Wer bringt Bälle mit?')::int,
    0,
    'Der Administrator räumt eine entgleiste Zeile weg'
);

-- ============================================================ Benachrichtigung
DO $$
BEGIN
    PERFORM tests.as_service_role();
    DELETE FROM public.notifications;
    PERFORM tests.login_as('22222222-1111-0000-0000-000000000001');

    INSERT INTO public.object_messages (object_type, object_id, author_id, body)
    VALUES ('session', '77777777-0000-0000-0000-000000000001',
            '22222222-1111-0000-0000-000000000001', 'Ich bin später da');
END $$;

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

-- Spieler 02 hat mit „late" zugesagt und wird benachrichtigt.
SELECT ok(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'object_message'
        AND profile_id = '22222222-1111-0000-0000-000000000002')::int > 0,
    'Beteiligte werden benachrichtigt'
);

-- Der Verfasser nicht — er weiß es.
SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE type = 'object_message'
        AND profile_id = '22222222-1111-0000-0000-000000000001')::int,
    0,
    'der Verfasser selbst nicht'
);

SELECT * FROM finish();
ROLLBACK;
