-- ============================================================================
-- Training (Aufgabe 6.1, Zielbild 3.4 und 4.4)
--
-- Vier Entscheidungen prägen dieses Schema:
--
--   1. Termine werden **materialisiert**. `trainings` beschreibt nur die Regel
--      („dienstags 19 Uhr, zweiwöchentlich ab dem 1. September"), `training_sessions`
--      hält jeden einzelnen Termin als Zeile. Nur so kann eine Teilnahme an einem
--      Termin hängen, und nur so bleibt sie erhalten, wenn sich die Regel ändert.
--      Erzeugt werden die Zeilen von einem Job (Aufgabe 6.3); hier steht das Gefäß.
--   2. Ein Ausfall löscht nichts. `training_cancellations` beschreibt einen Zeitraum,
--      die betroffenen Sessions werden `cancelled` markiert und behalten Grund und
--      Herkunft. Wer zugesagt hatte, sieht damit weiterhin, was aus seinem Termin
--      geworden ist.
--   3. Die Teilnahme schreibt niemand direkt. `training_attendance` hat keine
--      Schreib-Policy; jede Änderung geht durch `rpc_set_training_attendance`, weil
--      Zuordnung, Teilnehmergrenze und Anmeldeschluss zusammen geprüft werden müssen.
--   4. „Inkognito" ist kein Anzeigeschalter, sondern eine Rechtefrage. Bei einem
--      inkognito geführten Training sehen Teilnehmer weder die Namen der anderen noch
--      deren Zahl — das entscheidet die RLS, nicht die Oberfläche.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Aufzählungen
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'training_type') THEN
        CREATE TYPE public.training_type AS ENUM ('adults', 'youth');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'training_rhythm') THEN
        CREATE TYPE public.training_rhythm AS ENUM ('weekly', 'biweekly', 'monthly');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statistics_visibility') THEN
        CREATE TYPE public.statistics_visibility AS ENUM ('all', 'admins', 'groups');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        -- „später" ist bewusst ein eigener Status und keine Zusage mit Bemerkung:
        -- der Trainer plant damit anders (Aufwärmen, Gruppeneinteilung).
        CREATE TYPE public.attendance_status AS ENUM ('yes', 'late', 'no');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
        CREATE TYPE public.attendance_source AS ENUM ('auto', 'self', 'trainer', 'link');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'holiday_kind') THEN
        CREATE TYPE public.holiday_kind AS ENUM ('public', 'school');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Feiertage und Schulferien
--
-- Gefüllt aus öffentlichen Quellen (Aufgabe 6.2), je Bundesland. Der Verein wählt
-- sein Bundesland in den Vereinsdaten; die Session-Erzeugung liest nur die Zeilen
-- dieses Landes.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.holidays (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundesland  CHAR(2) NOT NULL,
    kind        public.holiday_kind NOT NULL,
    name        TEXT NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT holidays_range_check CHECK (end_date >= start_date)
);

-- Der Import läuft jährlich erneut über dieselben Jahre. Ohne diesen Index würde
-- jeder Lauf die Tabelle verdoppeln.
CREATE UNIQUE INDEX IF NOT EXISTS holidays_unique
    ON public.holidays (bundesland, kind, name, start_date);

CREATE INDEX IF NOT EXISTS holidays_range_idx
    ON public.holidays (bundesland, kind, start_date, end_date);

