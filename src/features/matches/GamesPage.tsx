import { useMemo, useState } from 'react';
import { Download, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  FilterBar,
  PageHeader,
  Select,
  Tabs,
  useToast,
} from '../../components/ui';
import { RANKING_TYPE_LABELS } from '../../lib/labels';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useDeleteMatches, useMatches, type MatchRow } from './api';
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

export default function GamesPage() {
  const { toast } = useToast();
  const matches = useMatches();
  const teams = useTeams();
  const venues = useVenues();
  const deleteMatches = useDeleteMatches();

  const [filters, setFilters] = useState<MatchFilters>(EMPTY_MATCH_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<MatchRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MatchRow[] | null>(null);

  const teamList = teams.data ?? [];
  const venueList = venues.data ?? [];

  const rankingTypes = useMemo(
    () => Object.fromEntries(teamList.map((team) => [team.id, team.ranking_type])),
    [teamList],
  );

  const visible = useMemo(
    () => filterMatches(matches.data ?? [], filters, rankingTypes),
    [matches.data, filters, rankingTypes],
  );

  const open = visible.filter((match) => !isFinished(match));
  const finished = visible.filter((match) => isFinished(match));

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
        selected={selected}
        onSelectedChange={setSelected}
        onEdit={(match) => {
          setEditing(match);
          setDialogOpen(true);
        }}
        onDelete={(match) => setToDelete([match])}
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
            ...teamList.map((team) => ({ value: team.id, label: team.name })),
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

      <GameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        match={editing}
        teams={teamList}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} teams={teamList} />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
        title={
          toDelete && toDelete.length > 1
            ? `${toDelete.length} Spieltermine löschen?`
            : 'Spieltermin löschen?'
        }
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => void onDeleteConfirmed()}>
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Mit dem Termin verschwinden alle Rückmeldungen dazu. Importierte Spiele legt der
          nächste Abgleich wieder an — soll ein Spiel dauerhaft weg, schalte den Abgleich für
          die Mannschaft ab.
        </p>
      </Dialog>
    </div>
  );
}
