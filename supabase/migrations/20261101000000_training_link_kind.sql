-- ============================================================================
-- Antwort-Link fürs Training: die neue Art von Aktions-Token
--
-- Eine eigene Datei, weil ein neuer Enum-Wert erst nach dem Commit benutzbar ist.
-- Die Funktionen, die ihn verwenden, stehen in der nächsten Migration.
-- ============================================================================

ALTER TYPE public.action_token_kind ADD VALUE IF NOT EXISTS 'training_response';
