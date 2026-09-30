-- Kennzeichen „Schlüsseldienst" (Migration key_service_flag): Wer es hat, plant den
-- Schlüsseldienst; setzen darf es nur der Administrator.

BEGIN;
SELECT plan(6);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT throws_ok(
    $$ UPDATE public.profiles SET key_service = true
        WHERE id = '22222222-1111-0000-0000-000000000003' $$,
    '42501',
    NULL,
    'Den Schlüsseldienst gibt man sich nicht selbst'
);

SELECT throws_ok(
    $$ INSERT INTO public.key_duty_weekdays (weekday, profile_id)
       VALUES (3, '22222222-1111-0000-0000-000000000004') $$,
    '42501',
    NULL,
    'Ohne Kennzeichen vergibt man keine festen Tage'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT lives_ok(
    $$ UPDATE public.profiles SET key_service = true
        WHERE id = '22222222-1111-0000-0000-000000000003' $$,
    'Der Administrator setzt das Kennzeichen'
);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000003'); END $$;

SELECT lives_ok(
    $$ INSERT INTO public.key_duty_weekdays (weekday, profile_id)
       VALUES (3, '22222222-1111-0000-0000-000000000004') $$,
    'Mit Kennzeichen vergibt man feste Tage — an jedes aktive Mitglied'
);

SELECT lives_ok(
    $$ SELECT public.rpc_set_key_duty_override(public.berlin_today() + 10,
                                              '22222222-1111-0000-0000-000000000005') $$,
    'und trägt einzelne Tage ein, ohne selbst eingeteilt zu sein'
);

SELECT is(
    public.key_duty_for(public.berlin_today() + 10),
    '22222222-1111-0000-0000-000000000005'::uuid,
    'Der Tag hat die eingetragene Person'
);

SELECT * FROM finish();
ROLLBACK;
