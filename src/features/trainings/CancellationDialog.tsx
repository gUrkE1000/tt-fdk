import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  DateInput,
  Dialog,
  FormField,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';
import { useSession } from '../auth/session';
import type { Venue } from '../venues/api';
import { useCreateCancellation, type TrainingWithPeople } from './api';
import {
  EMPTY_CANCELLATION,
  cancellationSchema,
  type CancellationValues,
} from './schemas';

export interface CancellationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainings: TrainingWithPeople[];
  venues: Venue[];
  /** Vorauswahl aus der Ausfallseite eines Trainings heraus. */
  trainingId?: string | null;
  /** Ein Trainer darf nur sein eigenes Training absagen, nie eine ganze Halle. */
  allowVenue?: boolean;
}

export default function CancellationDialog({
  open,
  onOpenChange,
  trainings,
  venues,
  trainingId,
  allowVenue = true,
}: CancellationDialogProps) {
  const { toast } = useToast();
  const { profile } = useSession();
  const create = useCreateCancellation();

  const form = useForm<CancellationValues>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: EMPTY_CANCELLATION,
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      ...EMPTY_CANCELLATION,
      trainingId: trainingId ?? trainings[0]?.id ?? '',
      venueId: venues[0]?.id ?? '',
    });
  }, [open, trainingId, trainings, venues, form]);

  const target = form.watch('target');

  async function onSubmit(values: CancellationValues) {
    try {
      await create.mutateAsync({
        training_id: values.target === 'training' ? values.trainingId : null,
        venue_id: values.target === 'venue' ? values.venueId : null,
        from_date: values.fromDate,
        // Ein einzelner Tag ist der Normalfall; dann steht „bis“ leer.
        to_date: values.toDate || values.fromDate,
        reason: values.reason,
        notify_email: values.notifyEmail,
        created_by: profile?.id ?? null,
      });
      toast('Der Ausfall ist eingetragen', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ausfall anlegen"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
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
      <form noValidate className="space-y-4">
        {allowVenue && (
          <FormField label="Was fällt aus?">
            {(p) => (
              <Select
                {...p}
                {...form.register('target')}
                options={[
                  { value: 'training', label: 'Ein einzelnes Training' },
                  { value: 'venue', label: 'Eine ganze Halle' },
                ]}
              />
            )}
          </FormField>
        )}

        {target === 'training' ? (
          <FormField label="Training" required error={form.formState.errors.trainingId?.message}>
            {(p) => (
              <Select
                {...p}
                {...form.register('trainingId')}
                options={[
                  { value: '', label: 'Bitte auswählen' },
                  ...trainings.map((entry) => ({ value: entry.id, label: entry.name })),
                ]}
              />
            )}
          </FormField>
        ) : (
          <FormField
            label="Ort"
            required
            hint="Der Ausfall gilt für alle Trainings, die diesem Ort zugeordnet sind."
            error={form.formState.errors.venueId?.message}
          >
            {(p) => (
              <Select
                {...p}
                {...form.register('venueId')}
                options={[
                  { value: '', label: 'Bitte auswählen' },
                  ...venues.map((venue) => ({ value: venue.id, label: venue.name })),
                ]}
              />
            )}
          </FormField>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Von" required error={form.formState.errors.fromDate?.message}>
            {(p) => <DateInput {...p} {...form.register('fromDate')} />}
          </FormField>
          <FormField
            label="Bis"
            hint="Leer lassen für einen einzelnen Tag."
            error={form.formState.errors.toDate?.message}
          >
            {(p) => <DateInput {...p} {...form.register('toDate')} />}
          </FormField>
        </div>

        <FormField label="Grund" hint="Steht so am abgesagten Termin.">
          {(p) => (
            <Textarea {...p} {...form.register('reason')} rows={2} placeholder="Halle gesperrt" />
          )}
        </FormField>

        <Checkbox
          checked={form.watch('notifyEmail')}
          onCheckedChange={(value) => form.setValue('notifyEmail', value)}
          label="Mitglieder über den Ausfall per E-Mail direkt benachrichtigen"
          hint="Ohne Haken erfahren sie es beim nächsten Blick in die Terminliste."
        />
      </form>
    </Dialog>
  );
}
