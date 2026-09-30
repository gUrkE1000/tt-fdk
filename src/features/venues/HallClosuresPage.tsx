import { useMemo, useState } from 'react';
import { CalendarOff, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  Table,
  useToast,
} from '../../components/ui';
import { formatDate, formatShortDayDate, todayInBerlin } from '../../lib/dates';
import { useMatches } from '../matches/api';
import { findVenueBlock } from '../matches/venueBlock';
import {
  useDeleteCancellation,
  useTrainingCancellations,
  useTrainings,
  type TrainingCancellation,
} from '../trainings/api';
import { useVenues } from './api';
import { useDefaultVenueId } from './defaultVenue';
import HallClosureDialog from './HallClosureDialog';

/**
 * Hallensperrungen: an einem Tag oder in einem Zeitraum ist eine Halle nicht nutzbar.
 * Alle Trainings dort fallen aus — der Erzeugungs-Job markiert die Termine als abgesagt,
 * die Rückmeldungen bleiben stehen. Heimspiele sagt die Sperrung nicht ab (Verbands-
 * termin); die Seite zeigt sie, damit sie verlegt werden.
 *
 * Früher ließen sich auch einzelne Trainings über einen Zeitraum absagen. Solche
 * Einträge stehen weiter hier, damit man sie zurücknehmen kann.
 */
export default function HallClosuresPage() {
  const { toast } = useToast();
  const trainings = useTrainings();
  const venues = useVenues();
  const matches = useMatches();
  const cancellations = useTrainingCancellations();
  const remove = useDeleteCancellation();
  const fallbackVenueId = useDefaultVenueId();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingCancellation | null>(null);
  const [toDelete, setToDelete] = useState<TrainingCancellation | null>(null);

  const venueList = venues.data ?? [];
  const today = todayInBerlin();

  // Kommende und laufende zuerst, nach Beginn; darunter die vergangenen, neueste oben.
  const rows = useMemo(() => {
    const all = cancellations.data ?? [];
    const upcoming = all
      .filter((row) => row.to_date >= today)
      .sort((a, b) => a.from_date.localeCompare(b.from_date));
    const past = all
      .filter((row) => row.to_date < today)
      .sort((a, b) => b.from_date.localeCompare(a.from_date));
    return [...upcoming, ...past];
  }, [cancellations.data, today]);

  const homeGamesIn = (row: TrainingCancellation) =>
    row.venue_id === null
      ? []
      : (matches.data ?? []).filter(
          (match) => findVenueBlock(match, [row], fallbackVenueId) !== null,
        );

  const nameOf = (row: TrainingCancellation) => {
    if (row.training_id) {
      return (trainings.data ?? []).find((entry) => entry.id === row.training_id)?.name ?? 'Training';
    }
    return venueList.find((venue) => venue.id === row.venue_id)?.name ?? 'Halle';
  };

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast('Die Sperrung ist aufgehoben', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  function actions(row: TrainingCancellation) {
    return (
      <div className="flex items-center justify-end gap-1">
        {row.venue_id !== null && (
          <IconButton
            icon={Pencil}
            label={`Sperrung vom ${formatDate(row.from_date)} ändern`}
            onClick={() => {
              setEditing(row);
              setDialogOpen(true);
            }}
          />
        )}
        <IconButton
          icon={Trash2}
          label={`Sperrung vom ${formatDate(row.from_date)} aufheben`}
          tone="danger"
          onClick={() => setToDelete(row)}
        />
      </div>
    );
  }

  function whatCell(row: TrainingCancellation) {
    const games = homeGamesIn(row);
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900">{nameOf(row)}</span>
          {row.training_id !== null && <Badge tone="neutral">nur dieses Training</Badge>}
          {row.to_date < today && <Badge tone="neutral">vorbei</Badge>}
          {games.length > 0 && (
            <Badge tone="late">
              {games.length === 1 ? '1 Heimspiel betroffen' : `${games.length} Heimspiele betroffen`}
            </Badge>
          )}
        </div>
        {games.length > 0 && (
          <ul className="text-xs text-status-late">
            {games.map((match) => (
              <li key={match.id}>
                {match.dtstart && formatShortDayDate(match.dtstart)} gegen{' '}
                {match.opponent || 'unbekannt'} — muss verlegt werden
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const period = (row: TrainingCancellation) =>
    row.to_date === row.from_date
      ? formatDate(row.from_date)
      : `${formatDate(row.from_date)} bis ${formatDate(row.to_date)}`;

  return (
    <div>
      <PageHeader
        title="Hallensperrungen"
        description="Tage oder Zeiträume, an denen eine Halle nicht nutzbar ist. Die Trainings dort fallen aus."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Hallensperrung anlegen
          </Button>
        }
      />

      <Table
        columns={[
          { key: 'what', header: 'Halle', cell: whatCell },
          { key: 'when', header: 'Zeitraum', cell: period },
          {
            key: 'reason',
            header: 'Grund',
            cell: (row: TrainingCancellation) => row.reason || '—',
          },
          { key: 'actions', header: 'Aktion', align: 'right', cell: actions },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        mobileCard={(row) => (
          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                {whatCell(row)}
                {actions(row)}
              </div>
              <p className="text-sm text-gray-600">{period(row)}</p>
              {row.reason && <p className="text-sm text-gray-500">{row.reason}</p>}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={CalendarOff}
            title="Keine Hallensperrungen"
            description="Solange hier nichts steht, findet jedes Training nach Plan statt."
          />
        }
      />

      <HallClosureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        venues={venueList}
        closure={editing}
      />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Sperrung aufheben?"
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => void onDeleteConfirmed()}>
              Aufheben
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Die betroffenen Trainings finden dann wieder statt. Termine, die ein Trainer von Hand
          abgesagt hat, bleiben abgesagt.
        </p>
      </Dialog>
    </div>
  );
}
