import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  DateInput,
  Dialog,
  EmptyState,
  FormField,
  IconButton,
  Select,
  Table,
  useToast,
} from '../../components/ui';
import { formatDate, todayInBerlin } from '../../lib/dates';
import {
  useDeleteAutoAttendance,
  useMyAutoAttendance,
  useSaveAutoAttendance,
  useTrainings,
  type AutoAttendance,
} from '../trainings/api';
import {
  AUTO_ATTENDANCE_HINT,
  EMPTY_AUTO_ATTENDANCE,
  autoAttendanceSchema,
  autoAttendanceStatus,
  formatSchedule,
  type AutoAttendanceValues,
} from '../trainings/schemas';

/**
 * Automatische Trainingszusagen (Aufgabe 6.7).
 *
 * Wer jede Woche kommt, will nicht jede Woche dieselbe Frage beantworten. Gesetzt wird die
 * Zusage nicht hier, sondern beim Erzeugen des Termins — deshalb wirkt sie erst ab dem
 * nächsten neuen Termin und lässt sich an jedem einzelnen wieder ändern.
 */
export default function AutoAttendanceTab({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const entries = useMyAutoAttendance(profileId);
  const trainings = useTrainings();
  const save = useSaveAutoAttendance();
  const remove = useDeleteAutoAttendance();

  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<AutoAttendanceValues>({
    resolver: zodResolver(autoAttendanceSchema),
    defaultValues: EMPTY_AUTO_ATTENDANCE,
  });

  useEffect(() => {
    if (dialogOpen) form.reset(EMPTY_AUTO_ATTENDANCE);
  }, [dialogOpen, form]);

  const today = todayInBerlin();
  const rows = entries.data ?? [];

  // Nur Trainings, zu denen man überhaupt kommen darf.
  const available = (trainings.data ?? []).filter(
    (training) => training.active && (training.is_open || training.memberIds.includes(profileId)),
  );

  const nameOf = (trainingId: string) =>
    available.find((training) => training.id === trainingId)?.name ??
    (trainings.data ?? []).find((training) => training.id === trainingId)?.name ??
    'Training';

  async function onDelete(row: AutoAttendance) {
    try {
      await remove.mutateAsync({ profileId, trainingId: row.training_id });
      toast('Automatische Zusage beendet', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    }
  }

  async function onSubmit(values: AutoAttendanceValues) {
    try {
      await save.mutateAsync({
        profile_id: profileId,
        training_id: values.trainingId,
        until_date: values.untilDate,
        late: values.late,
      });
      setDialogOpen(false);
      toast('Automatische Zusage aktiviert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  function statusCell(row: AutoAttendance) {
    const active = autoAttendanceStatus(row.until_date, today) === 'active';
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={active ? 'yes' : 'removed'}>{active ? 'aktiv' : 'abgelaufen'}</Badge>
        {row.late && <Badge tone="neutral">komme später</Badge>}
      </div>
    );
  }

  function deleteButton(row: AutoAttendance) {
    return (
      <IconButton
        icon={Trash2}
        label={`Automatische Zusage für ${nameOf(row.training_id)} beenden`}
        tone="danger"
        onClick={() => void onDelete(row)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-600">{AUTO_ATTENDANCE_HINT}</p>
        <Button
          variant="primary"
          disabled={available.length === 0}
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Automatische Zusage aktivieren
        </Button>
      </div>

      <Table
        columns={[
          {
            key: 'training',
            header: 'Training',
            cell: (row: AutoAttendance) => (
              <span className="font-semibold text-gray-900">{nameOf(row.training_id)}</span>
            ),
          },
          {
            key: 'until',
            header: 'Zusagen bis',
            cell: (row: AutoAttendance) => formatDate(row.until_date),
          },
          { key: 'status', header: 'Status', cell: statusCell },
          { key: 'actions', header: 'Aktion', align: 'right', cell: deleteButton },
        ]}
        rows={rows}
        rowKey={(row) => row.training_id}
        mobileCard={(row) => (
          <Card>
            <CardBody className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{nameOf(row.training_id)}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  bis {formatDate(row.until_date)}
                </p>
                <div className="mt-1">{statusCell(row)}</div>
              </div>
              {deleteButton(row)}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={CalendarCheck}
            title="Keine automatische Zusage"
            description="Solange hier nichts steht, wirst du zu jedem Termin einzeln gefragt."
          />
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Automatische Zusage aktivieren"
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button
              variant="primary"
              loading={form.formState.isSubmitting}
              onClick={form.handleSubmit(onSubmit)}
            >
              Speichern
            </Button>
          </>
        }
      >
        <form noValidate className="space-y-3">
          <FormField
            label="Training"
            required
            error={form.formState.errors.trainingId?.message}
          >
            {(p) => (
              <Select
                {...p}
                {...form.register('trainingId')}
                options={[
                  { value: '', label: 'Bitte auswählen' },
                  ...available.map((training) => ({
                    value: training.id,
                    label: `${training.name} — ${formatSchedule(training)}`,
                  })),
                ]}
              />
            )}
          </FormField>

          <FormField
            label="Automatisch zusagen bis"
            required
            hint="Danach wirst du wieder zu jedem Termin einzeln gefragt."
            error={form.formState.errors.untilDate?.message}
          >
            {(p) => <DateInput {...p} {...form.register('untilDate')} />}
          </FormField>

          <Checkbox
            checked={form.watch('late')}
            onCheckedChange={(value) => form.setValue('late', value)}
            label="Komme später"
            hint="Sagt statt „Bin dabei“ automatisch „Komme später“ zu."
          />
        </form>
      </Dialog>
    </div>
  );
}
