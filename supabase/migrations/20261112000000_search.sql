-- Globale Suche (Konzept: docs/suche.md).
--
-- Die Suche hat KEINE eigene Rechteregel. `rpc_search` läuft mit den Rechten des
-- Aufrufers (SECURITY INVOKER) und liest dieselben Tabellen und Sichten wie die Seiten:
-- Was RLS oder eine maskierende Sicht nicht herausgibt, kann auch nicht gefunden werden.
-- Eine eigene Suchtabelle mit kopierten Rechten wäre eine zweite Wahrheit, die irgendwann
-- von der ersten abweicht (vgl. datenbank.md, `object_messages`).
--
-- Gesucht wird außerdem nur in Feldern, die der Aufrufer lesen darf. Eine Suche, die in
-- einem verborgenen Feld sucht und es nur nicht anzeigt, verrät es trotzdem: Wer eine
-- Telefonnummer eintippt und einen Namen zurückbekommt, kennt die Nummer. Deshalb sind
-- Kontaktdaten für Nicht-Admins kein Suchfeld, Abwesenheitsgründe, Stimmen und
-- Teilnehmerlisten für niemanden.

-- ----------------------------------------------------------------------------
-- 1. Trigramme für die Tippfehlertoleranz
--
-- In Supabase gehören Erweiterungen ins Schema `extensions`. Liegt pg_trgm in einem
-- Projekt schon woanders (etwa in `public`), ist das IF NOT EXISTS ein No-op; die
-- Funktionen unten finden es trotzdem, weil `public` und `extensions` beide in ihrem
-- search_path stehen.
-- ----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
-- In Supabase ist das schon so eingerichtet, und das Schema gehört dort nicht der Rolle,
-- die Migrationen ausführt. Lokal und in der CI fehlt es.
DO $$
BEGIN
    GRANT USAGE ON SCHEMA extensions TO authenticated, service_role;
