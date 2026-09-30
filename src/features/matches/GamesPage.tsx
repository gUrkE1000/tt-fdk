import { useMemo, useState } from 'react';
import { Download, KeyRound, Plus, SlidersHorizontal, Trash2, Users } from 'lucide-react';
import {
  Button,
  DeleteDialog,
  EmptyState,
  FilterBar,
  PageHeader,
  Segmented,
  Select,
  Tabs,
  useToast,
} from '../../components/ui';
import { RANKING_TYPE_LABELS } from '../../lib/labels';
import { useSession } from '../auth/session';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useMembers } from '../members/api';
import {
  useAllParticipations,
  useAllVolunteers,
  useDeleteMatches,
  useMatches,
  type MatchRow,
} from './api';
import {
  EMPTY_MATCH_FILTERS,
  filterMatches,
  hasActiveMatchFilters,
  isFinished,
  type MatchFilters,
} from './filters';
import GameTable from './GameTable';
import GameDialog from './GameDialog';
import ImportDialog from './ImportDialog';
import NuscoreImportDialog from './NuscoreImportDialog';
import ManagePlayersDialog from './ManagePlayersDialog';
import ShareLineupDialog from './ShareLineupDialog';
import RescheduleDialog from './RescheduleDialog';

type Scope = 'mine' | 'club';

const SCOPE_STORAGE_KEY = 'vp.games.scope';

/**
 * Die zuletzt gewählte Ansicht eines Administrators, je Gerät. `localStorage` kann
 * werfen (privates Fenster, gesperrte Website-Daten) — dann gilt die Voreinstellung.
 */
function readScope(): Scope {
  try {
    return window.localStorage.getItem(SCOPE_STORAGE_KEY) === 'club' ? 'club' : 'mine';
  } catch {
    return 'mine';
  }
}

function writeScope(scope: Scope) {
  try {
    window.localStorage.setItem(SCOPE_STORAGE_KEY, scope);
  } catch {
    // Nicht merken können ist kein Fehler: Beim nächsten Mal gilt wieder „Meine".
  }
}

