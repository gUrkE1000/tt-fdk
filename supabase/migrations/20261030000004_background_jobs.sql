-- ============================================================================
-- Hintergrundläufe (Code-Review M-1, H-3)
--
--   1. claim_notifications(): Nachrichten atomar beanspruchen, damit zwei
--      überlappende Versandläufe nicht dieselbe Nachricht verschicken
--   2. verify_cron_secret(): Die Edge Functions prüfen das Cron-Secret über diese
--      Funktion statt über das Schema `private`, das PostgREST nicht veröffentlicht
--      und auf das service_role kein USAGE hat
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nachrichten beanspruchen
--
-- Bisher las der Versandlauf `pending`-Zeilen und schrieb den Zustand erst nach dem
-- Versand zurück. Ein zweiter Lauf in dieser Zeit sah dieselben Zeilen. Jetzt setzt
-- ein einziges UPDATE die Zeilen auf `sending`; FOR UPDATE SKIP LOCKED lässt einen
-- parallelen Lauf an ihnen vorbeigehen.
--
-- Bricht ein Lauf mittendrin ab (Zeitlimit der Function), blieben Zeilen in
-- `sending` hängen. Nach 30 Minuten gelten sie deshalb wieder als `pending` — lieber
-- eine Nachricht im seltenen Fehlerfall doppelt als nie.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_notifications(p_limit INTEGER DEFAULT 50)
RETURNS SETOF public.notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.notifications
       SET status = 'pending'
     WHERE status = 'sending'
       AND updated_at < NOW() - INTERVAL '30 minutes';

    RETURN QUERY
    UPDATE public.notifications n
       SET status = 'sending'
     WHERE n.id IN (
           SELECT id FROM public.notifications
            WHERE status = 'pending'
              AND scheduled_for <= NOW()
            ORDER BY scheduled_for
            LIMIT GREATEST(COALESCE(p_limit, 50), 1)
            FOR UPDATE SKIP LOCKED
       )
    RETURNING n.*;
END;
$$;

-- Für die Wiederaufnahme oben: seit wann eine Zeile in ihrem Zustand steht.
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS notifications_updated_at ON public.notifications;
CREATE TRIGGER notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON FUNCTION public.claim_notifications(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications(INTEGER) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Cron-Secret prüfen
--
-- Die Edge Functions fragten `private.cron_config` über die REST-API ab. Das Schema
-- ist dort nicht veröffentlicht (gewollt), und service_role hat kein USAGE darauf —
-- die Abfrage scheiterte, jeder Cron-Aufruf bekam 401.
--
-- Die Funktion gibt nur wahr/falsch zurück; das Secret verlässt die Datenbank nicht.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM private.cron_config
         WHERE key = 'cron_secret'
           AND COALESCE(value, '') <> ''
           AND value = p_secret
    );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(TEXT) TO service_role;
