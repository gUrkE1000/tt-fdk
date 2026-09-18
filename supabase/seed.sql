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

-- Ein paar Geburtstage, damit der Kalender auch diese Kategorie zeigt.
UPDATE public.profiles SET birthday = DATE '1988-03-14'
 WHERE id = '22222222-0000-0000-0000-000000000001';
UPDATE public.profiles SET birthday = DATE '1995-07-02'
 WHERE id = '22222222-0000-0000-0000-000000000005';
UPDATE public.profiles SET birthday = DATE '2009-11-23', hide_birthday = true
 WHERE id = '22222222-1111-0000-0000-000000000004';

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

-- ----------------------------------------------------------------- Trainings
-- Drei Trainings, die die drei Sichtbarkeitsfälle abdecken: ein normales mit
-- Zuordnung, ein offenes (auch für Gäste) und ein inkognito geführtes.
INSERT INTO public.trainings
    (id, name, type, weekday, time_start, time_end, venue_id, rhythm, start_date,
     reminder_hours, max_participants, is_open, is_incognito, active)
VALUES
    ('66666666-0000-0000-0000-000000000001', 'Erwachsenentraining', 'adults', 2,
     '19:00', '21:00', '11111111-0000-0000-0000-000000000001', 'weekly',
     CURRENT_DATE - 60, 5, NULL, false, false, true),

    ('66666666-0000-0000-0000-000000000002', 'Jugendtraining', 'youth', 4,
     '17:00', '18:30', '11111111-0000-0000-0000-000000000002', 'weekly',
     CURRENT_DATE - 60, 24, 4, false, true, true),

    ('66666666-0000-0000-0000-000000000003', 'Offenes Training', 'adults', 6,
     '10:00', '12:00', '11111111-0000-0000-0000-000000000001', 'biweekly',
     CURRENT_DATE - 60, 5, NULL, true, false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.training_trainers (training_id, profile_id) VALUES
    ('66666666-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003'),
    ('66666666-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004'),
    ('66666666-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO public.training_members (training_id, profile_id) VALUES
    ('66666666-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005'),
    ('66666666-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000001'),
    ('66666666-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000002'),
    ('66666666-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000003'),
    ('66666666-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000004'),
    ('66666666-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- Je Training ein vergangener und zwei kommende Termine, damit sich Rückblick
-- und Vorschau füllen. Der Erzeugungs-Job (Aufgabe 6.3) legt sie später selbst an.
INSERT INTO public.training_sessions
    (id, training_id, session_date, starts_at, ends_at)
VALUES
    ('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001',
     (date_trunc('day', NOW()) + INTERVAL '2 days')::date,
     date_trunc('day', NOW()) + INTERVAL '2 days 19 hours',
     date_trunc('day', NOW()) + INTERVAL '2 days 21 hours'),

    ('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001',
     (date_trunc('day', NOW()) + INTERVAL '9 days')::date,
     date_trunc('day', NOW()) + INTERVAL '9 days 19 hours',
     date_trunc('day', NOW()) + INTERVAL '9 days 21 hours'),

    ('77777777-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000001',
     (date_trunc('day', NOW()) - INTERVAL '5 days')::date,
     date_trunc('day', NOW()) - INTERVAL '5 days' + INTERVAL '19 hours',
     date_trunc('day', NOW()) - INTERVAL '5 days' + INTERVAL '21 hours'),

    ('77777777-0000-0000-0000-000000000004', '66666666-0000-0000-0000-000000000002',
     (date_trunc('day', NOW()) + INTERVAL '3 days')::date,
     date_trunc('day', NOW()) + INTERVAL '3 days 17 hours',
     date_trunc('day', NOW()) + INTERVAL '3 days 18 hours 30 minutes'),

    ('77777777-0000-0000-0000-000000000005', '66666666-0000-0000-0000-000000000003',
     (date_trunc('day', NOW()) + INTERVAL '4 days')::date,
     date_trunc('day', NOW()) + INTERVAL '4 days 10 hours',
     date_trunc('day', NOW()) + INTERVAL '4 days 12 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.training_attendance (session_id, profile_id, status, guests, source) VALUES
    ('77777777-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000001', 'yes',  1, 'self'),
    ('77777777-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000002', 'late', 0, 'self'),
    ('77777777-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000003', 'no',   0, 'self'),
    ('77777777-0000-0000-0000-000000000004', '22222222-1111-0000-0000-000000000004', 'yes',  0, 'self'),
    ('77777777-0000-0000-0000-000000000004', '22222222-1111-0000-0000-000000000005', 'late', 0, 'self')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------- Vereinstermine
-- Ein kommender Termin mit Anmeldefrist, ein ganztägiger und ein vergangener, damit
-- sich beide Reiter füllen.
INSERT INTO public.club_events
    (id, name, full_day, starts_at, ends_at, participate_until, max_participants,
     address, description_html, created_by)
VALUES
    ('88888888-0000-0000-0000-000000000001', 'Clubmeisterschaft', false,
     date_trunc('day', NOW()) + INTERVAL '21 days 10 hours',
     date_trunc('day', NOW()) + INTERVAL '21 days 18 hours',
     (CURRENT_DATE + 14), 32,
     'Turnstraße 5, 12345 Musterstadt',
     '<p>Meldung an der Halle ab <strong>9:30 Uhr</strong>.</p>',
     '22222222-0000-0000-0000-000000000002'),

    ('88888888-0000-0000-0000-000000000002', 'Sommerfest', true,
     date_trunc('day', NOW()) + INTERVAL '45 days',
     date_trunc('day', NOW()) + INTERVAL '45 days 23 hours 59 minutes',
     NULL, NULL,
     'Vereinsheim',
     '<p>Für Essen ist gesorgt.</p>',
     '22222222-0000-0000-0000-000000000002'),

    ('88888888-0000-0000-0000-000000000003', 'Jahreshauptversammlung', false,
     date_trunc('day', NOW()) - INTERVAL '30 days' + INTERVAL '19 hours',
     date_trunc('day', NOW()) - INTERVAL '30 days' + INTERVAL '21 hours',
     NULL, NULL, 'Vereinsheim', '', '22222222-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_participations (event_id, profile_id, status, guests) VALUES
    ('88888888-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000001', 'yes', 2),
    ('88888888-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000002', 'no',  0)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------- Umfragen
-- Eine offene Umfrage für den ganzen Verein, eine auf eine Gruppe begrenzte mit
-- verborgenen Ergebnissen, und eine vom Typ „Personen".
INSERT INTO public.polls (id, title, details_html, type, max_answers, expires_at, hide_results, created_by) VALUES
    ('99999999-0000-0000-0000-000000000001', 'Termin für die Weihnachtsfeier',
     '<p>Bitte alle passenden Termine ankreuzen.</p>', 'vote', 2,
     NOW() + INTERVAL '20 days', false, '22222222-0000-0000-0000-000000000002'),

    ('99999999-0000-0000-0000-000000000002', 'Neue Trikotfarbe', '', 'vote', 1,
     NULL, true, '22222222-0000-0000-0000-000000000002'),

    ('99999999-0000-0000-0000-000000000003', 'Wer hilft beim Aufbau?', '', 'persons', 1,
     NULL, false, '22222222-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Die Trikotumfrage geht nur an den Vorstand.
INSERT INTO public.poll_targets (poll_id, group_id) VALUES
    ('99999999-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO public.poll_options (id, poll_id, text, position) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Freitag, 12.12.', 0),
    ('aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'Samstag, 13.12.', 1),
    ('aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'Freitag, 19.12.', 2),
    ('aaaaaaaa-0000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000002', 'Blau', 0),
    ('aaaaaaaa-0000-0000-0000-000000000005', '99999999-0000-0000-0000-000000000002', 'Rot', 1),
    ('aaaaaaaa-0000-0000-0000-000000000006', '99999999-0000-0000-0000-000000000003', 'Ich helfe beim Aufbau', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.poll_votes (option_id, profile_id) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000001'),
    ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000001'),
    ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

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

-- ----------------------------------------------------------------- Schlüssel (9.1)
-- Zwei Schlüssel: einer unterwegs bei Spieler 01 (der zum ersten Trainingstermin
-- zugesagt hat — damit greift die Schlüsselanzeige an der Karte), einer beim
-- Verantwortlichen und ausdrücklich ohne Weitergabe.
INSERT INTO public.keys (id, name, venue_id, responsible_id, holder_id, no_forwarding) VALUES
    ('bbbbbbbb-0000-0000-0000-000000000001', 'Hallenschlüssel Sporthalle',
     '11111111-0000-0000-0000-000000000001',
     '22222222-0000-0000-0000-000000000001',
     '22222222-1111-0000-0000-000000000001', false),

    ('bbbbbbbb-0000-0000-0000-000000000002', 'Schlüssel Gymnasium',
     '11111111-0000-0000-0000-000000000002',
     '22222222-0000-0000-0000-000000000001',
     NULL, true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------- Ämter (9.6)
INSERT INTO public.club_roles (id, name, description, duties, sort_order) VALUES
    ('cccccccc-0000-0000-0000-000000000001', 'Jugendwart',
     'Kümmert sich um alles rund um die Jugendabteilung.',
     ARRAY['Training organisieren', 'Ansprechpartner für Eltern', 'Turniere melden'], 1),

    ('cccccccc-0000-0000-0000-000000000002', 'Kassier',
     'Führt die Vereinskasse.',
     ARRAY['Beiträge einziehen', 'Jahresabschluss'], 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_role_members (role_id, profile_id) VALUES
    ('cccccccc-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003'),
    ('cccccccc-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------- Neuigkeiten (9.3)
INSERT INTO public.news (id, title, body_html, published_at, pinned, author_id) VALUES
    ('dddddddd-0000-0000-0000-000000000001', 'Jahreshauptversammlung am 14. März',
     '<p>Alle Mitglieder sind herzlich eingeladen. Beginn ist um 19 Uhr im Vereinsheim.</p>',
     NOW() - INTERVAL '3 days', true, '22222222-0000-0000-0000-000000000001'),

    ('dddddddd-0000-0000-0000-000000000002', 'Neue Netze für Tisch 3 und 4',
     '<p>Der Verein hat neue Netze angeschafft. Bitte nach dem Training abbauen.</p>',
     NOW() - INTERVAL '10 days', false, '22222222-0000-0000-0000-000000000002'),

    -- Vordatiert: darf nur der Organisator sehen, bis der Zeitpunkt da ist.
    ('dddddddd-0000-0000-0000-000000000003', 'Sommerfest — Vorankündigung',
     '<p>Termin steht noch nicht fest.</p>',
     NOW() + INTERVAL '14 days', false, '22222222-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------- Vergangene Trainings (9.9)
-- Ohne Vergangenheit gibt es keine Statistik. Vier zurückliegende Termine des
-- Erwachsenentrainings mit unterschiedlicher Beteiligung — genug, um die Zahlen
-- und die Rangliste zu sehen.
INSERT INTO public.training_sessions (id, training_id, session_date, starts_at, ends_at)
SELECT
    ('7777777a-0000-0000-0000-00000000000' || n)::uuid,
    '66666666-0000-0000-0000-000000000001',
    (date_trunc('day', NOW()) - (n * 7 || ' days')::interval)::date,
    date_trunc('day', NOW()) - (n * 7 || ' days')::interval + INTERVAL '19 hours',
    date_trunc('day', NOW()) - (n * 7 || ' days')::interval + INTERVAL '21 hours'
FROM generate_series(1, 4) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.training_attendance (session_id, profile_id, status, guests, source)
VALUES
    -- Spieler 01 ist fast immer da.
    ('7777777a-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000001', 'yes',  0, 'self'),
    ('7777777a-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000001', 'yes',  0, 'self'),
    ('7777777a-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000001', 'late', 0, 'self'),
    ('7777777a-0000-0000-0000-000000000004', '22222222-1111-0000-0000-000000000001', 'yes',  0, 'self'),

    -- Spieler 02 sagt zuverlässig ab, wenn er nicht kann.
    ('7777777a-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000002', 'yes', 0, 'self'),
    ('7777777a-0000-0000-0000-000000000002', '22222222-1111-0000-0000-000000000002', 'no',  0, 'self'),
    ('7777777a-0000-0000-0000-000000000003', '22222222-1111-0000-0000-000000000002', 'no',  0, 'self'),

    -- Spieler 03 meldet sich gar nicht — das ist etwas anderes als eine Absage.
    ('7777777a-0000-0000-0000-000000000001', '22222222-1111-0000-0000-000000000003', 'yes', 0, 'self')
ON CONFLICT (session_id, profile_id) DO NOTHING;
