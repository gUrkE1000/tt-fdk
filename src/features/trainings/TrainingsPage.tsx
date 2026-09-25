import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarOff, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import TableTennis from '../../components/icons/TableTennis';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Menu,
  PageHeader,
  Table,
  Tabs,
  useToast,
} from '../../components/ui';
import { useGroups, useMembers } from '../members/api';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import {
  useDeleteTraining,
  useTrainings,
  useUpdateTraining,
  type TrainingWithPeople,
} from './api';
import {
  RHYTHM_LABELS,
  TRAINING_TYPE_LABELS,
  formatSchedule,
} from './schemas';
import AssignMembersDialog from './AssignMembersDialog';
import OpenTrainingsList from './OpenTrainingsList';
import SessionsTab from './SessionsTab';
import CancellationDialog from './CancellationDialog';
import TrainingDialog from './TrainingDialog';

export default function TrainingsPage() {
  return (
    <div>
      <PageHeader title="Trainings" description="Termine, Teilnahme und Planung." />

      <Tabs
        tabs={[
          { value: 'sessions', label: 'Termine', content: <SessionsTab /> },
          { value: 'open', label: 'Offene Trainings', content: <OpenTrainingsList /> },
          { value: 'planning', label: 'Planung', content: <PlanningTab /> },
        ]}
      />
    </div>
  );
}

/**
 * Die Verwaltungssicht: alle Trainings mit Zeitpunkt, Trainern, Zuordnung und Rhythmus.
 * Der „Aktiv“-Schalter steht direkt in der Zeile, weil das Stilllegen eines Trainings
 * der häufigste Eingriff ist — zum Saisonende trifft es mehrere auf einmal.
 */
function PlanningTab() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const trainings = useTrainings();
  const members = useMembers();
  const venues = useVenues();
  const groups = useGroups();
  const teams = useTeams();
  const updateTraining = useUpdateTraining();
  const deleteTraining = useDeleteTraining();

  const [editing, setEditing] = useState<TrainingWithPeople | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TrainingWithPeople | null>(null);

  const trainingList = trainings.data ?? [];
  const memberList = members.data ?? [];
  const nameOf = (id: string) =>
    memberList.find((member) => member.id === id)?.full_name ?? 'Unbekannt';

  async function onToggleActive(training: TrainingWithPeople, active: boolean) {
    try {
      await updateTraining.mutateAsync({ id: training.id, values: { active } });
      toast(active ? `${training.name} ist wieder aktiv` : `${training.name} ist stillgelegt`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Ändern fehlgeschlagen', 'error');
    }
  }

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await deleteTraining.mutateAsync(toDelete.id);
      toast(`${toDelete.name} wurde gelöscht`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  function nameCell(training: TrainingWithPeople) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900">{training.name}</span>
          <Badge tone="neutral">{TRAINING_TYPE_LABELS[training.type]}</Badge>
          {training.is_open && <Badge tone="primary">offenes Training</Badge>}
          {training.is_incognito && <Badge tone="neutral">inkognito</Badge>}
        </div>
        <p className="text-xs text-gray-500">{formatSchedule(training)}</p>
      </div>
    );
  }

  function actions(training: TrainingWithPeople) {
    return (
      <div className="flex items-center justify-end gap-1">
        <IconButton
          icon={UserPlus}
          label={`Mitglieder für ${training.name} zuweisen`}
          onClick={() => {
            setAssignFor(training.id);
            setAssignOpen(true);
          }}
        />
        <IconButton
          icon={CalendarOff}
          label={`Ausfälle von ${training.name}`}
          onClick={() => navigate(`/trainings/cancellations/${training.id}`)}
        />
        <IconButton
          icon={Pencil}
          label={`${training.name} bearbeiten`}
          onClick={() => {
            setEditing(training);
            setDialogOpen(true);
          }}
        />
        <IconButton
          icon={Trash2}
          label={`${training.name} löschen`}
          tone="danger"
          onClick={() => setToDelete(training)}
        />
      </div>
    );
  }

  function activeCell(training: TrainingWithPeople) {
    return (
      <Checkbox
        checked={training.active}
        onCheckedChange={(value) => void onToggleActive(training, value)}
        label={`${training.name} aktiv`}
        className="[&_label]:sr-only"
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Menu
          label="Weitere Aktionen"
          variant="secondary"
          items={[
            {
              label: 'Mitglieder zuweisen',
              icon: UserPlus,
              hint: 'Mannschaften, Gruppen und einzelne Mitglieder auf einmal',
              onSelect: () => {
                setAssignFor(null);
                setAssignOpen(true);
              },
            },
            {
              label: 'Ausfall anlegen',
              icon: CalendarOff,
              hint: 'Einzelner Tag oder Zeitraum, je Training oder Halle',
              onSelect: () => setCancelOpen(true),
            },
            {
              label: 'Alle Ausfälle ansehen',
              icon: CalendarOff,
              onSelect: () => navigate('/trainings/cancellations'),
            },
          ]}
        />
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Training anlegen
        </Button>
      </div>

      <Table
        columns={[
          { key: 'name', header: 'Name', cell: nameCell },
          {
            key: 'when',
            header: 'Zeitpunkt',
            cell: (training: TrainingWithPeople) => formatSchedule(training),
          },
          {
            key: 'trainers',
            header: 'Trainer',
            cell: (training: TrainingWithPeople) => training.trainerIds.map(nameOf).join(', ') || '—',
          },
          {
            key: 'members',
            header: 'Mitglieder',
            cell: (training: TrainingWithPeople) =>
              training.is_open ? 'offen für alle' : String(training.memberIds.length),
          },
          {
            key: 'rhythm',
            header: 'Rhythmus',
            cell: (training: TrainingWithPeople) => RHYTHM_LABELS[training.rhythm],
          },
          { key: 'active', header: 'Aktiv', align: 'center', cell: activeCell },
          { key: 'actions', header: 'Aktion', align: 'right', cell: actions },
        ]}
        rows={trainingList}
        rowKey={(training) => training.id}
        mobileCard={(training) => (
          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                {nameCell(training)}
                {activeCell(training)}
              </div>
              <p className="text-sm text-gray-500">
                {RHYTHM_LABELS[training.rhythm]} ·{' '}
                {training.is_open
                  ? 'offen für alle'
                  : `${training.memberIds.length} zugeordnet`}
                {training.trainerIds.length > 0 &&
                  ` · ${training.trainerIds.map(nameOf).join(', ')}`}
              </p>
              {actions(training)}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={TableTennis}
            title="Noch keine Trainings"
            description="Lege ein Training an — die Termine dazu entstehen daraus von selbst."
          />
        }
      />

      <TrainingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        training={editing}
        members={memberList}
        venues={venues.data ?? []}
        groups={groups.data ?? []}
      />

      <AssignMembersDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        trainings={trainingList}
        teams={teams.data ?? []}
        groups={groups.data ?? []}
        members={memberList}
        trainingId={assignFor}
      />

      <CancellationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        trainings={trainingList}
        venues={venues.data ?? []}
      />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`${toDelete?.name ?? 'Training'} löschen?`}
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
          Mit dem Training verschwinden auch alle seine Termine und die Rückmeldungen dazu. Soll
          es nur keine neuen Termine mehr geben, nimm stattdessen den Haken bei „Aktiv“ heraus.
        </p>
      </Dialog>
    </div>
  );
}
