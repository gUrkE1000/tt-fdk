-- Kalender „Für mich relevant": Welche Spiele gehören einem selbst?
-- Anna Admin spielt in der 1. Mannschaft, nicht in der 2. (Spiel …03).

BEGIN;
SELECT plan(6);

-- ============================================================ Administrator
DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'match' AND id = '55555555-0000-0000-0000-000000000003'),
    false,
    'Ein Spiel einer fremden Mannschaft ist für den Administrator nicht „für mich relevant"'
);

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'match' AND id = '55555555-0000-0000-0000-000000000001'),
    true,
    'ein Spiel der eigenen Mannschaft schon'
);

SELECT is(
    (SELECT count(*) FROM public.v_calendar_items WHERE kind = 'match')::int,
    (SELECT count(*) FROM public.matches)::int,
    'Sehen darf er weiterhin alle Spiele'
);

-- ============================================================ Ersatzanfrage
DO $$ BEGIN PERFORM tests.as_service_role(); END $$;
INSERT INTO public.substitute_requests (match_id, match_version, profile_id, expires_at)
SELECT id, version, '22222222-0000-0000-0000-000000000001', NOW() + INTERVAL '1 day'
  FROM public.matches WHERE id = '55555555-0000-0000-0000-000000000003';

DO $$ BEGIN PERFORM tests.login_as('22222222-0000-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'match' AND id = '55555555-0000-0000-0000-000000000003'),
    true,
    'Mit einer Ersatzanfrage gehört das Spiel dazu'
);

-- ============================================================ Spieler
DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'match' AND id = '55555555-0000-0000-0000-000000000003'),
    true,
    'Für einen Spieler der 2. Mannschaft ist deren Spiel relevant'
);

SELECT is(
    (SELECT mine FROM public.v_calendar_items
      WHERE kind = 'match' AND id = '55555555-0000-0000-0000-000000000001'),
    false,
    'ein Spiel der 1. Mannschaft nicht'
);

SELECT * FROM finish();
ROLLBACK;