export default function GamesPage() {
  const { toast } = useToast();
  const { profile, role } = useSession();
  // Mannschaftsführer brauchen unter „Beendete Termine" die ganze Saison.
  const matches = useMatches('all');
  const teams = useTeams();
  const venues = useVenues();
  const deleteMatches = useDeleteMatches();

  const [filters, setFilters] = useState<MatchFilters>(EMPTY_MATCH_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<MatchRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [nuscoreOpen, setNuscoreOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MatchRow[] | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [managing, setManaging] = useState<MatchRow | null>(null);
  const [sharing, setSharing] = useState<MatchRow | null>(null);
  const [rescheduling, setRescheduling] = useState<MatchRow | null>(null);

  // Ohne useMemo wäre `?? []` bei jedem Rendern ein neues Array — und jedes useMemo,
  // das davon abhängt, rechnete jedes Mal neu.
  const teamList = useMemo(() => teams.data ?? [], [teams.data]);
  const venueList = venues.data ?? [];
  const members = useMembers();
  const participations = useAllParticipations('all');
  const volunteers = useAllVolunteers('all');

  const nameOf = useMemo(() => {
    const names = new Map(
      (members.data ?? []).map((member) => [member.id, member.full_name ?? '']),
    );
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const rankingTypes = useMemo(
    () => Object.fromEntries(teamList.map((team) => [team.id, team.ranking_type])),
    [teamList],
  );

  const ledTeamIds = useMemo(
    () =>
      new Set(
        teamList
          .filter((team) => profile?.id != null && team.leaderIds.includes(profile.id))
          .map((team) => team.id),
      ),
    [teamList, profile?.id],
  );

  // Alle Mitglieder sehen alle Spiele (Rückmeldung 25.09.2026). Diese Seite ist aber die
  // Arbeitsliste, und die beginnt bei den eigenen Mannschaften — auch für einen
  // Administrator, der selbst eine Mannschaft führt. Den ganzen Verein holt er sich mit
  // einem Umschalter dazu; ein Mannschaftsführer verwaltet nur seine eigenen.
  const isAdmin = role === 'admin';
  const [scope, setScopeState] = useState<Scope>(readScope);
  const wholeClub = isAdmin && scope === 'club';

  function setScope(next: Scope) {
    setScopeState(next);
    writeScope(next);
    // Eine gewählte fremde Mannschaft gibt es in „Meine Mannschaften" nicht.
    setFilters((current) => ({ ...current, teamId: 'all' }));
    setSelected([]);
  }

  const scopedTeams = useMemo(
    () => (wholeClub ? teamList : teamList.filter((team) => ledTeamIds.has(team.id))),
    [wholeClub, teamList, ledTeamIds],
  );

  const scoped = useMemo(() => {
    const all = matches.data ?? [];
    if (wholeClub) return all;
    return all.filter((match) => ledTeamIds.has(match.team_id));
  }, [matches.data, wholeClub, ledTeamIds]);

  // Codes und PINs nur für Mannschaften, deren Spiele man auch ändern darf.
  const managedTeams = useMemo(
    () =>
      role === 'admin'
        ? teamList
        : teamList.filter((team) => profile?.id != null && team.leaderIds.includes(profile.id)),
    [role, teamList, profile?.id],
  );

  const visible = useMemo(
    () => filterMatches(scoped, filters, rankingTypes),
    [scoped, filters, rankingTypes],
  );

  const open = visible.filter((match) => !isFinished(match));
  const finished = visible.filter((match) => isFinished(match));

  // Alle abgesagten Termine, ungefiltert: Was aufgeräumt wird, richtet sich nicht danach,
  // welcher Filter gerade eingestellt ist.
  const cancelled = scoped.filter((match) => !match.active);

  async function onCleanupConfirmed() {
    try {
      const ids = cancelled.map((match) => match.id);
      await deleteMatches.mutateAsync(ids);
      setSelected([]);
      toast(
        ids.length === 1
          ? 'Ein entfallener Spieltermin gelöscht'
          : `${ids.length} entfallene Spieltermine gelöscht`,
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Aufräumen fehlgeschlagen', 'error');
    } finally {
      setCleanupOpen(false);
    }
  }

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await deleteMatches.mutateAsync(toDelete.map((match) => match.id));
      setSelected([]);
      toast(
        toDelete.length === 1 ? 'Spieltermin gelöscht' : `${toDelete.length} Spieltermine gelöscht`,
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  function table(rows: MatchRow[]) {
    return (
      <GameTable
        matches={rows}
        teams={teamList}
        venues={venueList}
        nameOf={nameOf}
        selected={selected}
        onSelectedChange={setSelected}
        onEdit={(match) => {
          setEditing(match);
          setDialogOpen(true);
        }}
        onDelete={(match) => setToDelete([match])}
        onManagePlayers={setManaging}
        onShareLineup={setSharing}
        onReschedule={setRescheduling}
        resetKey={`${scope}:${JSON.stringify(filters)}`}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Spieltermine"
        description="Spielplan abgleichen, Termine pflegen, Aufstellungen im Blick behalten."
        actions={
          <>
            <Button onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Spiele importieren
            </Button>
            <Button onClick={() => setNuscoreOpen(true)}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Codes &amp; PINs
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Spiel anlegen
            </Button>
          </>
        }
      />

      {isAdmin && (
        <Segmented
          label="Welche Spiele"
          value={scope}
          onChange={setScope}
          options={[
            ['mine', 'Meine Mannschaften'],
            ['club', 'Ganzer Verein'],
          ]}
          className="mb-3"
        />
      )}

      <FilterBar
        search={filters.search}
        onSearchChange={(search) => setFilters({ ...filters, search })}
        searchPlaceholder="Gegner, Liga oder Halle"
        onReset={() => {
          setFilters(EMPTY_MATCH_FILTERS);
          setShowMore(false);
        }}
        resetDisabled={!hasActiveMatchFilters(filters)}
      >
        <Select
          aria-label="Mannschaft"
          value={filters.teamId}
          onChange={(event) => setFilters({ ...filters, teamId: event.target.value })}
          options={[
            { value: 'all', label: 'Alle Mannschaften' },
            ...scopedTeams.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />
        <input
          type="date"
          aria-label="Zeitraum von"
          value={filters.from}
          onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          className="min-h-touch rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          aria-label="Zeitraum bis"
          value={filters.to}
          onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          className="min-h-touch rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <Button onClick={() => setShowMore((value) => !value)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filter hinzufügen
        </Button>
      </FilterBar>

      {showMore && (
        <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-gray-50 p-3">
          <Select
            aria-label="Rangtyp"
            value={filters.rankingType}
            onChange={(event) =>
              setFilters({
                ...filters,
                rankingType: event.target.value as MatchFilters['rankingType'],
              })
            }
            options={[
              { value: 'all', label: 'Alle Rangtypen' },
              ...Object.entries(RANKING_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Select
            aria-label="Spielort"
            value={filters.venueId}
            onChange={(event) => setFilters({ ...filters, venueId: event.target.value })}
            options={[
              { value: 'all', label: 'Alle Spielorte' },
              ...venueList.map((venue) => ({ value: venue.id, label: venue.name })),
            ]}
          />
          <Select
            aria-label="Spielerstand"
            value={filters.roster}
            onChange={(event) =>
              setFilters({ ...filters, roster: event.target.value as MatchFilters['roster'] })
            }
            options={[
              { value: 'all', label: 'Jeder Spielerstand' },
              { value: 'complete', label: 'Vollständig' },
              { value: 'incomplete', label: 'Unvollständig' },
            ]}
          />
          <Select
            aria-label="Terminabweichung"
            value={filters.rescheduled}
            onChange={(event) =>
              setFilters({
                ...filters,
                rescheduled: event.target.value as MatchFilters['rescheduled'],
              })
            }
            options={[
              { value: 'all', label: 'Alle Termine' },
              { value: 'only', label: 'Nur verlegte' },
            ]}
          />
          <Select
            aria-label="Code und PIN"
            value={filters.missingCode}
            onChange={(event) =>
              setFilters({
                ...filters,
                missingCode: event.target.value as MatchFilters['missingCode'],
              })
            }
            options={[
              { value: 'all', label: 'Mit und ohne Code' },
              { value: 'only', label: 'Ohne Code oder PIN' },
            ]}
          />
        </div>
      )}

      {cancelled.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-status-late-soft p-3">
          <span className="text-sm text-gray-900">
            <strong>
              {cancelled.length === 1
                ? 'Ein Spieltermin ist'
                : `${cancelled.length} Spieltermine sind`}{' '}
              als „entfällt“ markiert.
            </strong>{' '}
            Sie stehen nicht mehr im Verbandskalender. Rückmeldungen dazu verschwinden mit.
          </span>
          <Button variant="danger" size="sm" onClick={() => setCleanupOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Entfallene aufräumen
          </Button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-primary-soft p-3">
          <span className="text-sm font-semibold text-gray-900">
            {selected.length} ausgewählt
          </span>
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              setToDelete((matches.data ?? []).filter((match) => selected.includes(match.id)))
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Löschen
          </Button>
          <Button size="sm" onClick={() => setSelected([])}>
            Auswahl aufheben
          </Button>
        </div>
      )}

      {!wholeClub && teams.isSuccess && ledTeamIds.size === 0 ? (
        <EmptyState
          icon={Users}
          title="Du führst keine Mannschaft"
          description="Hier stehen die Spiele der Mannschaften, die du führst."
          action={
            isAdmin ? (
              <Button variant="primary" onClick={() => setScope('club')}>
                Ganzen Verein anzeigen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Tabs
          tabs={[
            {
              value: 'open',
              label: 'Offene Termine',
              count: open.length,
              content: table(open),
            },
            {
              value: 'finished',
              label: 'Beendete Termine',
              count: finished.length,
              content: table(finished),
            },
          ]}
        />
      )}

      <GameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        match={editing}
        teams={teamList}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} teams={teamList} />
      <NuscoreImportDialog
        open={nuscoreOpen}
        onOpenChange={setNuscoreOpen}
        teams={managedTeams}
        matches={scoped}
      />

      <ManagePlayersDialog
        open={managing !== null}
        onOpenChange={(next) => !next && setManaging(null)}
        match={managing}
        team={teamList.find((team) => team.id === managing?.team_id)}
        members={members.data ?? []}
      />

      <ShareLineupDialog
        open={sharing !== null}
        onOpenChange={(next) => !next && setSharing(null)}
        match={sharing}
        team={teamList.find((team) => team.id === sharing?.team_id)}
        venue={venueList.find((venue) => venue.id === sharing?.venue_id)}
        participations={(participations.data ?? []).filter(
          (entry) => entry.match_id === sharing?.id,
        )}
        volunteers={(volunteers.data ?? []).filter((entry) => entry.match_id === sharing?.id)}
        nameOf={nameOf}
      />

      <RescheduleDialog
        open={rescheduling !== null}
        onOpenChange={(next) => !next && setRescheduling(null)}
        match={rescheduling}
      />

      <DeleteDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        title={
          cancelled.length === 1
            ? 'Entfallenen Spieltermin löschen?'
            : `${cancelled.length} entfallene Spieltermine löschen?`
        }
        expected="löschen"
        confirmLabel="Aufräumen"
        onConfirm={onCleanupConfirmed}
      >
        <p className="text-sm text-gray-600">
          Gelöscht wird alles, was als „entfällt“ markiert ist — samt der Rückmeldungen dazu.
          Aktive Termine bleiben unangetastet. Steht ein Spiel wieder im Verbandskalender,
          legt der nächste Abgleich es neu an.
        </p>
      </DeleteDialog>

      <DeleteDialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
        title={
          toDelete && toDelete.length > 1
            ? `${toDelete.length} Spieltermine löschen?`
            : 'Spieltermin löschen?'
        }
        expected="löschen"
        onConfirm={onDeleteConfirmed}
      >
        <p className="text-sm text-gray-600">
          Mit dem Termin verschwinden alle Rückmeldungen dazu. Importierte Spiele legt der
          nächste Abgleich wieder an — soll ein Spiel dauerhaft weg, schalte den Abgleich für
          die Mannschaft ab.
        </p>
      </DeleteDialog>
    </div>
  );
}
