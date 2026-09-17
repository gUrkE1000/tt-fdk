-- Seed-Daten für die lokale Entwicklung.
--
-- Läuft NIE gegen Produktion: `scripts/local-db.sh reset` spielt die Datei nach den
-- Migrationen ein, `supabase db push` fasst sie nicht an.
--
-- Die Namen sind erkennbar fiktiv. Alle E-Mails auf example.com, damit selbst ein
-- versehentlicher Versand niemanden erreicht.

-- ----------------------------------------------------------------- Verein
UPDATE public.club_settings SET value = 'TTC Musterstadt'   WHERE key = 'club_name';
UPDATE public.club_settings SET value = 'TTC Musterstadt'   WHERE key = 'club_short_name';
UPDATE public.club_settings SET value = 'musterstadt,ttc musterstadt' WHERE key = 'club_aliases';
UPDATE public.club_settings SET value = 'NW'                WHERE key = 'bundesland';
UPDATE public.club_settings SET value = 'http://localhost:5173' WHERE key = 'app_url';
UPDATE public.club_settings SET value = 'TESTCODE'          WHERE key = 'registration_code';

-- ----------------------------------------------------------------- Orte
INSERT INTO public.venues (id, name, address, postal_code, city, max_games) VALUES
    ('11111111-0000-0000-0000-000000000001', 'Sporthalle Musterstadt', 'Turnstraße 5', '12345', 'Musterstadt', 2),
    ('11111111-0000-0000-0000-000000000002', 'Gymnasium Musterstadt',  'Schulweg 12',  '12345', 'Musterstadt', 1)
ON CONFLICT (id) DO NOTHING;

UPDATE public.club_settings
   SET value = '11111111-0000-0000-0000-000000000001'
 WHERE key = 'default_venue_id';

-- ----------------------------------------------------------------- Mitglieder
-- Rollen sind so verteilt, dass jede Rolle mindestens einmal vorkommt und die
-- Rechteprüfung im Alltag auffällt.
INSERT INTO public.profiles (id, first_name, last_name, email, role, status, qttr, gender) VALUES
    ('22222222-0000-0000-0000-000000000001', 'Anna',    'Admin',      'anna.admin@example.com',    'admin',       'active', 1620, 'female'),
    ('22222222-0000-0000-0000-000000000002', 'Olaf',    'Organisator','olaf.orga@example.com',     'organizer',   'active', 1450, 'male'),
    ('22222222-0000-0000-0000-000000000003', 'Tina',    'Trainerin',  'tina.trainer@example.com',  'trainer',     'active', 1710, 'female'),
    ('22222222-0000-0000-0000-000000000004', 'Theo',    'Trainer',    'theo.trainer@example.com',  'trainer',     'active', 1530, 'male'),
    ('22222222-0000-0000-0000-000000000005', 'Meik',    'Mannschaft', 'meik.mf@example.com',       'team_leader', 'active', 1680, 'male'),
    ('22222222-0000-0000-0000-000000000006', 'Mara',    'Mannschaft', 'mara.mf@example.com',       'team_leader', 'active', 1585, 'female'),
    ('22222222-0000-0000-0000-000000000007', 'Mike',    'Mannschaft', 'mike.mf@example.com',       'team_leader', 'active', 1440, 'male'),
    ('22222222-0000-0000-0000-000000000008', 'Gustav',  'Gast',       'gustav.gast@example.com',   'guest',       'active', NULL, 'male'),
    ('22222222-0000-0000-0000-000000000009', 'Petra',   'Pending',    'petra.pending@example.com', 'member',      'pending_approval', NULL, 'female'),
    ('22222222-0000-0000-0000-00000000000a', 'Uwe',     'Uneingeladen','uwe.unconfirmed@example.com','member',    'unconfirmed', 1390, 'male')
ON CONFLICT (id) DO NOTHING;

-- 20 einfache Mitglieder
INSERT INTO public.profiles (id, first_name, last_name, email, role, status, qttr)
SELECT
    ('22222222-1111-0000-0000-' || LPAD(i::text, 12, '0'))::uuid,
    'Spieler',
    LPAD(i::text, 2, '0'),
    'spieler' || LPAD(i::text, 2, '0') || '@example.com',
    'member',
    'active',
    1200 + i * 17
FROM generate_series(1, 20) AS i
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------- Ränge
-- Mannschaft 1 und 2 mit je vier Positionen, Mannschaft 3 mit vier weiteren.
INSERT INTO public.member_rankings (profile_id, ranking_type, team_number, position_number) VALUES
    ('22222222-0000-0000-0000-000000000003', 'men', 1, 1),
    ('22222222-0000-0000-0000-000000000005', 'men', 1, 2),
    ('22222222-0000-0000-0000-000000000001', 'men', 1, 3),
    ('22222222-0000-0000-0000-000000000006', 'men', 1, 4),
    ('22222222-0000-0000-0000-000000000004', 'men', 2, 1),
    ('22222222-0000-0000-0000-000000000002', 'men', 2, 2),
    ('22222222-0000-0000-0000-000000000007', 'men', 2, 3),
    ('22222222-1111-0000-0000-000000000001', 'men', 2, 4),
    ('22222222-1111-0000-0000-000000000002', 'men', 3, 1),
    ('22222222-1111-0000-0000-000000000003', 'men', 3, 2),
    ('22222222-1111-0000-0000-000000000004', 'men', 3, 3),
    ('22222222-1111-0000-0000-000000000005', 'men', 3, 4)
