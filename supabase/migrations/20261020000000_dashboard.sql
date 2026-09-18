-- ============================================================================
-- Übersicht (Aufgabe 8.1)
--
-- Die Kacheln und Reiter des Dashboards rechnen aus dem, was schon da ist:
-- `v_my_upcoming` (Aufgabe 7.4), `v_open_participations` (4.5) und die Listen
-- der Spiele und Trainings. Eine eigene View braucht es dafür nicht.
--
-- Neu ist nur eine Einstellung: die Quicklinks. Der TT-Planer verlinkt unter der
-- Übersicht „Tabelle & Spielplan", „TTR-Rechner" und „Vereinsrangliste" — alles
-- Adressen bei myTischtennis, die für jeden Verein anders lauten. Fest verdrahtet
-- zeigten sie auf einen fremden Verein; deshalb pflegt sie der Administrator.
--
-- Format: ein JSON-Array aus Objekten `{"label": "...", "url": "..."}`. Ein Array
-- statt drei Schlüsseln, weil der Verein auch einen vierten Link haben darf.
-- ============================================================================

INSERT INTO public.club_settings (key, value) VALUES
    ('quicklinks_json', '[]')
ON CONFLICT (key) DO NOTHING;
