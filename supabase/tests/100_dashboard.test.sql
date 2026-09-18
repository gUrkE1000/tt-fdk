-- Übersicht: die Quicklink-Einstellung (Aufgabe 8.1)

BEGIN;
SELECT plan(3);

DO $$ BEGIN PERFORM tests.login_as('22222222-1111-0000-0000-000000000001'); END $$;

SELECT is(
    (SELECT value FROM public.club_settings WHERE key = 'quicklinks_json'),
    '[]',
    'Die Quicklinks stehen als leeres JSON-Array bereit'
);

-- Jedes Mitglied sieht sie — sie stehen auf der Startseite.
SELECT is(
    (SELECT count(*) FROM public.club_settings WHERE key = 'quicklinks_json')::int,
    1,
    'und sind für jedes Mitglied lesbar'
);

-- Pflegen darf sie nur der Administrator. Ein Link in einer Einstellung, die jeder
-- ändern kann, wäre ein Link, den jeder auf der Startseite aller austauschen könnte.
--
-- Geprüft wird die Wirkung, nicht eine Fehlermeldung: Ein UPDATE, das an der Policy
-- vorbeiläuft, trifft einfach keine Zeile und meldet nichts.
DO $$
BEGIN
    UPDATE public.club_settings
       SET value = '[{"label":"x","url":"https://example.org"}]'
     WHERE key = 'quicklinks_json';
END $$;

SELECT is(
    (SELECT value FROM public.club_settings WHERE key = 'quicklinks_json'),
    '[]',
    'ein Mitglied kann sie nicht ändern'
);

SELECT * FROM finish();
ROLLBACK;
