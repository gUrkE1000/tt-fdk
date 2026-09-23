-- Benachrichtigungen: Einstellungen, Vorlagen, Aktions-Token.

BEGIN;
SELECT plan(23);

-- Die Seed-Daten legen Spieltermine an, und seit Aufgabe 4.4 erzeugt das
-- Benachrichtigungen. Für diese Datei interessiert nur, was hier entsteht.
DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- ============================================================ Vorlagen füllen
SELECT is(
    public.render_template('Hallo {{first_name}}, {{team}} spielt.',
                           '{"first_name":"Anna","team":"1. Herren"}'::jsonb),
    'Hallo Anna, 1. Herren spielt.',
    'Platzhalter werden ersetzt'
);

SELECT is(
    public.render_template('Hallo {{first_name}}{{unbekannt}}!', '{"first_name":"Anna"}'::jsonb),
    'Hallo Anna!',
    'Ein Platzhalter ohne Wert verschwindet, statt in der E-Mail zu landen'
);

SELECT is(
    public.render_template('Ohne Werte', '{}'::jsonb),
    'Ohne Werte',
    'Text ohne Platzhalter bleibt unverändert'
);

-- ============================================================ Einreihen
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    public.enqueue_notification('22222222-0000-0000-0000-000000000001', 'match_created',
        jsonb_build_object('team', '1. Herren', 'opponent', 'TTC Nachbarstadt', 'date', '05.10.2026')),
    2,
    'Ohne Einstellungszeile gehen E-Mail und App-Hinweis raus'
);

SELECT is(
    (SELECT count(*) FROM public.notifications
      WHERE profile_id = '22222222-0000-0000-0000-000000000001' AND type = 'match_created')::int,
    2,
    'und stehen im Postfach'
);

SELECT is(
    (SELECT subject FROM public.notifications
      WHERE profile_id = '22222222-0000-0000-0000-000000000001'
        AND type = 'match_created' AND channel = 'email'),
    'Neuer Spieltermin: 1. Herren gegen TTC Nachbarstadt am 05.10.2026',
    'Der Betreff ist beim Einreihen fertig gerendert'
);

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE profile_id = '22222222-0000-0000-0000-000000000001'
        AND type = 'match_created' AND channel = 'email'),
    'Hallo Anna',
    'Der Vorname kommt aus dem Profil, nicht aus dem Aufruf'
);

-- Einstellung: keine E-Mail für diesen Typ.
INSERT INTO public.notification_preferences (profile_id, type, email, push)
VALUES ('22222222-0000-0000-0000-000000000002', 'match_created', false, true);

SELECT is(
    public.enqueue_notification('22222222-0000-0000-0000-000000000002', 'match_created', '{}'::jsonb),
    1,
    'Wer E-Mails für einen Typ abbestellt hat, bekommt nur den App-Hinweis'
);

SELECT is(
    (SELECT channel::text FROM public.notifications
      WHERE profile_id = '22222222-0000-0000-0000-000000000002'),
    'push',
    'und zwar genau den'
);

SELECT is(
    public.enqueue_notification('22222222-0000-0000-0000-000000000002', 'match_created',
                                '{}'::jsonb, true),
    2,
    'Eine Direkt-E-Mail geht trotz Abbestellung raus'
);

-- Ein Typ außerhalb der Matrix ist nie abwählbar.
INSERT INTO public.notification_preferences (profile_id, type, email, push)
VALUES ('22222222-0000-0000-0000-000000000003', 'player_added', false, false);

SELECT is(
    public.enqueue_notification('22222222-0000-0000-0000-000000000003', 'player_added', '{}'::jsonb),
    1,
    'Ein Typ außerhalb der Matrix schickt die E-Mail auch gegen die Einstellung'
);

SELECT is(
    (SELECT channel::text FROM public.notifications
      WHERE profile_id = '22222222-0000-0000-0000-000000000003'),
    'email',
    'der App-Hinweis dagegen bleibt abwählbar'
);

SELECT throws_ok(
    $$ SELECT public.enqueue_notification('22222222-0000-0000-0000-000000000001', 'gibtsnicht') $$,
    '22023',
    NULL,
    'Ein unbekannter Typ wird abgewiesen'
);

-- Gelöschte Mitglieder bekommen nichts mehr.
UPDATE public.profiles SET deleted_at = NOW()
 WHERE id = '22222222-0000-0000-0000-00000000000a';

SELECT is(
    public.enqueue_notification('22222222-0000-0000-0000-00000000000a', 'match_created'),
    0,
    'Ein gelöschtes Mitglied bekommt keine Benachrichtigung mehr'
);

-- ============================================================ Kopie-Adressen
UPDATE public.profiles
   SET emails_copies = ARRAY['eltern@example.com']
 WHERE id = '22222222-1111-0000-0000-000000000001';

DO $$ BEGIN PERFORM public.enqueue_notification('22222222-1111-0000-0000-000000000001', 'match_reminder'); END $$;

SELECT is(
    (SELECT payload -> 'cc' ->> 0 FROM public.notifications
      WHERE profile_id = '22222222-1111-0000-0000-000000000001' AND channel = 'email'),
    'eltern@example.com',
    'Die Kopie-Adressen hängen an der Nachricht'
);

-- ============================================================ Aktions-Token
DO $$
BEGIN
    PERFORM public.enqueue_notification(
        '22222222-0000-0000-0000-000000000005',
        'match_created',
        jsonb_build_object(
            'action', 'match_response',
            'target_id', '55555555-0000-0000-0000-000000000001',
            'team', '1. Herren'
        )
    );
END $$;

SELECT is(
    (SELECT count(*) FROM public.action_tokens
      WHERE profile_id = '22222222-0000-0000-0000-000000000005')::int,
    1,
    'Ein Token entsteht genau einmal je Nachricht, nicht je Kanal'
);

SELECT matches(
    (SELECT body_text FROM public.notifications
      WHERE profile_id = '22222222-0000-0000-0000-000000000005' AND channel = 'email'),
    '/r/',
    'Der Antwortlink steht im Text'
);

SELECT is(
    (SELECT action::text FROM public.action_tokens
      WHERE profile_id = '22222222-0000-0000-0000-000000000005'),
    'match_response',
    'Der Token gilt für genau eine Handlung'
);

-- ============================================================ Rechte
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000002'); END $$;

SELECT is(
    (SELECT count(*) FROM public.notifications)::int,
    0,
    'Ein Mitglied sieht nur die eigenen Benachrichtigungen'
);

SELECT is(
    (SELECT count(*) FROM public.action_tokens)::int,
    0,
    'Aktions-Token sieht niemand über die API'
);

SELECT throws_ok(
    $$ INSERT INTO public.notifications (profile_id, channel, type, subject, body_text)
       VALUES (auth.uid(), 'email', 'match_created', 'Hallo', 'Text') $$,
    '42501',
    NULL,
    'Niemand schreibt direkt ins Postfach'
);

SELECT is(
    (SELECT count(*) FROM public.v_my_notification_preferences)::int,
    17,
    'Die Matrix zeigt genau die siebzehn abwählbaren Typen'
);

SELECT is(
    (SELECT email::text || '/' || push::text FROM public.v_my_notification_preferences
      WHERE type = 'match_created'),
    'true/true',
    'Ohne eigene Zeile steht alles auf an'
);

SELECT * FROM finish();
ROLLBACK;
