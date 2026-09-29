-- ============================================================================
-- Dauerzusage und automatische Absage entfernt
--
-- Seit Trainings standardmäßig nicht mehr nach Zu- oder Absage fragen
-- (20261113000000_training_collect_attendance.sql), laufen zwei Automatiken ins
-- Leere und fallen weg:
--
--   1. Die Dauerzusage (`training_auto_attendance`, Aufgabe 6.7): Wer nicht gefragt
--      wird, muss auch nicht im Voraus antworten. Die Tabelle geht mit ihrem Trigger
--      und ihrer Policy; der Job `generate-training-sessions` setzt keine Zusagen mehr.
--      Bereits gesetzte Zusagen (Quelle `auto`) bleiben als Rückmeldung stehen.
--   2. „Training automatisch absagen, wenn alle Trainer abgesagt haben"
--      (`auto_cancel_no_trainers`): Ohne Abfrage sagt kein Trainer ab. Einen Termin
--      sagt der Trainer über einen Ausfall ab.
-- ============================================================================

DROP TRIGGER IF EXISTS training_attendance_auto_cancel ON public.training_attendance;
DROP FUNCTION IF EXISTS public.check_trainers_cancelled();

ALTER TABLE public.trainings DROP COLUMN IF EXISTS auto_cancel_no_trainers;

DROP TABLE IF EXISTS public.training_auto_attendance;
