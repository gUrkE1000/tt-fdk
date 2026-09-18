-- ============================================================================
-- Datenschutzhinweis und Impressum verlinken (Aufgabe 10.1)
--
-- Art. 13 DSGVO verlangt, dass die Betroffenen den Hinweis **bekommen** — nicht,
-- dass er irgendwo existiert. Er muss also aus der Anwendung erreichbar sein,
-- und zwar auch aus der Registrierung: Dort werden die ersten Daten erhoben.
--
-- Als Adresse statt als Text in der Datenbank: Die meisten Vereine haben beides
-- längst auf ihrer Website. Zwei Fassungen desselben Textes laufen unweigerlich
-- auseinander, und dann steht in der Anwendung eine, die nicht mehr gilt.
-- `docs/datenschutz/datenschutzhinweis.md` ist der Entwurf, den der Verein dort
-- veröffentlicht.
-- ============================================================================

INSERT INTO public.club_settings (key, value) VALUES
    ('privacy_url', ''),
    -- Für einen eingetragenen Verein mit Website ohnehin Pflicht (§ 5 DDG).
    ('imprint_url', '')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Die Adressen auch **vor** der Anmeldung ausgeben
--
-- Auf der Registrierungsseite werden die ersten Daten erhoben; genau dort muss
-- der Hinweis erreichbar sein. `get_public_club_info` ist die einzige Funktion,
-- die auch `anon` aufrufen darf — sie bekommt die beiden Adressen dazu.
--
-- Mehr als diese vier Werte gibt sie weiterhin nicht heraus: Wer die Anmeldeseite
-- öffnet, ist noch niemand.
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_public_club_info();

CREATE OR REPLACE FUNCTION public.get_public_club_info()
RETURNS TABLE (
    club_name       TEXT,
    club_short_name TEXT,
    privacy_url     TEXT,
    imprint_url     TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT
        (SELECT value FROM public.club_settings WHERE key = 'club_name'),
        (SELECT value FROM public.club_settings WHERE key = 'club_short_name'),
        (SELECT value FROM public.club_settings WHERE key = 'privacy_url'),
        (SELECT value FROM public.club_settings WHERE key = 'imprint_url');
$$;

REVOKE ALL ON FUNCTION public.get_public_club_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_club_info() TO anon, authenticated;