-- ----------------------------------------------------------------------------
-- 3. Trainings
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trainings (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    type                   public.training_type NOT NULL DEFAULT 'adults',

    -- ISO-Zählung wie in date-fns: 1 = Montag … 7 = Sonntag.
    weekday                INTEGER NOT NULL,
    time_start             TIME NOT NULL,
    time_end               TIME,
    venue_id               UUID REFERENCES public.venues(id) ON DELETE SET NULL,

    rhythm                 public.training_rhythm NOT NULL DEFAULT 'weekly',
    -- Ankerdatum des Rhythmus: „zweiwöchentlich" zählt ab hier, nicht ab Jahresbeginn.
    start_date             DATE NOT NULL DEFAULT CURRENT_DATE,

    reminder_hours         INTEGER NOT NULL DEFAULT 5,
    details                TEXT NOT NULL DEFAULT '',
    max_participants       INTEGER,

    -- Offenes Training: jedes aktive Mitglied darf kommen, auch Gäste sehen es.
    is_open                BOOLEAN NOT NULL DEFAULT false,
    -- Zuordnung nur durch den Trainer; niemand trägt sich selbst ein.
    trainer_invites_only   BOOLEAN NOT NULL DEFAULT false,
    -- Inkognito: Teilnehmer sehen weder Namen noch Zahl der anderen.
    is_incognito           BOOLEAN NOT NULL DEFAULT false,
    requires_key_owner     BOOLEAN NOT NULL DEFAULT false,

    skip_public_holidays   BOOLEAN NOT NULL DEFAULT true,
    skip_school_holidays   BOOLEAN NOT NULL DEFAULT false,
    hide_in_calendar       BOOLEAN NOT NULL DEFAULT false,
    auto_cancel_no_trainers BOOLEAN NOT NULL DEFAULT false,

    statistics_visibility  public.statistics_visibility NOT NULL DEFAULT 'admins',
    active                 BOOLEAN NOT NULL DEFAULT true,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT trainings_weekday_check  CHECK (weekday BETWEEN 1 AND 7),
    CONSTRAINT trainings_time_check     CHECK (time_end IS NULL OR time_end > time_start),
    CONSTRAINT trainings_reminder_check CHECK (reminder_hours BETWEEN 0 AND 336),
    CONSTRAINT trainings_max_check      CHECK (max_participants IS NULL OR max_participants > 0)
);

DROP TRIGGER IF EXISTS trainings_updated_at ON public.trainings;
CREATE TRIGGER trainings_updated_at
    BEFORE UPDATE ON public.trainings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.training_trainers (
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (training_id, profile_id)
);

CREATE INDEX IF NOT EXISTS training_trainers_profile_idx
    ON public.training_trainers (profile_id);

CREATE TABLE IF NOT EXISTS public.training_members (
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (training_id, profile_id)
);

CREATE INDEX IF NOT EXISTS training_members_profile_idx
    ON public.training_members (profile_id);

-- Wessen Anwesenheitsstatistik dieses Training sehen darf, wenn
-- `statistics_visibility = 'groups'` steht.
CREATE TABLE IF NOT EXISTS public.training_statistics_groups (
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    PRIMARY KEY (training_id, group_id)
);

-- Welche Trainings ein Mitglied überhaupt erinnert bekommen will. Keine Zeile
-- heißt: alle — so muss niemand etwas einstellen, um Erinnerungen zu bekommen.
CREATE TABLE IF NOT EXISTS public.training_reminder_filter (
    profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, training_id)
);

-- ----------------------------------------------------------------------------
-- 4. Ausfälle
--
-- Entweder ein Training fällt aus (`training_id`) oder eine Halle ist gesperrt
-- (`venue_id`) — dann trifft es alle Trainings dort. Genau eines von beiden.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_cancellations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_id  UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
    venue_id     UUID REFERENCES public.venues(id) ON DELETE CASCADE,
    from_date    DATE NOT NULL,
    to_date      DATE NOT NULL,
    reason       TEXT NOT NULL DEFAULT '',
    notify_email BOOLEAN NOT NULL DEFAULT false,
    created_by   UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT training_cancellations_target_check
        CHECK ((training_id IS NULL) <> (venue_id IS NULL)),
    CONSTRAINT training_cancellations_range_check CHECK (to_date >= from_date)
);

CREATE INDEX IF NOT EXISTS training_cancellations_training_idx
    ON public.training_cancellations (training_id, from_date, to_date);

CREATE INDEX IF NOT EXISTS training_cancellations_venue_idx
    ON public.training_cancellations (venue_id, from_date, to_date);

-- ----------------------------------------------------------------------------
-- 5. Termine
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_id     UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    session_date    DATE NOT NULL,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ,

    cancelled       BOOLEAN NOT NULL DEFAULT false,
    cancel_reason   TEXT NOT NULL DEFAULT '',
    -- Woher der Ausfall kommt. NULL bei einem Ausfall, den der Trainer von Hand
    -- gesetzt hat oder den `auto_cancel_no_trainers` ausgelöst hat.
    cancellation_id UUID REFERENCES public.training_cancellations(id) ON DELETE SET NULL,

    reminder_sent_at TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT training_sessions_unique UNIQUE (training_id, session_date)
);