EXCEPTION WHEN insufficient_privilege THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Normalisierung
--
-- „Müller", „Mueller" und „MÜLLER" sollen sich treffen: Umlaute werden zu ae/oe/ue,
-- ß zu ss, übrige Akzente fallen weg, alles außer Buchstaben und Ziffern wird zu einem
-- Leerzeichen. Ohne `unaccent`: `translate` ist eingebaut, verhält sich überall gleich
-- und ist 1:1 in `src/lib/search.ts` nachgebaut (die Hervorhebung im Browser braucht
-- dieselbe Regel). Groß- und Kleinbuchstaben stehen beide in den Listen, damit das
-- Ergebnis nicht von der Locale der Datenbank abhängt.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_norm(p_text TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT btrim(regexp_replace(
        lower(translate(
            replace(replace(replace(replace(replace(replace(replace(replace(
            replace(replace(replace(replace(
                COALESCE(p_text, ''),
                'Ä', 'ae'), 'Ö', 'oe'), 'Ü', 'ue'), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'),
                'ß', 'ss'), 'ẞ', 'ss'), 'Æ', 'ae'), 'æ', 'ae'), 'Œ', 'oe'), 'œ', 'oe'),
            'ÀÁÂÃÅĀĂĄÇĆČĎÈÉÊËĒĖĘĚÌÍÎÏĪĮŁÑŃŇÒÓÔÕØŌŐŔŘŚŠŞŤÙÚÛŪŮŰŲÝŸŹŻŽàáâãåāăąçćčďèéêëēėęěìíîïīįłñńňòóôõøōőŕřśšşťùúûūůűųýÿźżž',
            'AAAAAAAACCCDEEEEEEEEIIIIIILNNNOOOOOOORRSSSTUUUUUUUYYZZZaaaaaaaacccdeeeeeeeeiiiiiilnnnooooooorrssstuuuuuuuyyzzz'
        )),
        '[^a-z0-9]+', ' ', 'g'
    ));
$$;

COMMENT ON FUNCTION public.search_norm(TEXT) IS
    'Normalform für die Suche: klein, Umlaute als ae/oe/ue, ß als ss, ohne Akzente und Satzzeichen. Gegenstück: src/lib/search.ts';

-- HTML-Text für die Suche: Tags weg, Entitäten grob aufgelöst.
CREATE OR REPLACE FUNCTION public.search_strip_html(p_html TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT replace(replace(replace(replace(
        regexp_replace(COALESCE(p_html, ''), '<[^>]*>', ' ', 'g'),
        '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>');
$$;

-- Zusätzliche Schreibweisen eines Mannschaftsnamens: „2. Herren" → „h2 herren2",
-- „Jungen U15" → „j15 jungen15". So findet „H2" die zweite Herren und ihre Spiele.
CREATE OR REPLACE FUNCTION public.search_team_aliases(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_norm   TEXT := public.search_norm(p_name);
    v_number TEXT := substring(v_norm FROM '([0-9]+)');
    v_word   TEXT := substring(v_norm FROM '([a-z]+)');
BEGIN
    IF v_number IS NULL OR v_word IS NULL THEN
        RETURN '';
    END IF;
    RETURN left(v_word, 1) || v_number || ' ' || v_word || v_number;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Kölner Phonetik
--
-- Namen werden nach Gehör getippt: Meier, Mayer, Maier; Schmidt, Schmitt. Trigramme
-- helfen dabei wenig (zu kurze Wörter, zu viele verschiedene Buchstaben), die Kölner
-- Phonetik ist genau für deutsche Namen gemacht: Meier = Mayer = Maier = „67".
-- Erwartet ein normalisiertes Wort (search_norm).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_phonetic(p_word TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_word  TEXT := regexp_replace(COALESCE(p_word, ''), '[^a-z]', '', 'g');
    v_len   INTEGER := length(v_word);
    v_raw   TEXT := '';
    v_out   TEXT := '';
    v_char  TEXT;
    v_prev  TEXT;
    v_next  TEXT;
    v_code  TEXT;
    v_last  TEXT := NULL;
    i       INTEGER;
BEGIN
    FOR i IN 1 .. v_len LOOP
        v_char := substr(v_word, i, 1);
        v_prev := CASE WHEN i > 1 THEN substr(v_word, i - 1, 1) ELSE '' END;
        v_next := CASE WHEN i < v_len THEN substr(v_word, i + 1, 1) ELSE '' END;

        v_code := CASE
            WHEN v_char IN ('a', 'e', 'i', 'j', 'o', 'u', 'y') THEN '0'
            WHEN v_char = 'h' THEN ''
            WHEN v_char = 'b' THEN '1'
            WHEN v_char = 'p' THEN CASE WHEN v_next = 'h' THEN '3' ELSE '1' END
            WHEN v_char IN ('d', 't') THEN
                CASE WHEN v_next IN ('c', 's', 'z') THEN '8' ELSE '2' END
            WHEN v_char IN ('f', 'v', 'w') THEN '3'
            WHEN v_char IN ('g', 'k', 'q') THEN '4'
            WHEN v_char = 'c' THEN
                CASE
                    WHEN i = 1 THEN
                        CASE WHEN v_next IN ('a', 'h', 'k', 'l', 'o', 'q', 'r', 'u', 'x')
                             THEN '4' ELSE '8' END
                    WHEN v_prev IN ('s', 'z') THEN '8'
                    WHEN v_next IN ('a', 'h', 'k', 'o', 'q', 'u', 'x') THEN '4'
                    ELSE '8'
                END
            WHEN v_char = 'x' THEN
                CASE WHEN v_prev IN ('c', 'k', 'q') THEN '8' ELSE '48' END
            WHEN v_char = 'l' THEN '5'
            WHEN v_char IN ('m', 'n') THEN '6'
            WHEN v_char = 'r' THEN '7'
            WHEN v_char IN ('s', 'z') THEN '8'
            ELSE ''
        END;
        v_raw := v_raw || v_code;
    END LOOP;

    -- Gleiche Ziffern hintereinander zusammenfassen, danach jede 0 außer am Anfang weg.
    FOR i IN 1 .. length(v_raw) LOOP
        v_char := substr(v_raw, i, 1);
        IF v_last IS DISTINCT FROM v_char THEN
            v_out := v_out || v_char;
        END IF;
        v_last := v_char;
    END LOOP;

    RETURN left(v_out, 1) || replace(substr(v_out, 2), '0', '');
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Bewertung eines Treffers
--
-- Jedes Suchwort muss passen, sonst NULL. Je Wort, vom stärksten zum schwächsten Signal:
--   1,0   ganzes Wort
--   0,8   Wortanfang            („mül" → „Müller")
--   0,5   Wortanfang ohne Endung (ab 5 Zeichen, „trainings" → „Training")
--   0,45  mitten im Wort        (ab 3 Zeichen, „stadt" → „Nachbarstadt")
--   ≤0,4  ähnlich geschrieben   (ab 4 Zeichen, pg_trgm, „Borrusia" → „Borussia")
--   0,35  klingt gleich         (ab 3 Zeichen, gleicher Anfangsbuchstabe, nur wo
--                                `p_phonetic`, „Mayer" → „Meier")
-- Das Ergebnis ist der Durchschnitt über alle Wörter.
--
-- `rpc_search` bewertet Titel und Namen voll, Nebenfelder (Beschreibung, Tätigkeiten,
-- Text einer Neuigkeit) nur mit 0,6: „training" soll das Training finden, nicht zuerst
-- das Amt, in dessen Tätigkeiten „Training organisieren" steht.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_score(
    p_tokens   TEXT[],
    p_hay      TEXT,
    p_phonetic BOOLEAN DEFAULT false
)
RETURNS REAL
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_hay    TEXT := COALESCE(p_hay, '');
    v_padded TEXT := ' ' || COALESCE(p_hay, '') || ' ';
    v_token  TEXT;
    v_total  REAL := 0;
    v_count  INTEGER := 0;
    v_sim    REAL;
    v_code   TEXT;
    v_found  BOOLEAN;
    v_word   TEXT;
BEGIN
    IF p_tokens IS NULL OR cardinality(p_tokens) = 0 THEN
        RETURN 0;
    END IF;

    FOREACH v_token IN ARRAY p_tokens LOOP
        v_count := v_count + 1;

        IF position(' ' || v_token || ' ' IN v_padded) > 0 THEN
            v_total := v_total + 1.0;
        ELSIF position(' ' || v_token IN v_padded) > 0 THEN
            v_total := v_total + 0.8;
        ELSIF length(v_token) >= 5
              AND position(' ' || left(v_token, -1) IN v_padded) > 0 THEN
            -- Endung weg: „trainings" → „Training", „kasse" → „Kassier". Vor der
            -- Wortmitte, weil ein Wortanfang das stärkere Signal ist.
            v_total := v_total + 0.5;
        ELSIF length(v_token) >= 3 AND position(v_token IN v_hay) > 0 THEN
            v_total := v_total + 0.45;
        ELSE
            -- Zwei Maße, an echten Wortpaaren eingestellt (docs/suche.md, 5.2):
            -- `strict_word_similarity` vergleicht mit ganzen Wörtern und hält kurze
            -- Eingaben knapp („kasse" ≠ „Turnstrasse"); `word_similarity` findet auch
            -- Teile langer Komposita („meisterschaften" → „Clubmeisterschaft"), darf
            -- deshalb aber erst ab acht Zeichen und mit strengerer Schwelle mitreden
            -- („spieler" ≠ „Spieltag").
            v_sim := 0;
            IF length(v_token) >= 4 THEN
                v_sim := strict_word_similarity(v_token, v_hay);
                IF v_sim < 0.45 THEN
                    v_sim := CASE WHEN length(v_token) >= 8
                                       AND word_similarity(v_token, v_hay) >= 0.65
                                  THEN word_similarity(v_token, v_hay) ELSE 0 END;
                END IF;
            END IF;
            IF v_sim > 0 THEN
                v_total := v_total + 0.4 * v_sim;
            ELSIF p_phonetic AND length(v_token) >= 3 THEN
                v_code := public.search_phonetic(v_token);
                v_found := false;
                IF length(v_code) >= 2 THEN
                    FOREACH v_word IN ARRAY regexp_split_to_array(v_hay, ' ') LOOP
                        -- Gleicher Anfangsbuchstabe: Sonst klingt „Anna" wie „Heim"
                        -- (beides „06"), und kurze Codes treffen fast alles.
                        IF length(v_word) >= 3 AND left(v_word, 1) = left(v_token, 1)
                           AND public.search_phonetic(v_word) = v_code THEN
                            v_found := true;
                            EXIT;
                        END IF;
                    END LOOP;
                END IF;
                IF NOT v_found THEN
                    RETURN NULL;
                END IF;
                v_total := v_total + 0.35;
            ELSE
                RETURN NULL;
            END IF;
        END IF;
    END LOOP;

    RETURN v_total / v_count;
END;
$$;

-- Zuschlag für die Nähe in der Zeit: Bald Stattfindendes zuerst, Vergangenes nach
-- hinten — außer der Nutzer fragt ausdrücklich nach einem Zeitraum.
CREATE OR REPLACE FUNCTION public.search_time_bonus(p_at TIMESTAMPTZ, p_ranged BOOLEAN)
RETURNS REAL
LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT CASE
        WHEN p_at IS NULL OR p_ranged THEN 0
        WHEN p_at < now() - INTERVAL '1 day' THEN -0.2
        WHEN p_at <= now() + INTERVAL '14 days' THEN 0.2
        WHEN p_at <= now() + INTERVAL '60 days' THEN
            (0.2 * (1 - extract(epoch FROM p_at - now() - INTERVAL '14 days')
                        / extract(epoch FROM INTERVAL '46 days')))::REAL
        ELSE 0
    END;
$$;

REVOKE ALL ON FUNCTION public.search_norm(TEXT)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_strip_html(TEXT)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_team_aliases(TEXT)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_phonetic(TEXT)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_score(TEXT[], TEXT, BOOLEAN)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_time_bonus(TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
-- Reine Rechenfunktionen ohne Datenzugriff. `rpc_search` ruft sie mit den Rechten
-- des Aufrufers, deshalb braucht authenticated sie.
GRANT EXECUTE ON FUNCTION public.search_norm(TEXT)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_strip_html(TEXT)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_team_aliases(TEXT)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_phonetic(TEXT)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_score(TEXT[], TEXT, BOOLEAN)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_time_bonus(TIMESTAMPTZ, BOOLEAN) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Indizes
--
-- Bei einigen hundert Zeilen je Tabelle ginge es auch ohne. Die zwei Tabellen, die über
-- die Jahre wachsen (Mitglieder, Spiele), bekommen trotzdem einen Trigramm-Index auf
-- genau den Ausdruck, den `rpc_search` durchsucht. Der Operator-Klassen-Name wird aus
-- dem Schema gelesen, in dem pg_trgm tatsächlich liegt.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_schema TEXT;
BEGIN
    SELECT n.nspname INTO v_schema
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'pg_trgm';

    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS profiles_search_trgm ON public.profiles '
        'USING gin (public.search_norm(first_name || '' '' || last_name) %I.gin_trgm_ops)',
        v_schema);
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS matches_search_trgm ON public.matches '
        'USING gin (public.search_norm(COALESCE(opponent, '''') || '' '' || COALESCE(league, '''')) %I.gin_trgm_ops)',
        v_schema);
END $$;

-- ----------------------------------------------------------------------------
-- 6. Die Suche
--
-- Ergebnis je Art höchstens `p_limit` Zeilen, nach Bewertung sortiert. Die Oberfläche
-- mischt die Arten und fügt Seiten und Aktionen hinzu (src/features/search/).
--
--   p_query    Suchtext (ohne erkannte Datumsangaben)
--   p_kinds    NULL = alle Arten
--   p_from/to  Zeitraum aus der Eingabe („Samstag", „12.10.") oder dem Zeitfilter
--   p_limit    je Art
--
-- `meta` trägt, was die Trefferzeile je Art zusätzlich braucht (Rolle, Kontakt bei
-- Freigabe, Heim/Auswärts, …). Auch dort steht nur, was der Aufrufer ohnehin lesen darf.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_search(
    p_query TEXT,
    p_kinds TEXT[]      DEFAULT NULL,
    p_from  TIMESTAMPTZ DEFAULT NULL,
    p_to    TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER     DEFAULT 5
)
RETURNS TABLE (
    kind       TEXT,
    id         UUID,
    title      TEXT,
    subtitle   TEXT,
    starts_at  TIMESTAMPTZ,
    target     TEXT,
    score      REAL,
    mine       BOOLEAN,
    my_status  TEXT,
    can_manage BOOLEAN,
    meta       JSONB
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_me     UUID := auth.uid();
    v_norm   TEXT := public.search_norm(left(COALESCE(p_query, ''), 100));
    v_tokens TEXT[];
    v_ranged BOOLEAN := p_from IS NOT NULL OR p_to IS NOT NULL;
    v_from   TIMESTAMPTZ := COALESCE(p_from, '-infinity'::TIMESTAMPTZ);
    v_to     TIMESTAMPTZ := COALESCE(p_to, 'infinity'::TIMESTAMPTZ);
    v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 50);
    v_admin  BOOLEAN;
    v_manage BOOLEAN;
BEGIN
    -- Wer nicht aktives Mitglied ist, sieht nirgends etwas; die Policies sagen dasselbe,
    -- hier spart es nur die Arbeit.
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RETURN;
    END IF;

    SELECT COALESCE(array_agg(t), ARRAY[]::TEXT[]) INTO v_tokens
      FROM (
          SELECT t FROM unnest(regexp_split_to_array(v_norm, ' ')) AS t
           WHERE t <> ''
           LIMIT 8
      ) AS words;

    -- Unter zwei Zeichen ist jede Antwort Zufall.
    IF length(replace(v_norm, ' ', '')) < 2 THEN
        v_tokens := ARRAY[]::TEXT[];
    END IF;

    IF cardinality(v_tokens) = 0 AND NOT v_ranged THEN
        RETURN;
    END IF;

    v_admin  := public.is_admin();
    v_manage := public.is_organizer_or_admin();

    -- ------------------------------------------------------------ Mitglieder
    -- Aus dem Verzeichnis, nicht aus der Tabelle: dort sind Kontaktdaten schon maskiert
    -- und Gäste sehen nur Admins und Trainer. Durchsucht werden Name und Amt; E-Mail und
    -- Mitgliedsnummer nur vom Admin.
    IF NOT v_ranged AND (p_kinds IS NULL OR 'member' = ANY (p_kinds)) THEN
        RETURN QUERY
        SELECT 'member'::TEXT, x.id, x.full_name, x.teams, NULL::TIMESTAMPTZ,
               '/my-club?tab=members&q=' || x.full_name,
               (x.sc
                + CASE WHEN public.search_norm(x.full_name) = v_norm THEN 0.5
                       WHEN public.search_norm(x.last_name) LIKE v_tokens[1] || '%' THEN 0.15
                       ELSE 0 END
                + CASE WHEN x.mine THEN 0.25 ELSE 0 END)::REAL,
               x.mine, NULL::TEXT, v_admin,
               jsonb_strip_nulls(jsonb_build_object(
                   'role', x.role, 'status', CASE WHEN v_admin THEN x.status END,
                   'email', x.email, 'phone', x.phone, 'mobile_phone', x.mobile_phone,
                   'offices', x.offices))
          FROM (
              SELECT d.id, d.full_name, d.last_name, d.role::TEXT AS role,
                     d.status::TEXT AS status, d.email, d.phone, d.mobile_phone,
                     tm.teams, cr.offices,
                     d.id <> v_me AND EXISTS (
                         SELECT 1 FROM public.team_members a
                           JOIN public.team_members b ON b.team_id = a.team_id
                          WHERE a.profile_id = v_me AND b.profile_id = d.id
                     ) AS mine,
                     public.search_score(
                         v_tokens,
                         public.search_norm(concat_ws(' ',
                             d.first_name, d.last_name, cr.offices,
                             CASE WHEN v_admin THEN d.email END,
                             CASE WHEN v_admin THEN p.member_number END)),
                         true) AS sc
                FROM public.v_members_directory d
                LEFT JOIN public.profiles p ON p.id = d.id
                LEFT JOIN LATERAL (
                    SELECT string_agg(t.name, ', ' ORDER BY t.sort_order, t.name) AS teams
                      FROM public.team_members m
                      JOIN public.teams t ON t.id = m.team_id
                     WHERE m.profile_id = d.id AND t.active
                ) tm ON true
                LEFT JOIN LATERAL (
                    SELECT string_agg(r.name, ', ' ORDER BY r.sort_order, r.name) AS offices
                      FROM public.club_role_members rm
                      JOIN public.club_roles r ON r.id = rm.role_id
                     WHERE rm.profile_id = d.id
                ) cr ON true
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.full_name
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Mannschaften
    IF NOT v_ranged AND (p_kinds IS NULL OR 'team' = ANY (p_kinds)) THEN
        RETURN QUERY
        SELECT 'team'::TEXT, x.id, x.name, x.subtitle, NULL::TIMESTAMPTZ,
               '/my-club?tab=teams',
               (x.sc
                + CASE WHEN public.search_norm(x.name) = v_norm THEN 0.5 ELSE 0 END
                + CASE WHEN x.mine THEN 0.25 ELSE 0 END)::REAL,
               x.mine, NULL::TEXT, x.can_manage,
               jsonb_build_object('color', x.color)
          FROM (
              SELECT t.id, t.name, t.color, t.sort_order,
                     concat_ws(' · ', NULLIF(array_to_string(t.leagues, ', '), ''),
                               CASE WHEN l.leaders IS NOT NULL THEN 'MF: ' || l.leaders END)
                         AS subtitle,
                     public.belongs_to_team(t.id) AS mine,
                     (v_admin OR public.leads_team(t.id)) AS can_manage,
                     public.search_score(
                         v_tokens,
                         public.search_norm(concat_ws(' ', t.name,
                             public.search_team_aliases(t.name),
                             array_to_string(t.leagues, ' '), l.leaders)),
                         true) AS sc
                FROM public.teams t
                LEFT JOIN LATERAL (
                    SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) AS leaders
                      FROM public.team_leaders tl
                      JOIN public.profiles p ON p.id = tl.profile_id
                     WHERE tl.team_id = t.id
                ) l ON true
               WHERE t.active
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.sort_order
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Spiele
    IF p_kinds IS NULL OR 'match' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'match'::TEXT, x.id, x.title, x.subtitle, x.dtstart,
               '/match/' || x.id,
               (x.sc
                + CASE WHEN x.mine THEN 0.25 ELSE 0 END
                + CASE WHEN x.my_status = 'none' AND x.dtstart > now() THEN 0.1 ELSE 0 END
                + public.search_time_bonus(x.dtstart, v_ranged))::REAL,
               x.mine, x.my_status, x.can_manage,
               jsonb_build_object('is_home', x.is_home, 'active', x.active,
                                  'color', x.color, 'team', x.team_name)
          FROM (
              SELECT m.id, m.dtstart, m.is_home, m.active, t.color, t.name AS team_name,
                     t.name || ' – ' || COALESCE(NULLIF(m.opponent, ''), m.summary) AS title,
                     concat_ws(' · ', CASE WHEN m.is_home THEN 'Heim' ELSE 'Auswärts' END,
                               NULLIF(m.league, ''),
                               COALESCE(v.name, NULLIF(m.location_text, '')),
                               CASE WHEN NOT m.active THEN 'abgesagt' END) AS subtitle,
                     (public.belongs_to_team(m.team_id) OR mp.profile_id IS NOT NULL) AS mine,
                     CASE WHEN mp.profile_id IS NULL THEN NULL
                          WHEN mp.version_responded IS DISTINCT FROM m.version THEN 'none'
                          ELSE mp.response::TEXT END AS my_status,
                     (v_admin OR public.leads_team(m.team_id)) AS can_manage,
                     public.search_score(
                         v_tokens,
                         public.search_norm(concat_ws(' ', m.opponent, m.summary, m.league,
                             m.location_text, v.name, v.city, t.name,
                             public.search_team_aliases(t.name),
                             CASE WHEN m.is_home THEN 'heim heimspiel'
                                  ELSE 'auswaerts auswaertsspiel' END,
                             CASE WHEN m.matchday IS NOT NULL THEN 'spieltag ' || m.matchday END,
                             CASE WHEN NOT m.active THEN 'abgesagt' END)),
                         true) AS sc
                FROM public.matches m
                JOIN public.teams t ON t.id = m.team_id
                LEFT JOIN public.venues v ON v.id = m.venue_id
                LEFT JOIN public.match_participations mp
                       ON mp.match_id = m.id AND mp.profile_id = v_me
               WHERE m.dtstart >= v_from AND m.dtstart < v_to
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.dtstart
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Trainings
    -- Die Regel („Erwachsenentraining, dienstags") mit ihrem nächsten Termin. Einzelne
    -- Termine kommen nur bei einer Zeitangabe (unten), sonst stünde jedes Training
    -- achtmal in der Liste.
    IF NOT v_ranged AND (p_kinds IS NULL OR 'training' = ANY (p_kinds)) THEN
        RETURN QUERY
        SELECT 'training'::TEXT, x.id, x.name, x.subtitle, x.next_at,
               COALESCE('/training/' || x.next_id, '/my-club?tab=trainings'),
               (x.sc
                + CASE WHEN public.search_norm(x.name) = v_norm THEN 0.5 ELSE 0 END
                + CASE WHEN x.mine THEN 0.25 ELSE 0 END)::REAL,
               x.mine, x.my_status, x.can_manage,
               jsonb_build_object('training_id', x.id)
          FROM (
              SELECT t.id, t.name, n.id AS next_id, n.starts_at AS next_at,
                     concat_ws(' · ',
                         (ARRAY['Mo','Di','Mi','Do','Fr','Sa','So'])[t.weekday] || ' '
                             || to_char(t.time_start, 'HH24:MI'),
                         v.name, NULLIF(tr.trainers, '')) AS subtitle,
                     (public.trains(t.id) OR EXISTS (
                         SELECT 1 FROM public.training_members tm
                          WHERE tm.training_id = t.id AND tm.profile_id = v_me)) AS mine,
                     (SELECT a.status::TEXT FROM public.training_attendance a
                       WHERE a.session_id = n.id AND a.profile_id = v_me) AS my_status,
                     (v_admin OR public.trains(t.id)) AS can_manage,
                     GREATEST(
                         public.search_score(v_tokens, x_main.hay, false),
                         0.6 * public.search_score(v_tokens,
                             x_main.hay || ' ' || public.search_norm(t.details), false)
                     ) AS sc
                FROM public.trainings t
                LEFT JOIN public.venues v ON v.id = t.venue_id
                LEFT JOIN LATERAL (
                    SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) AS trainers
                      FROM public.training_trainers tt
                      JOIN public.profiles p ON p.id = tt.profile_id
                     WHERE tt.training_id = t.id
                ) tr ON true
                LEFT JOIN LATERAL (
                    SELECT s.id, s.starts_at FROM public.training_sessions s
                     WHERE s.training_id = t.id AND NOT s.cancelled
                       AND s.starts_at >= now() - INTERVAL '2 hours'
                     ORDER BY s.starts_at
                     LIMIT 1
                ) n ON true
                CROSS JOIN LATERAL (
                    SELECT public.search_norm(concat_ws(' ', t.name,
                               CASE t.type::TEXT WHEN 'youth' THEN 'jugend jugendtraining'
                                                 ELSE 'erwachsene erwachsenentraining' END,
                               (ARRAY['montag','dienstag','mittwoch','donnerstag','freitag',
                                      'samstag','sonntag'])[t.weekday],
                               v.name, v.city, tr.trainers)) AS hay
                ) x_main
               WHERE t.active
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.name
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Trainingstermine
    IF v_ranged AND (p_kinds IS NULL OR 'session' = ANY (p_kinds)) THEN
        RETURN QUERY
        SELECT 'session'::TEXT, x.id, x.name, x.subtitle, x.starts_at,
               '/training/' || x.id,
               (COALESCE(x.sc, 0) + CASE WHEN x.mine THEN 0.25 ELSE 0 END)::REAL,
               x.mine, x.my_status, x.can_manage,
               jsonb_build_object('cancelled', x.cancelled, 'training_id', x.training_id)
          FROM (
              SELECT s.id, s.starts_at, s.cancelled, t.id AS training_id, t.name,
                     concat_ws(' · ', v.name,
                               CASE WHEN s.cancelled
                                    THEN 'fällt aus' || COALESCE(': ' || NULLIF(s.cancel_reason, ''), '')
                               END) AS subtitle,
                     (public.trains(t.id) OR EXISTS (
                         SELECT 1 FROM public.training_members tm
                          WHERE tm.training_id = t.id AND tm.profile_id = v_me)) AS mine,
                     (SELECT a.status::TEXT FROM public.training_attendance a
                       WHERE a.session_id = s.id AND a.profile_id = v_me) AS my_status,
                     (v_admin OR public.trains(t.id)) AS can_manage,
                     CASE WHEN cardinality(v_tokens) = 0 THEN 0
                          ELSE public.search_score(
                              v_tokens,
                              public.search_norm(concat_ws(' ', t.name, t.details,
                                  CASE t.type::TEXT WHEN 'youth' THEN 'jugend jugendtraining'
                                                    ELSE 'erwachsene erwachsenentraining' END,
                                  v.name, v.city, s.cancel_reason,
                                  CASE WHEN s.cancelled THEN 'ausfall faellt aus abgesagt' END)),
                              false)
                     END AS sc
                FROM public.training_sessions s
                JOIN public.trainings t ON t.id = s.training_id
                LEFT JOIN public.venues v ON v.id = t.venue_id
               WHERE s.starts_at >= v_from AND s.starts_at < v_to
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.starts_at
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Vereinstermine
    IF p_kinds IS NULL OR 'event' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'event'::TEXT, x.id, x.name, x.subtitle, x.starts_at,
               '/event/' || x.id,
               (COALESCE(x.sc, 0)
                + CASE WHEN public.search_norm(x.name) = v_norm THEN 0.5 ELSE 0 END
                + CASE WHEN x.my_status IS NOT NULL THEN 0.25 ELSE 0 END
                + public.search_time_bonus(x.starts_at, v_ranged))::REAL,
               x.my_status IS NOT NULL, x.my_status, v_manage,
               jsonb_build_object('full_day', x.full_day,
                                  'participate_until', x.participate_until)
          FROM (
              SELECT e.id, e.name, e.starts_at, e.full_day, e.participate_until,
                     NULLIF(e.address, '') AS subtitle,
                     (SELECT ep.status::TEXT FROM public.event_participations ep
                       WHERE ep.event_id = e.id AND ep.profile_id = v_me) AS my_status,
                     CASE WHEN cardinality(v_tokens) = 0 THEN 0
                          ELSE GREATEST(
                              public.search_score(v_tokens,
                                  public.search_norm(concat_ws(' ', e.name, e.address)), false),
                              0.6 * public.search_score(v_tokens,
                                  public.search_norm(concat_ws(' ', e.name, e.address,
                                      public.search_strip_html(e.description_html))), false))
                     END AS sc
                FROM public.club_events e
               WHERE e.starts_at >= v_from AND e.starts_at < v_to
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.starts_at
         LIMIT v_limit;
    END IF;

    -- Alles Weitere hat keinen Termin und kommt bei einer reinen Zeitfrage nicht mit.
    IF v_ranged THEN
        RETURN;
    END IF;

    -- ------------------------------------------------------------ Umfragen
    -- Durchsucht werden Titel, Beschreibung und Antwortmöglichkeiten — nie die Stimmen.
    IF p_kinds IS NULL OR 'poll' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'poll'::TEXT, x.id, x.title,
               CASE WHEN x.expires_at IS NULL THEN NULL
                    WHEN x.expires_at < now() THEN 'beendet'
                    ELSE 'läuft bis ' || to_char(x.expires_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY')
               END,
               NULL::TIMESTAMPTZ,
               '/votes#poll-' || x.id,
               (x.sc
                + CASE WHEN public.search_norm(x.title) = v_norm THEN 0.5 ELSE 0 END
                + CASE WHEN x.open AND NOT x.voted THEN 0.1 ELSE 0 END
                + CASE WHEN x.open THEN 0 ELSE -0.1 END)::REAL,
               x.open AND NOT x.voted,
               CASE WHEN x.voted THEN 'voted' WHEN x.open THEN 'open' ELSE 'closed' END,
               v_manage,
               jsonb_build_object('expires_at', x.expires_at)
          FROM (
              SELECT p.id, p.title, p.expires_at,
                     (p.expires_at IS NULL OR p.expires_at > now()) AS open,
                     EXISTS (SELECT 1 FROM public.poll_votes pv
                               JOIN public.poll_options po ON po.id = pv.option_id
                              WHERE po.poll_id = p.id AND pv.profile_id = v_me) AS voted,
                     GREATEST(
                         public.search_score(v_tokens, public.search_norm(p.title), false),
                         0.6 * public.search_score(v_tokens,
                             public.search_norm(concat_ws(' ', p.title,
                                 public.search_strip_html(p.details_html),
                                 (SELECT string_agg(o.text, ' ') FROM public.poll_options o
                                   WHERE o.poll_id = p.id))), false)
                     ) AS sc
                FROM public.polls p
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.title
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Neuigkeiten
    -- Vordatierte sieht (und findet) nur, wer sie anlegen darf — das regelt die Policy.
    IF p_kinds IS NULL OR 'news' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'news'::TEXT, x.id, x.title,
               concat_ws(' · ',
                   to_char(x.published_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'),
                   x.author_name,
                   CASE WHEN x.published_at > now() THEN 'geplant' END),
               x.published_at,
               '/my-club?tab=news#news-' || x.id,
               (x.sc
                + CASE WHEN public.search_norm(x.title) = v_norm THEN 0.5 ELSE 0 END
                + CASE WHEN x.published_at > now() - INTERVAL '30 days' THEN 0.1 ELSE 0 END)::REAL,
               false, NULL::TEXT, v_manage,
               jsonb_build_object('scheduled', x.published_at > now())
          FROM (
              SELECT n.id, n.title, n.published_at, n.author_name,
                     GREATEST(
                         public.search_score(v_tokens, public.search_norm(n.title), false),
                         0.6 * public.search_score(v_tokens,
                             public.search_norm(concat_ws(' ', n.title,
                                 public.search_strip_html(n.body_html))), false)
                     ) AS sc
                FROM public.v_news n
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.published_at DESC
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Orte
    IF p_kinds IS NULL OR 'venue' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'venue'::TEXT, x.id, x.name, x.address, NULL::TIMESTAMPTZ,
               NULL::TEXT,
               (x.sc + CASE WHEN public.search_norm(x.name) = v_norm THEN 0.5 ELSE 0 END)::REAL,
               false, NULL::TEXT, v_admin,
               jsonb_build_object('address', x.address)
          FROM (
              SELECT v.id, v.name,
                     concat_ws(', ', NULLIF(v.address, ''),
                               NULLIF(concat_ws(' ', v.postal_code, v.city), '')) AS address,
                     public.search_score(
                         v_tokens,
                         public.search_norm(concat_ws(' ', v.name, v.address,
                                                      v.postal_code, v.city)),
                         true) AS sc
                FROM public.venues v
               WHERE v.active
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.name
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Ämter
    -- „Kasse" findet den Kassier samt Inhaber; ein Amt schaltet keine Rechte frei und
    -- ist für alle aktiven Mitglieder lesbar.
    IF p_kinds IS NULL OR 'office' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'office'::TEXT, x.id, x.name, x.holders, NULL::TIMESTAMPTZ,
               '/my-club?tab=contacts',
               (x.sc + CASE WHEN public.search_norm(x.name) = v_norm THEN 0.5 ELSE 0 END)::REAL,
               false, NULL::TEXT, v_admin,
               jsonb_build_object('description', NULLIF(x.description, ''))
          FROM (
              SELECT r.id, r.name, r.description, r.sort_order, h.holders,
                     GREATEST(
                         public.search_score(v_tokens,
                             public.search_norm(concat_ws(' ', r.name, h.holders)), true),
                         0.6 * public.search_score(v_tokens,
                             public.search_norm(concat_ws(' ', r.name, h.holders, r.description,
                                 array_to_string(r.duties, ' '))), false)
                     ) AS sc
                FROM public.club_roles r
                LEFT JOIN LATERAL (
                    SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) AS holders
                      FROM public.club_role_members rm
                      JOIN public.profiles p ON p.id = rm.profile_id
                     WHERE rm.role_id = r.id
                ) h ON true
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.sort_order
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Nachrichten am Termin
    -- Die Policy fragt `can_see_message_object` — wer den Termin nicht sieht, findet
    -- auch den Faden nicht.
    IF p_kinds IS NULL OR 'message' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'message'::TEXT, x.id,
               CASE WHEN length(x.body) > 90 THEN left(x.body, 89) || '…' ELSE x.body END,
               concat_ws(' · ', x.author_name, x.object_title),
               x.created_at,
               CASE x.object_type::TEXT
                   WHEN 'match' THEN '/match/' || x.object_id
                   WHEN 'session' THEN '/training/' || x.object_id
                   ELSE '/event/' || x.object_id
               END,
               (x.sc + CASE WHEN x.created_at > now() - INTERVAL '14 days' THEN 0.1 ELSE 0 END)::REAL,
               false, NULL::TEXT, false,
               jsonb_build_object('object_type', x.object_type)
          FROM (
              SELECT om.id, om.body, om.created_at, om.object_type, om.object_id,
                     p.full_name AS author_name,
                     CASE om.object_type::TEXT
                         WHEN 'match' THEN (SELECT t.name || ' – ' || m.opponent
                                              FROM public.matches m
                                              JOIN public.teams t ON t.id = m.team_id
                                             WHERE m.id = om.object_id)
                         WHEN 'session' THEN (SELECT t.name || ' ' ||
                                                     to_char(s.session_date, 'DD.MM.')
                                                FROM public.training_sessions s
                                                JOIN public.trainings t ON t.id = s.training_id
                                               WHERE s.id = om.object_id)
                         ELSE (SELECT e.name FROM public.club_events e WHERE e.id = om.object_id)
                     END AS object_title,
                     public.search_score(
                         v_tokens,
                         public.search_norm(concat_ws(' ', om.body, p.full_name)),
                         false) AS sc
                FROM public.object_messages om
                LEFT JOIN public.profiles p ON p.id = om.author_id
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.created_at DESC
         LIMIT v_limit;
    END IF;

    -- ------------------------------------------------------------ Eigene Mitteilungen
    -- Ausdrücklich nur die eigenen: Die Policy ließe den Admin alle lesen (für das
    -- Protokoll), aber in der Suche hat der Posteingang anderer nichts verloren.
    -- Je Kanal gibt es eine Zeile; hier zählt die Mitteilung einmal.
    IF p_kinds IS NULL OR 'notification' = ANY (p_kinds) THEN
        RETURN QUERY
        SELECT 'notification'::TEXT, x.id, x.subject,
               CASE WHEN length(x.body_text) > 90 THEN left(x.body_text, 89) || '…'
                    ELSE x.body_text END,
               x.scheduled_for,
               COALESCE(NULLIF(x.page, ''), '/notifications'),
               (x.sc - 0.1)::REAL,
               false, NULL::TEXT, false,
               jsonb_build_object('type', x.type)
          FROM (
              SELECT DISTINCT ON (n.type, n.subject, n.scheduled_for)
                     n.id, n.type, n.subject, n.body_text, n.scheduled_for,
                     n.payload ->> 'page' AS page,
                     GREATEST(
                         public.search_score(v_tokens, public.search_norm(n.subject), false),
                         0.6 * public.search_score(v_tokens,
                             public.search_norm(concat_ws(' ', n.subject, n.body_text)), false)
                     ) AS sc
                FROM public.notifications n
               WHERE n.profile_id = v_me
                 AND n.scheduled_for <= now()
               ORDER BY n.type, n.subject, n.scheduled_for, n.channel
          ) x
         WHERE x.sc IS NOT NULL
         ORDER BY 7 DESC, x.scheduled_for DESC
         LIMIT v_limit;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.rpc_search(TEXT, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS
    'Globale Suche. SECURITY INVOKER: findet genau, was der Aufrufer über RLS und die maskierenden Sichten sehen darf. Konzept: docs/suche.md';

REVOKE ALL ON FUNCTION public.rpc_search(TEXT, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_search(TEXT, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER)
    TO authenticated;
