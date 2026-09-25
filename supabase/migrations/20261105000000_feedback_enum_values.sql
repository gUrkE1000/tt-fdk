-- ============================================================================
-- Neue Aufzählungswerte für die Rückmeldungsrunde vom 25.09.2026
--
-- In einer eigenen Datei, weil PostgreSQL einen mit ADD VALUE ergänzten Wert
-- erst nach dem Ende der Transaktion verwenden lässt. Die Migration danach
-- (`feedback_round`) benutzt beide Werte.
--
--   training_rhythm 'once'     Training „Einmalig": genau ein Termin am Startdatum.
--   volunteer_kind  'direct'   „Ich fahre direkt" bei Auswärtsspielen: kommt nicht
--                              zum Treffpunkt, sondern direkt zur Halle.
-- ============================================================================

ALTER TYPE public.training_rhythm ADD VALUE IF NOT EXISTS 'once';
ALTER TYPE public.volunteer_kind  ADD VALUE IF NOT EXISTS 'direct';
