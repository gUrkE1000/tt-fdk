-- Kalender-Abo und „Meine Termine": Wer darf was sehen, und was steht im Feed?

BEGIN;
SELECT plan(12);

-- ============================================================ Abo-Token
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT isnt(
    (SELECT public.rpc_my_calendar_token()),
    NULL,
    'Beim ersten Aufruf entsteht ein Token'
);

SELECT is(
    (SELECT public.rpc_my_calendar_token()),
    (SELECT public.rpc_my_calendar_token()),
    'Ein zweiter Aufruf liefert denselben — sonst wäre jedes Abo nach einem Tag tot'
);

SELECT isnt(
    (SELECT public.rpc_reset_calendar_token()),
    (SELECT token FROM public.calendar_tokens
      WHERE profile_id = '22222222-1111-0000-0000-000000000001'
        AND token = '00000000-0000-0000-0000-000000000000'),
    'Neu erzeugen liefert einen anderen Wert'
);

-- Die Tabelle selbst ist für niemanden lesbar: Wer fremde Token abfragen könnte,
-- könnte fremde Kalender lesen.
SELECT is(
    (SELECT count(*) FROM public.calendar_tokens)::int,
    0,
    'Die Token-Tabelle ist über die API unsichtbar'
);

SELECT throws_ok(
    $$ INSERT INTO public.calendar_tokens (profile_id)
       VALUES ('22222222-1111-0000-0000-000000000002') $$,
    '42501',
    NULL,
    'und auch nicht beschreibbar'
);

-- ============================================================ Meine Termine
-- Spieler 01 hat zum ersten Trainingstermin zugesagt und ist im Kader der 2. Herren.
SELECT ok(
    (SELECT count(*) FROM public.v_my_upcoming
      WHERE profile_id = '22222222-1111-0000-0000-000000000001')::int > 0,
    'Meine Termine führt die eigenen Spiele, Trainings und Vereinstermine'
);

SELECT is(
    (SELECT my_status FROM public.v_my_upcoming
      WHERE profile_id = '22222222-1111-0000-0000-000000000001'
        AND kind = 'training'
        AND id = '77777777-0000-0000-0000-000000000001'),
    'yes',
    'mit dem eigenen Status'
);

SELECT is(
    (SELECT title FROM public.v_my_upcoming
      WHERE profile_id = '22222222-1111-0000-0000-000000000001'
        AND kind = 'event'
        AND id = '88888888-0000-0000-0000-000000000001'),
    'Clubmeisterschaft',
    'und dem Namen des Termins'
);

SELECT is(
    (SELECT location FROM public.v_my_upcoming
      WHERE profile_id = '22222222-1111-0000-0000-000000000001'
        AND kind = 'training'
        AND id = '77777777-0000-0000-0000-000000000001'),
    'Sporthalle Musterstadt',
    'Der Ort steht dabei, damit der Kalender ihn mitnehmen kann'
);

-- ============================================================ Kalender
SELECT ok(
    (SELECT count(*) FROM public.v_calendar_items WHERE kind = 'birthday')::int > 0,
    'Der Kalender rechnet Geburtstage aus'
);

SELECT is(
    (SELECT count(*) FROM public.v_calendar_items
      WHERE kind = 'birthday' AND id = '22222222-1111-0000-0000-000000000004')::int,
    0,
    'Wer seinen Geburtstag verbirgt, steht nicht drin'
);

-- Ein Gast sieht im Kalender nur, was er auch sonst sieht.
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000008'); END $$;

SELECT is(
    (SELECT count(*) FROM public.v_calendar_items WHERE kind = 'match')::int,
    0,
    'Ein Gast sieht keine Spieltermine — auch nicht über den Kalender'
);

SELECT * FROM finish();
ROLLBACK;