ON CONFLICT (profile_id, ranking_type) DO NOTHING;

-- ----------------------------------------------------------------- Gruppen
INSERT INTO public.groups (id, name) VALUES
    ('33333333-0000-0000-0000-000000000001', 'Jugend'),
    ('33333333-0000-0000-0000-000000000002', 'Hobby'),
    ('33333333-0000-0000-0000-000000000003', 'Vorstand')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.group_members (group_id, profile_id) VALUES
    ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001'),
    ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002'),
    ('33333333-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000010'),
    ('33333333-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000011')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------- Mannschaften
-- Drei 4er-Mannschaften. Meik führt die erste, Mara die zweite, Mike die dritte.
INSERT INTO public.teams (id, name, size, ranking_type, ranking, leagues, sort_order) VALUES
    ('44444444-0000-0000-0000-000000000001', '1. Herren', 4, 'men', 1, ARRAY['Bezirksliga'],    1),
    ('44444444-0000-0000-0000-000000000002', '2. Herren', 4, 'men', 2, ARRAY['Kreisliga'],      2),
    ('44444444-0000-0000-0000-000000000003', '3. Herren', 4, 'men', 3, ARRAY['Kreisklasse A'],  3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_leaders (team_id, profile_id) VALUES
    ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005'),
    ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000006'),
    ('44444444-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- Stammspieler in der Reihenfolge ihrer Ränge, dazu je zwei Ersatzspieler.
INSERT INTO public.team_members (team_id, profile_id, kind, rank) VALUES
    ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004', 'substitute', 1),
    ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'substitute', 2),

    ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000007', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000001', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000002', 'substitute', 1),

    ('44444444-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000002', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000003', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000004', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000005', 'regular',    NULL),
    ('44444444-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000006', 'substitute', 1)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------- Spieltermine
-- Zwei kommende Heimspiele, ein Auswärtsspiel und ein vergangenes, damit sich beide
-- Reiter der Terminliste füllen. Die Zeiten sind relativ zu heute, damit der Seed
-- nicht mit der Zeit veraltet.
INSERT INTO public.matches
    (id, team_id, source, summary, opponent, league, is_home, venue_id,
     dtstart_external, dtend_external, matchday)
VALUES
    ('55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'manual',
     '1. Herren - TTC Nachbarstadt', 'TTC Nachbarstadt', 'Bezirksliga', true,
     '11111111-0000-0000-0000-000000000001',
     date_trunc('day', NOW()) + INTERVAL '7 days 19 hours',
     date_trunc('day', NOW()) + INTERVAL '7 days 23 hours', 5),

    ('55555555-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', 'manual',
     'TSV Beispieldorf - 1. Herren', 'TSV Beispieldorf', 'Bezirksliga', false, NULL,
     date_trunc('day', NOW()) + INTERVAL '14 days 19 hours 30 minutes',
     date_trunc('day', NOW()) + INTERVAL '14 days 23 hours 30 minutes', 6),

    ('55555555-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000002', 'manual',
     '2. Herren - SV Musterdorf', 'SV Musterdorf', 'Kreisliga', true,
     '11111111-0000-0000-0000-000000000002',
     date_trunc('day', NOW()) + INTERVAL '8 days 20 hours',
     date_trunc('day', NOW()) + INTERVAL '8 days 23 hours 59 minutes', 5),

    ('55555555-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000001', 'manual',
     '1. Herren - SC Altstadt', 'SC Altstadt', 'Bezirksliga', true,
     '11111111-0000-0000-0000-000000000001',
     date_trunc('day', NOW()) - INTERVAL '7 days' + INTERVAL '19 hours',
     date_trunc('day', NOW()) - INTERVAL '7 days' + INTERVAL '23 hours', 4)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------- Auth-Benutzer
-- Verknüpft die wichtigsten Profile mit einem Auth-Benutzer, damit tests.login_as
-- und die Anwendung lokal etwas zum Anmelden haben. In Supabase legt diese Zeilen
-- der Auth-Dienst an; hier schreiben wir sie direkt, ohne den Trigger auszulösen
-- (die Profile existieren ja bereits und tragen dieselbe id).
SET session_replication_role = replica;

INSERT INTO auth.users (id, email)
SELECT id, email FROM public.profiles
 WHERE email IS NOT NULL AND status = 'active'
ON CONFLICT (id) DO NOTHING;

SET session_replication_role = origin;

UPDATE public.profiles
   SET auth_linked_at = NOW()
 WHERE id IN (SELECT id FROM auth.users);
