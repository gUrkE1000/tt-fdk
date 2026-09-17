import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  DateInput,
  Dialog,
  EmptyState,
  FormField,
  IconButton,
  Table,
  Textarea,
  useToast,
} from '../../components/ui';
import { formatDate } from '../../lib/dates';
import {
  useCreateAbsence,
  useDeleteAbsence,
  useMyAbsences,
  type Absence,
} from './api';
import { absenceSchema, type AbsenceValues } from './schemas';

export default function AbsencesTab({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const absences = useMyAbsences(profileId);
  const createAbsence = useCreateAbsence();
  const deleteAbsence = useDeleteAbsence();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<AbsenceValues>({ resolver: zodResolver(absenceSchema) });

  async function onDelete(id: string) {
    try {
      await deleteAbsence.mutateAsync(id);
      toast('Abwesenheit gelöscht', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    }
  }

  const rows = absences.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-600">
          Trage ein, wann du nicht kannst — Urlaub, Schicht, Verletzung. Mannschaftsführer und
          Trainer sehen den Zeitraum bei der Aufstellungsplanung, deinen Grund aber nicht.
        </p>
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Abwesenheit anlegen
        </Button>
      </div>

      <Table
        columns={[
          { key: 'from', header: 'Von', cell: (row: Absence) => formatDate(row.start_date!) },
          { key: 'to', header: 'Bis', cell: (row: Absence) => formatDate(row.end_date!) },
          {
            key: 'comment',
            header: 'Kommentar (nur für dich)',
            cell: (row: Absence) => row.comment_private ?? '—',
          },
          {
            key: 'actions',
            header: 'Aktion',
            align: 'right',
            cell: (row: Absence) => (
              <IconButton
                icon={Trash2}
                label="Abwesenheit löschen"
                tone="danger"
                onClick={() => void onDelete(row.id!)}
              />
            ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id!}
        mobileCard={(row) => (
          <Card>
            <CardBody className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">
                  {formatDate(row.start_date!)} – {formatDate(row.end_date!)}
                </p>
                {row.comment_private && (
                  <p className="mt-0.5 text-sm text-gray-500">{row.comment_private}</p>
                )}
              </div>
              <IconButton
                icon={Trash2}
                label="Abwesenheit löschen"
                tone="danger"
                onClick={() => void onDelete(row.id!)}
              />
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={CalendarOff}
            title="Keine Abwesenheiten eingetragen"
            description="Solange hier nichts steht, giltst du grundsätzlich als verfügbar."
          />
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Abwesenheit anlegen"
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button
              variant="primary"
              loading={form.formState.isSubmitting}
              onClick={form.handleSubmit(async (values) => {
                try {
                  await createAbsence.mutateAsync({
                    profileId,
                    startDate: values.startDate,
                    endDate: values.endDate,
                    comment: values.comment,
                  });
                  form.reset();
                  setDialogOpen(false);
                  toast('Abwesenheit gespeichert', 'success');
                } catch (error) {
                  toast(
                    error instanceof Error ? error.message : 'Speichern fehlgeschlagen',
                    'error',
                  );
                }
              })}
            >
              Speichern
            </Button>
          </>
        }
      >
        <form noValidate className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Von" required error={form.formState.errors.startDate?.message}>
              {(p) => <DateInput {...p} {...form.register('startDate')} />}
            </FormField>
            <FormField label="Bis" required error={form.formState.errors.endDate?.message}>
              {(p) => <DateInput {...p} {...form.register('endDate')} />}
            </FormField>
          </div>
          <FormField
            label="Kommentar"
            hint="Nur für dich sichtbar."
            error={form.formState.errors.comment?.message}
          >
            {(p) => <Textarea {...p} {...form.register('comment')} rows={2} />}
          </FormField>
        </form>
      </Dialog>
    </div>
  );
}
