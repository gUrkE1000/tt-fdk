-- ============================================================================
-- Zustand „wird versendet" (Code-Review M-1)
--
-- Eigene Migration, weil ein neuer Enum-Wert erst nach dem Commit benutzt werden
-- darf. Verwendet wird er in der folgenden Migration (claim_notifications).
-- ============================================================================

ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'sending' AFTER 'pending';