CREATE INDEX IF NOT EXISTS training_sessions_starts_idx
    ON public.training_sessions (starts_at);

DROP TRIGGER IF EXISTS training_sessions_updated_at ON public.training_sessions;
CREATE TRIGGER training_sessions_updated_at
    BEFORE UPDATE ON public.training_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Teilnahme
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.training_attendance (
    session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status     public.attendance_status NOT NULL,
    guests     INTEGER NOT NULL DEFAULT 0,
    source     public.attendance_source NOT NULL DEFAULT 'self',
    updated_by UUID REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (session_id, profile_id),
    CONSTRAINT training_attendance_guests_check CHECK (guests BETWEEN 0 AND 20)
);

CREATE INDEX IF NOT EXISTS training_attendance_profile_idx
    ON public.training_attendance (profile_id);

DROP TRIGGER IF EXISTS training_attendance_updated_at ON public.training_attendance;
CREATE TRIGGER training_attendance_updated_at
    BEFORE UPDATE ON public.training_attendance
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Wer regelmäßig kommt, will nicht jede Woche dieselbe Frage beantworten. Bis
-- `until_date` setzt die Session-Erzeugung die Zusage automatisch (Aufgabe 6.7);
-- ändern lässt sie sich danach jederzeit von Hand.
CREATE TABLE IF NOT EXISTS public.training_auto_attendance (
    profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    until_date  DATE NOT NULL,
    late        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, training_id)
);

-- ----------------------------------------------------------------------------
-- 7. Rechte-Helfer
--
-- Alle SECURITY DEFINER mit festem search_path: sie werden aus Policies heraus
-- aufgerufen und dürfen deshalb nicht selbst wieder in die RLS derselben Tabelle
-- laufen.
-- ----------------------------------------------------------------------------

-- Leitet der Angemeldete dieses Training?
CREATE OR REPLACE FUNCTION public.trains(p_training_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.training_trainers
         WHERE training_id = p_training_id AND profile_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.trains_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.training_sessions s
          JOIN public.training_trainers tt ON tt.training_id = s.training_id
         WHERE s.id = p_session_id AND tt.profile_id = auth.uid()
    );
$$;

