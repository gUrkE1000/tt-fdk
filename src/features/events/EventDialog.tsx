import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  DateInput,
  Dialog,
  FormField,
  Input,
  RichTextEditor,
  TimeInput,
  useToast,
} from '../../components/ui';
import { fromBerlin, toBerlin } from '../../lib/dates';
import { useSession } from '../auth/session';
import { useCreateEvent, useUpdateEvent, type ClubEvent } from './api';
import { EMPTY_EVENT, eventSchema, type EventValues } from './schemas';

export interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neuen Termin anlegen. */
  event: ClubEvent | null;
}

export default function EventDialog({ open, onOpenChange, event }: EventDialogProps) {
  const { toast } = useToast();
  const { profile } = useSession();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const form = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: EMPTY_EVENT,
  });

  useEffect(() => {
    if (open) form.reset(event ? toFormValues(event) : EMPTY_EVENT);
  }, [open, event, form]);

  const fullDay = form.watch('fullDay');

  async function onSubmit(values: EventValues) {
    const row = {
      name: values.name,
      full_day: values.fullDay,
      starts_at: combine(values.startDate, values.fullDay ? '00:00' : values.startTime),
      ends_at: values.endDate
        ? combine(values.endDate, values.fullDay ? '23:59' : values.endTime || '23:59')
        : null,
      participate_until: values.participateUntil || null,
      max_participants: values.maxParticipants,
      address: values.address,
      description_html: values.descriptionHtml,
      hide_in_my_club: values.hideInMyClub,
      exclude_calendar: values.excludeCalendar,
    };

    try {
      if (event) {
        await updateEvent.mutateAsync({ id: event.id, values: row });
      } else {
        await createEvent.mutateAsync({ ...row, created_by: profile?.id ?? null });
      }
      toast(event ? 'Termin gespeichert' : 'Termin angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={event ? `${event.name} bearbeiten` : 'Vereinstermin anlegen'}
      description="Plane hier zum Beispiel Clubmeisterschaften, Sommerfeste oder andere Vereinstermine."
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
        <FormField label="Name" required error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} {...form.register('name')} placeholder="Clubmeisterschaft" />}
        </FormField>

        <Checkbox
          checked={fullDay}
          onCheckedChange={(value) => form.setValue('fullDay', value)}
          label="Ganztägig"
          hint="Ohne Uhrzeit — der Termin füllt den ganzen Tag."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Von" required error={form.formState.errors.startDate?.message}>
            {(p) => <DateInput {...p} {...form.register('startDate')} />}
          </FormField>
          {!fullDay && (
            <FormField label="Uhrzeit" required error={form.formState.errors.startTime?.message}>
              {(p) => <TimeInput {...p} {...form.register('startTime')} />}
            </FormField>
          )}
          <FormField
            label="Bis"
            hint="Leer lassen für einen Termin an einem Tag."
            error={form.formState.errors.endDate?.message}
          >
            {(p) => <DateInput {...p} {...form.register('endDate')} />}
          </FormField>
          {!fullDay && (
            <FormField label="Uhrzeit Ende">
              {(p) => <TimeInput {...p} {...form.register('endTime')} />}
            </FormField>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Teilnahme hinterlegen bis"
            hint="Anmeldefrist. Leer heißt: bis zum Beginn."
            error={form.formState.errors.participateUntil?.message}
          >
            {(p) => <DateInput {...p} {...form.register('participateUntil')} />}
          </FormField>
          <FormField
            label="Maximale Teilnehmerzahl"
            hint="Leer = unbegrenzt. Gäste zählen mit."
            error={form.formState.errors.maxParticipants?.message}
          >
            {(p) => (
              <Input
                {...p}
                {...form.register('maxParticipants', { setValueAs: toNullableNumber })}
                type="number"
                min={1}
                max={9999}
              />
            )}
          </FormField>
        </div>

        <FormField label="Veranstaltungsort (Adresse)">
          {(p) => <Input {...p} {...form.register('address')} placeholder="Turnstraße 5, Musterstadt" />}
        </FormField>

        <FormField
          label="Details"
          hint="Fett, kursiv, Listen und Links. Bilder und Tabellen gibt es bewusst nicht."
        >
          {(p) => (
            <RichTextEditor
              {...p}
              value={form.watch('descriptionHtml')}
              onChange={(value) => form.setValue('descriptionHtml', value)}
              placeholder="Was ist geplant?"
            />
          )}
        </FormField>

        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <Checkbox
            checked={form.watch('hideInMyClub')}
            onCheckedChange={(value) => form.setValue('hideInMyClub', value)}
            label="Termin unter „Mein Verein“ nicht anzeigen"
          />
          <Checkbox
            checked={form.watch('excludeCalendar')}
            onCheckedChange={(value) => form.setValue('excludeCalendar', value)}
            label="Termin nicht in den Kalender exportieren"
          />
        </div>
      </form>
    </Dialog>
  );
}

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Ortszeit in einen Zeitpunkt — ein Termin um 19 Uhr ist 19 Uhr vor Ort. */
function combine(date: string, time: string): string {
  return fromBerlin(`${date}T${time || '00:00'}:00`).toISOString();
}

export function toFormValues(event: ClubEvent): EventValues {
  const start = toBerlin(event.starts_at);
  const end = event.ends_at ? toBerlin(event.ends_at) : null;

  return {
    name: event.name,
    fullDay: event.full_day,
    startDate: isoDate(start),
    startTime: isoTime(start),
    endDate: end ? isoDate(end) : '',
    endTime: end ? isoTime(end) : '',
    participateUntil: event.participate_until ?? '',
    maxParticipants: event.max_participants,
    address: event.address,
    descriptionHtml: event.description_html,
    hideInMyClub: event.hide_in_my_club,
    excludeCalendar: event.exclude_calendar,
  };
}

function isoDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function isoTime(value: Date): string {
  return [
    String(value.getHours()).padStart(2, '0'),
    String(value.getMinutes()).padStart(2, '0'),
  ].join(':');
}
