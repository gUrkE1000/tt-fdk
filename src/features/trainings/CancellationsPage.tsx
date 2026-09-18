import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarOff, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  Table,
  useToast,
} from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { useSession } from '../auth/session';
import { useVenues } from '../venues/api';
import {
  useDeleteCancellation,
  useTrainingCancellations,
  useTrainings,
  type TrainingCancellation,
} from './api';
import CancellationDialog from './CancellationDialog';

/**
 * Trainingsausfälle, entweder für ein einzelnes Training (`/trainings/cancellations/:id`)
 * oder für alle. Ein Ausfall löscht nichts: Der Erzeugungs-Job markiert die betroffenen
 * Termine als abgesagt und trägt den Grund ein, die Rückmeldungen bleiben stehen.
 */
export default function CancellationsPage() {
  const { trainingId } = useParams<{ trainingId: string }>();
  const { toast } = useToast();
  const { role } = useSession();

  const trainings = useTrainings();
  const venues = useVenues();
  const cancellations = useTrainingCancellations();
  const remove = useDeleteCancellation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TrainingCancellation | null>(null);

  const trainingList = trainings.data ?? [];
  const venueList = venues.data ?? [];
  const training = trainingList.find((entry) => entry.id === trainingId) ?? null;

  const nameOf = (row: TrainingCancellation) => {
    if (row.training_id) {
      return trainingList.find((entry) => entry.id === row.training_id)?.name ?? 'Training';
    }
    return venueList.find((venue) => venue.id === row.venue_id)?.name ?? 'Ort';
  };

  // Ein Hallenausfall trifft auch dieses Training, wenn es dort stattfindet — er gehört
  // deshalb in die Liste, obwohl er nicht an diesem Training hängt.
  const rows = (cancellations.data ?? []).filter((row) => {
    if (!trainingId) return true;
    if (row.training_id === trainingId) return true;
    return row.venue_id !== null && training !== null && row.venue_id === training.venue_id;
  });

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast('Der Ausfall ist zurückgenommen', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  function actions(row: TrainingCancellation) {
    return (
      <div className="flex items-center justify-end">
        <IconButton
          icon={Trash2}
          label={`Ausfall vom ${formatDate(row.from_date)} zurücknehmen`}
          tone="danger"
          onClick={() => setToDelete(row)}
        />
      </div>
    );
  }

  function whatCell(row: TrainingCancellation) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-gray-900">{nameOf(row)}</span>
        {row.venue_id !== null && <Badge tone="neutral">ganze Halle</Badge>}
        {row.notify_email && <Badge tone="primary">per E-Mail gemeldet</Badge>}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={training ? `Ausfälle: ${training.name}` : 'Trainingsausfälle'}
        description="Einzelne Tage oder ganze Zeiträume, je Training oder je Halle."
        actions={
          <>
            <Link to="/trainings" className={buttonClasses()}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Zurück
            </Link>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ausfall anlegen
            </Button>
          </>
        }
      />

      <Table
        columns={[
          { key: 'what', header: 'Betrifft', cell: whatCell },
          {
            key: 'from',
            header: 'Von',
            cell: (row: TrainingCancellation) => formatDate(row.from_date),
          },
          {
            key: 'to',
            header: 'Bis',
            cell: (row: TrainingCancellation) =>
              row.to_date === row.from_date ? '—' : formatDate(row.to_date),
          },
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
              <p className="text-sm text-gray-600">
                {formatDate(row.from_date)}
                {row.to_date !== row.from_date && ` bis ${formatDate(row.to_date)}`}
              </p>
              {row.reason && <p className="text-sm text-gray-500">{row.reason}</p>}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={CalendarOff}
            title="Keine Ausfälle eingetragen"
            description="Solange hier nichts steht, findet jedes Training nach Plan statt."
          />
        }
      />

      <CancellationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        trainings={trainingList}
        venues={venueList}
        trainingId={trainingId ?? null}
        allowVenue={role === 'admin'}
      />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Ausfall zurücknehmen?"
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => void onDeleteConfirmed()}>
              Zurücknehmen
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Die betroffenen Termine finden dann wieder statt. Termine, die ein Trainer von Hand
          abgesagt hat, bleiben abgesagt.
        </p>
      </Dialog>
    </div>
  );
}