-- Darf der Angemeldete dieses Training überhaupt sehen? Mitglieder sehen alle,
-- Gäste nur offene oder solche, denen sie zugeordnet sind.
CREATE OR REPLACE FUNCTION public.can_see_training(p_training_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.is_active_member() AND EXISTS (
        SELECT 1
          FROM public.trainings t
         WHERE t.id = p_training_id
           AND (
               public.current_member_role() <> 'guest'
               OR t.is_open
               OR EXISTS (
                   SELECT 1 FROM public.training_members tm
                    WHERE tm.training_id = t.id AND tm.profile_id = auth.uid()
               )
               OR EXISTS (
                   SELECT 1 FROM public.training_trainers tt
                    WHERE tt.training_id = t.id AND tt.profile_id = auth.uid()
               )
           )
    );
$$;

-- Darf der Angemeldete sehen, wer zu diesem Training gehört und wer kommt?
-- Genau hier wirkt „Inkognito": für alle außer Trainer und Admin fällt die Liste
-- (und damit auch der Zähler) weg.
CREATE OR REPLACE FUNCTION public.may_see_training_roster(p_training_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.is_admin()
        OR public.trains(p_training_id)
        OR (
            public.can_see_training(p_training_id)
            AND NOT EXISTS (
                SELECT 1 FROM public.trainings t
                 WHERE t.id = p_training_id AND t.is_incognito
            )
        );
$$;

CREATE OR REPLACE FUNCTION public.may_see_session_roster(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.may_see_training_roster(
        (SELECT training_id FROM public.training_sessions WHERE id = p_session_id)
    );
$$;

-- Darf sich der Angemeldete selbst zu diesem Training eintragen (Liste
-- „Offene Trainings", Aufgabe 6.5)?
CREATE OR REPLACE FUNCTION public.may_join_training(p_training_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT public.is_active_member() AND EXISTS (
        SELECT 1 FROM public.trainings t
         WHERE t.id = p_training_id
           AND t.active
           AND t.is_open
           AND NOT t.trainer_invites_only
    );
$$;

REVOKE ALL ON FUNCTION public.trains(UUID)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trains_session(UUID)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_see_training(UUID)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.may_see_training_roster(UUID)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.may_see_session_roster(UUID)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.may_join_training(UUID)        FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.trains(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.trains_session(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_training(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.may_see_training_roster(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.may_see_session_roster(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.may_join_training(UUID)       TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. RPC: Teilnahme setzen
--
-- Der einzige Weg in `training_attendance`. Vier Prüfungen gehören zusammen und
-- dürfen deshalb nicht auf Policy und Oberfläche verteilt werden:
-- Zuordnung, Teilnehmergrenze, Anmeldeschluss und ob der Termin überhaupt stattfindet.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_set_training_attendance(
    p_session_id UUID,
    p_status     public.attendance_status,
    p_guests     INTEGER DEFAULT 0,
    p_profile_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me       UUID := auth.uid();
    v_target   UUID := COALESCE(p_profile_id, auth.uid());
    v_session  public.training_sessions%ROWTYPE;
    v_training public.trainings%ROWTYPE;
    v_manages  BOOLEAN;
    v_guests   INTEGER := COALESCE(p_guests, 0);
    v_taken    INTEGER;
BEGIN
    IF v_me IS NULL OR NOT public.is_active_member() THEN
        RAISE EXCEPTION 'Nur aktive Mitglieder können sich zum Training melden.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_session FROM public.training_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Diesen Trainingstermin gibt es nicht (mehr).'
            USING ERRCODE = 'no_data_found';
    END IF;

    SELECT * INTO v_training FROM public.trainings WHERE id = v_session.training_id;

    v_manages := public.is_admin() OR public.trains(v_training.id);

    -- Für andere melden dürfen nur Trainer und Admin.
    IF v_target <> v_me AND NOT v_manages THEN
        RAISE EXCEPTION 'Nur Trainer und Administratoren melden andere zum Training.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_session.cancelled THEN
        RAISE EXCEPTION 'Dieser Trainingstermin fällt aus.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Zuordnung: entweder das Training ist offen, oder die Person gehört dazu.
    IF NOT v_manages
       AND NOT v_training.is_open
       AND NOT EXISTS (
           SELECT 1 FROM public.training_members
            WHERE training_id = v_training.id AND profile_id = v_target
       ) THEN
        RAISE EXCEPTION 'Du bist diesem Training nicht zugeordnet.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Anmeldeschluss ist der Beginn. Trainer dürfen danach noch nachtragen —
    -- sonst ließe sich die Anwesenheit nie korrigieren.
    IF v_session.starts_at <= NOW() AND NOT v_manages THEN
        RAISE EXCEPTION 'Dieser Trainingstermin hat bereits begonnen.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_guests < 0 THEN
        v_guests := 0;
    END IF;

    -- Teilnehmergrenze. Gäste zählen mit, die eigene alte Zusage nicht.
    IF v_training.max_participants IS NOT NULL
       AND p_status IN ('yes', 'late')
       AND NOT v_manages THEN
        SELECT COALESCE(SUM(1 + guests), 0) INTO v_taken
          FROM public.training_attendance
         WHERE session_id = p_session_id
           AND status IN ('yes', 'late')
           AND profile_id <> v_target;

        IF v_taken + 1 + v_guests > v_training.max_participants THEN
            RAISE EXCEPTION
                'Für dieses Training sind nur % Plätze vorgesehen, davon sind schon % vergeben.',
                v_training.max_participants, v_taken
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    INSERT INTO public.training_attendance
        (session_id, profile_id, status, guests, source, updated_by)
    VALUES
        (p_session_id, v_target, p_status, v_guests,
         CASE WHEN v_target = v_me THEN 'self' ELSE 'trainer' END::public.attendance_source,
         v_me)
    ON CONFLICT (session_id, profile_id) DO UPDATE
       SET status     = EXCLUDED.status,
           guests     = EXCLUDED.guests,
           source     = EXCLUDED.source,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_training_attendance(UUID, public.attendance_status, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_training_attendance(UUID, public.attendance_status, INTEGER, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.holidays                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_trainers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_statistics_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_reminder_filter    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_cancellations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_auto_attendance    ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.holidays, public.trainings, public.training_trainers,
       public.training_members, public.training_statistics_groups,
       public.training_reminder_filter, public.training_cancellations,
       public.training_sessions, public.training_attendance,
       public.training_auto_attendance
    TO authenticated;

-- --- holidays ----------------------------------------------------------------
-- Öffentliche Kalenderdaten. Lesen alle, pflegen nur der Import (Service Role)
-- und der Administrator.
DROP POLICY IF EXISTS holidays_select ON public.holidays;
CREATE POLICY holidays_select ON public.holidays
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS holidays_write ON public.holidays;
CREATE POLICY holidays_write ON public.holidays
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- --- trainings ---------------------------------------------------------------
DROP POLICY IF EXISTS trainings_select ON public.trainings;
CREATE POLICY trainings_select ON public.trainings
    FOR SELECT TO authenticated
    USING (public.can_see_training(id));

-- Beim Anlegen gibt es noch keinen Trainer-Eintrag, an dem `trains()` greifen
-- könnte. Ein Trainer darf deshalb anlegen, ändern aber nur seine eigenen.
DROP POLICY IF EXISTS trainings_insert ON public.trainings;
CREATE POLICY trainings_insert ON public.trainings
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_member_role() = 'trainer');

DROP POLICY IF EXISTS trainings_update ON public.trainings;
CREATE POLICY trainings_update ON public.trainings
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.trains(id))
    WITH CHECK (public.is_admin() OR public.trains(id));

DROP POLICY IF EXISTS trainings_delete ON public.trainings;
CREATE POLICY trainings_delete ON public.trainings
    FOR DELETE TO authenticated
    USING (public.is_admin() OR public.trains(id));

-- --- training_trainers -------------------------------------------------------
-- Wer ein Training leitet, steht auch bei Inkognito offen: sonst wüsste niemand,
-- an wen er sich wenden soll.
DROP POLICY IF EXISTS training_trainers_select ON public.training_trainers;
CREATE POLICY training_trainers_select ON public.training_trainers
    FOR SELECT TO authenticated
    USING (public.can_see_training(training_id));

DROP POLICY IF EXISTS training_trainers_write ON public.training_trainers;
CREATE POLICY training_trainers_write ON public.training_trainers
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.trains(training_id))
    WITH CHECK (public.is_admin() OR public.trains(training_id));

-- --- training_members --------------------------------------------------------
DROP POLICY IF EXISTS training_members_select ON public.training_members;
CREATE POLICY training_members_select ON public.training_members
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.may_see_training_roster(training_id));

DROP POLICY IF EXISTS training_members_write ON public.training_members;
CREATE POLICY training_members_write ON public.training_members
    FOR ALL TO authenticated
    USING (
        public.is_admin()
        OR public.trains(training_id)
        OR (profile_id = auth.uid() AND public.may_join_training(training_id))
    )
    WITH CHECK (
        public.is_admin()
        OR public.trains(training_id)
        OR (profile_id = auth.uid() AND public.may_join_training(training_id))
    );

-- --- training_statistics_groups ----------------------------------------------
DROP POLICY IF EXISTS training_statistics_groups_select ON public.training_statistics_groups;
CREATE POLICY training_statistics_groups_select ON public.training_statistics_groups
    FOR SELECT TO authenticated
    USING (public.can_see_training(training_id));

DROP POLICY IF EXISTS training_statistics_groups_write ON public.training_statistics_groups;
CREATE POLICY training_statistics_groups_write ON public.training_statistics_groups
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.trains(training_id))
    WITH CHECK (public.is_admin() OR public.trains(training_id));

-- --- training_reminder_filter ------------------------------------------------
DROP POLICY IF EXISTS training_reminder_filter_own ON public.training_reminder_filter;
CREATE POLICY training_reminder_filter_own ON public.training_reminder_filter
    FOR ALL TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid() AND public.can_see_training(training_id));

-- --- training_cancellations --------------------------------------------------
-- Ein Hallenausfall betrifft alle Trainings dort, deshalb darf ihn nur der
-- Administrator eintragen. Sein eigenes Training sagt jeder Trainer selbst ab.
DROP POLICY IF EXISTS training_cancellations_select ON public.training_cancellations;
CREATE POLICY training_cancellations_select ON public.training_cancellations
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS training_cancellations_write ON public.training_cancellations;
CREATE POLICY training_cancellations_write ON public.training_cancellations
    FOR ALL TO authenticated
    USING (public.is_admin() OR (training_id IS NOT NULL AND public.trains(training_id)))
    WITH CHECK (public.is_admin() OR (training_id IS NOT NULL AND public.trains(training_id)));

-- --- training_sessions -------------------------------------------------------
-- Geschrieben wird ausschließlich vom Erzeugungs-Job (Service Role) und aus
-- Triggern heraus; darum gibt es hier nur eine Lese-Policy.
DROP POLICY IF EXISTS training_sessions_select ON public.training_sessions;
CREATE POLICY training_sessions_select ON public.training_sessions
    FOR SELECT TO authenticated
    USING (public.can_see_training(training_id));

-- --- training_attendance -----------------------------------------------------
-- Lesen: die eigene Zeile immer, fremde nur, wenn das Training nicht inkognito
-- läuft. Schreiben: niemand direkt, nur über `rpc_set_training_attendance`.
DROP POLICY IF EXISTS training_attendance_select ON public.training_attendance;
CREATE POLICY training_attendance_select ON public.training_attendance
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.may_see_session_roster(session_id));

-- --- training_auto_attendance ------------------------------------------------
DROP POLICY IF EXISTS training_auto_attendance_own ON public.training_auto_attendance;
CREATE POLICY training_auto_attendance_own ON public.training_auto_attendance
    FOR ALL TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin())
    WITH CHECK (
        (profile_id = auth.uid() OR public.is_admin())
        AND public.can_see_training(training_id)
    );

-- ----------------------------------------------------------------------------
-- 10. Sichten
-- ----------------------------------------------------------------------------

-- Die Teilnehmerliste eines Termins mit Namen. security_invoker: die Policy auf
-- `training_attendance` entscheidet, wer wen sieht — inkognito bleibt inkognito.
CREATE OR REPLACE VIEW public.v_session_participants
WITH (security_invoker = true) AS
SELECT
    a.session_id,
    s.training_id,
    a.profile_id,
    p.full_name,
    a.status,
    a.guests,
    a.source,
    a.updated_at
  FROM public.training_attendance a
  JOIN public.training_sessions s ON s.id = a.session_id
  JOIN public.profiles p          ON p.id = a.profile_id;

GRANT SELECT ON public.v_session_participants TO authenticated;

-- Der Zähler für die Trainings-Karte. Bewusst **ohne** security_invoker: die
-- Aggregation soll die volle Zahl liefern, nicht nur die sichtbaren Zeilen. Wer
-- die Zahl sehen darf, entscheidet stattdessen die WHERE-Bedingung — bei einem
-- inkognito geführten Training also nur Trainer und Administrator.
CREATE OR REPLACE VIEW public.v_session_counts AS
SELECT
    s.id          AS session_id,
    s.training_id,
    COUNT(*) FILTER (WHERE a.status = 'yes')                                  AS yes_count,
    COUNT(*) FILTER (WHERE a.status = 'late')                                 AS late_count,
    COUNT(*) FILTER (WHERE a.status = 'no')                                   AS no_count,
    COALESCE(SUM(a.guests) FILTER (WHERE a.status IN ('yes', 'late')), 0)::int AS guest_count
  FROM public.training_sessions s
  LEFT JOIN public.training_attendance a ON a.session_id = s.id
 WHERE public.may_see_session_roster(s.id)
 GROUP BY s.id, s.training_id;

GRANT SELECT ON public.v_session_counts TO authenticated;
