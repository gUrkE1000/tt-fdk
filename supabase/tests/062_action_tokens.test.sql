-- Antworten über den Link aus der E-Mail, ohne Anmeldung.

BEGIN;
SELECT plan(14);

DELETE FROM public.notifications;
DELETE FROM public.action_tokens;

-- Ein Token für Tina zum ersten Spiel.
INSERT INTO public.action_tokens (token, profile_id, action, target_id, expires_at) VALUES
    ('77777777-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003',
     'match_response', '55555555-0000-0000-0000-000000000001', NOW() + INTERVAL '10 days'),
    ('77777777-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000006',
     'match_response', '55555555-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day'),
    ('77777777-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000005',
     'match_response', '55555555-0000-0000-0000-000000000001', NOW() + INTERVAL '10 days');

UPDATE public.action_tokens SET used_at = NOW()
 WHERE token = '77777777-0000-0000-0000-000000000003';

-- ============================================================ ohne Anmeldung
DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(
    public.rpc_describe_action_token('77777777-0000-0000-0000-000000000001') ->> 'status',
    'ok',
    'Ein gültiger Token lässt sich ohne Anmeldung beschreiben'
);

SELECT matches(
    public.rpc_describe_action_token('77777777-0000-0000-0000-000000000001') ->> 'summary',
    'TTC Nachbarstadt',
    'und nennt, worum es geht'
);

-- Die Token selbst sieht nur die Systemrolle; für Angemeldete wie für Anonyme
-- sind sie unsichtbar.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT count(*) FROM public.action_tokens WHERE used_at IS NOT NULL)::int,
    1,
    'Das Beschreiben verbraucht den Token nicht'
);

DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(
    public.rpc_answer_action_token('77777777-0000-0000-0000-000000000001', 'yes') ->> 'status',
    'ok',
    'Die Zusage über den Link wird angenommen'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT response::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    'yes',
    'und steht in der Beteiligung'
);

SELECT is(
    (SELECT source::text FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    'link',
    'mit dem Vermerk, dass sie über den Link kam'
);

SELECT is(
    (SELECT lineup_position FROM public.match_participations
      WHERE match_id = '55555555-0000-0000-0000-000000000001'
        AND profile_id = '22222222-0000-0000-0000-000000000003'),
    1,
    'Die Aufstellung wird dabei neu berechnet'
);

SELECT is(
    (SELECT count(*) FROM public.match_changes
      WHERE change_type = 'response_by_link')::int,
    1,
    'Der Vorgang steht im Prüfprotokoll'
);

-- ============================================================ Grenzfälle
DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(
    public.rpc_answer_action_token('77777777-0000-0000-0000-000000000001', 'no') ->> 'status',
    'used',
    'Ein zweites Mal geht derselbe Token nicht'
);

SELECT is(
    public.rpc_answer_action_token('77777777-0000-0000-0000-000000000002', 'yes') ->> 'status',
    'expired',
    'Ein abgelaufener Token wird abgewiesen'
);

SELECT is(
    public.rpc_answer_action_token('77777777-0000-0000-0000-000000000003', 'yes') ->> 'status',
    'used',
    'Ein bereits benutzter ebenfalls'
);

SELECT is(
    public.rpc_answer_action_token('99999999-9999-9999-9999-999999999999', 'yes') ->> 'status',
    'unknown',
    'Ein erfundener Token führt zu nichts'
);

-- Eine unsinnige Antwort ändert nichts und verbraucht den Token nicht.
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

INSERT INTO public.action_tokens (token, profile_id, action, target_id, expires_at)
VALUES ('77777777-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004',
        'match_response', '55555555-0000-0000-0000-000000000001', NOW() + INTERVAL '10 days');

DO $$ BEGIN PERFORM tests.logout(); END $$;

SELECT is(
    public.rpc_answer_action_token('77777777-0000-0000-0000-000000000004', 'vielleicht') ->> 'status',
    'invalid_answer',
    'Eine unsinnige Antwort wird abgewiesen'
);

DO $$ BEGIN PERFORM tests.as_service_role(); END $$;

SELECT is(
    (SELECT used_at IS NULL FROM public.action_tokens
      WHERE token = '77777777-0000-0000-0000-000000000004'),
    true,
    'und verbraucht den Token nicht'
);

SELECT * FROM finish();
ROLLBACK;
