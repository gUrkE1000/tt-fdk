-- ============================================================================
-- Vereinsneuigkeiten (Aufgabe 9.3)
--
-- Ein schwarzes Brett: Wer etwas mitzuteilen hat, schreibt es hierhin, und wer
-- die Anwendung öffnet, findet es unter „Mein Verein".
--
-- **Es geht bewusst keine Benachrichtigung raus.** Der TT-Planer macht es auch
-- nicht, und das ist richtig: Eine Neuigkeit ist eine Mitteilung an alle, keine
-- Aufforderung an einen Einzelnen. Alles, was den Posteingang der Mitglieder
-- erreicht, verlangt von ihnen eine Handlung — sonst gewöhnen sie sich an, die
-- Mails wegzuklicken, und dann geht auch die Ersatzanfrage unter.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.news (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    -- Rich-Text wie bei den Vereinsterminen; bereinigt wird beim Anzeigen.
    body_html    TEXT NOT NULL DEFAULT '',
    -- Getrennt von `created_at`: Eine Neuigkeit lässt sich vordatieren oder
    -- nachträglich korrigieren, ohne dass sie an eine andere Stelle rutscht.
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Oben angeheftet, etwa die Einladung zur Jahreshauptversammlung.
    pinned       BOOLEAN NOT NULL DEFAULT false,
    author_id    UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT news_title_not_empty CHECK (length(btrim(title)) > 0)
);

DROP TRIGGER IF EXISTS news_updated_at ON public.news;
CREATE TRIGGER news_updated_at
    BEFORE UPDATE ON public.news
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS news_published_idx
    ON public.news (pinned DESC, published_at DESC);

-- Der Verfasser wird beim Anlegen gesetzt, nicht von der Oberfläche mitgeschickt:
-- Sonst könnte jemand eine Neuigkeit im Namen eines anderen einstellen.
--
-- Nur, wenn überhaupt jemand angemeldet ist: Bei einer Datenübernahme (Aufgabe
-- 10.2) läuft der Import ohne Sitzung, und die alten Beiträge sollen ihre
-- Verfasser behalten, statt anonym zu werden.
CREATE OR REPLACE FUNCTION public.set_news_author()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        NEW.author_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS news_author ON public.news;
CREATE TRIGGER news_author
    BEFORE INSERT ON public.news
    FOR EACH ROW EXECUTE FUNCTION public.set_news_author();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;

-- Lesen: jedes aktive Mitglied, aber erst ab dem Veröffentlichungszeitpunkt. Eine
-- vordatierte Neuigkeit, die schon jeder lesen kann, wäre keine vordatierte.
DROP POLICY IF EXISTS news_select ON public.news;
CREATE POLICY news_select ON public.news
    FOR SELECT TO authenticated
    USING (
        public.is_active_member()
        AND (published_at <= NOW() OR public.is_organizer_or_admin())
    );

DROP POLICY IF EXISTS news_write ON public.news;
CREATE POLICY news_write ON public.news
    FOR ALL TO authenticated
    USING (public.is_organizer_or_admin())
    WITH CHECK (public.is_organizer_or_admin());

-- ----------------------------------------------------------------------------
-- Sicht mit dem Namen des Verfassers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_news
WITH (security_invoker = true) AS
SELECT
    n.id,
    n.title,
    n.body_html,
    n.published_at,
    n.pinned,
    n.author_id,
    p.full_name AS author_name,
    n.created_at,
    n.updated_at
FROM public.news n
LEFT JOIN public.profiles p ON p.id = n.author_id;

GRANT SELECT ON public.v_news TO authenticated;
