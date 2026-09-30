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
import {
  useCreateCancellation,
  useUpdateCancellation,
  type TrainingCancellation,
} from '../trainings/api';
import type { Venue } from './api';
import { useDefaultVenueId } from './defaultVenue';
import { EMPTY_HALL_CLOSURE, hallClosureSchema, type HallClosureValues } from './schemas';

export interface HallClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
  /** Die Sperrung, die bearbeitet wird; sonst wird eine neue angelegt. */
  closure?: TrainingCancellation | null;
}

/**
 * Hallensperrung anlegen oder ändern: ein Ort, ein Tag oder Zeitraum. Alle Trainings dort
 * fallen aus; Heimspiele in der Zeit zeigt die Seite als betroffen an.
 */
export default function HallClosureDialog({
  open,
  onOpenChange,
  venues,
  closure = null,
}: HallClosureDialogProps) {
  const { toast } = useToast();
  const { profile } = useSession();
  const create = useCreateCancellation();
  const update = useUpdateCancellation();
  const defaultVenueId = useDefaultVenueId();

  const form = useForm<HallClosureValues>({
    resolver: zodResolver(hallClosureSchema),
    defaultValues: EMPTY_HALL_CLOSURE,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      closure
        ? {
            venueId: closure.venue_id ?? '',
            fromDate: closure.from_date,
            toDate: closure.to_date === closure.from_date ? '' : closure.to_date,
            reason: closure.reason ?? '',
            notifyEmail: closure.notify_email,
          }
        : { ...EMPTY_HALL_CLOSURE, venueId: defaultVenueId ?? venues[0]?.id ?? '' },
    );
  }, [open, closure, defaultVenueId, venues, form]);

  async function onSubmit(values: HallClosureValues) {
    const row = {
      venue_id: values.venueId,
      from_date: values.fromDate,
      // Ein einzelner Tag ist der Normalfall; dann steht „bis“ leer.
      to_date: values.toDate || values.fromDate,
      reason: values.reason,
      notify_email: values.notifyEmail,
    };
    try {
      if (closure) {
        await update.mutateAsync({ id: closure.id, ...row });
        toast('Die Hallensperrung ist geändert', 'success');
      } else {
        await create.mutateAsync({ ...row, training_id: null, created_by: profile?.id ?? null });
        toast('Die Hallensperrung ist eingetragen', 'success');
      }
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={closure ? 'Hallensperrung ändern' : 'Hallensperrung anlegen'}
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
        <FormField
          label="Halle"
          required
          hint="Alle Trainings dort fallen aus. Heimspiele in der Zeit müssen verlegt werden."
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

        <FormField label="Grund" hint="Steht so an den abgesagten Terminen.">
          {(p) => (
            <Textarea {...p} {...form.register('reason')} rows={2} placeholder="Halle gesperrt" />
          )}
        </FormField>

        {!closure && (
          <Checkbox
            checked={form.watch('notifyEmail')}
            onCheckedChange={(value) => form.setValue('notifyEmail', value)}
            label="Mitglieder per E-Mail direkt benachrichtigen"
            hint="Ohne Haken erfahren sie es beim nächsten Blick in die Terminliste."
          />
        )}
      </form>
    </Dialog>
  );
}
