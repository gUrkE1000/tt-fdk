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
  MultiSelect,
  PersonPicker,
  Select,
  Tabs,
  Textarea,
  TimeInput,
  useToast,
} from '../../components/ui';
import type { Member, GroupWithMembers } from '../members/api';
import type { Venue } from '../venues/api';
import {
  useCreateTraining,
  useSaveTrainingPeople,
  useUpdateTraining,
  type TrainingWithPeople,
} from './api';
import {
  EMPTY_TRAINING,
  RHYTHM_LABELS,
  STATISTICS_VISIBILITY_LABELS,
  TRAINING_TYPE_LABELS,
  WEEKDAYS,
  toTimeInput,
  trainingSchema,
  type TrainingValues,
} from './schemas';

const TYPE_OPTIONS = Object.entries(TRAINING_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const RHYTHM_OPTIONS = Object.entries(RHYTHM_LABELS).map(([value, label]) => ({ value, label }));

const VISIBILITY_OPTIONS = Object.entries(STATISTICS_VISIBILITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const WEEKDAY_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label }));

export interface TrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neues Training anlegen. */
  training: TrainingWithPeople | null;
  members: Member[];
  venues: Venue[];
  groups: GroupWithMembers[];
}

export default function TrainingDialog({
  open,
  onOpenChange,
  training,
  members,
  venues,
  groups,
}: TrainingDialogProps) {
  const { toast } = useToast();
  const createTraining = useCreateTraining();
  const updateTraining = useUpdateTraining();
  const savePeople = useSaveTrainingPeople();

  const form = useForm<TrainingValues>({
    resolver: zodResolver(trainingSchema),
    defaultValues: EMPTY_TRAINING,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      training
        ? toFormValues(training)
        : { ...EMPTY_TRAINING, startDate: new Date().toISOString().slice(0, 10) },
    );
  }, [open, training, form]);

  async function onSubmit(values: TrainingValues) {
    const row = {
      name: values.name,
      type: values.type,
      weekday: values.weekday,
      time_start: values.timeStart,
      time_end: values.timeEnd || null,
      venue_id: values.venueId || null,
      rhythm: values.rhythm,
      start_date: values.startDate,
      reminder_hours: values.reminderHours,
      details: values.details,
      max_participants: values.maxParticipants,
      is_open: values.isOpen,
      trainer_invites_only: values.trainerInvitesOnly,
      is_incognito: values.isIncognito,
      requires_key_owner: values.requiresKeyOwner,
      skip_public_holidays: values.skipPublicHolidays,
      skip_school_holidays: values.skipSchoolHolidays,
      hide_in_calendar: values.hideInCalendar,
      auto_cancel_no_trainers: values.autoCancelNoTrainers,
      statistics_visibility: values.statisticsVisibility,
      active: values.active,
    };

    try {
      const id = training
        ? (await updateTraining.mutateAsync({ id: training.id, values: row }), training.id)
        : await createTraining.mutateAsync(row);

      await savePeople.mutateAsync({
        trainingId: id,
        trainerIds: values.trainerIds,
        memberIds: values.memberIds,
        // Gruppen sind nur bei „Nur für ausgewählte Gruppen“ gemeint; sonst wären sie
        // eine stille Einstellung, die niemand mehr sieht.
        statisticsGroupIds:
          values.statisticsVisibility === 'groups' ? values.statisticsGroupIds : [],
      });

      toast(training ? 'Training gespeichert' : 'Training angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  const people = members.map((member) => ({
    id: member.id,
    name: member.full_name ?? '',
    detail: member.qttr != null ? `${member.qttr} QTTR` : undefined,
  }));

  const basics = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Name des Trainings" required error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} {...form.register('name')} placeholder="Erwachsenentraining" />}
        </FormField>
        <FormField label="Trainingstyp" required>
          {(p) => <Select {...p} {...form.register('type')} options={TYPE_OPTIONS} />}
        </FormField>
        <FormField label="Wochentag" required>
          {(p) => (
            <Select
              {...p}
              {...form.register('weekday', { valueAsNumber: true })}
              options={WEEKDAY_OPTIONS}
            />
          )}
        </FormField>
        <FormField label="Trainingsort" hint="Leer lassen, wenn der Ort wechselt.">
          {(p) => (
            <Select
              {...p}
              {...form.register('venueId')}
              options={[
                { value: '', label: 'nicht festgelegt' },
                ...venues
                  .filter((venue) => venue.active)
                  .map((venue) => ({ value: venue.id, label: venue.name })),
              ]}
            />
          )}
        </FormField>
        <FormField
          label="Uhrzeit Beginn"
          required
          error={form.formState.errors.timeStart?.message}
        >
          {(p) => <TimeInput {...p} {...form.register('timeStart')} />}
        </FormField>
        <FormField label="Uhrzeit Ende" error={form.formState.errors.timeEnd?.message}>
          {(p) => <TimeInput {...p} {...form.register('timeEnd')} />}
        </FormField>
        <FormField label="Rhythmus">
          {(p) => <Select {...p} {...form.register('rhythm')} options={RHYTHM_OPTIONS} />}
        </FormField>
        <FormField
          label="Startdatum"
          required
          hint="Ab hier zählt der Rhythmus: „zweiwöchentlich“ braucht einen Anfang."
          error={form.formState.errors.startDate?.message}
        >
          {(p) => <DateInput {...p} {...form.register('startDate')} />}
        </FormField>
      </div>

      <FormField label="Details / Hinweis an die Teilnehmer">
        {(p) => <Textarea {...p} {...form.register('details')} rows={3} />}
      </FormField>

      <Checkbox
        checked={form.watch('active')}
        onCheckedChange={(value) => form.setValue('active', value)}
        label="Aktiv"
        hint="Ein stillgelegtes Training bekommt keine neuen Termine mehr; die bisherigen bleiben sichtbar."
      />
    </div>
  );

  const participants = (
    <div className="space-y-4">
      <FormField label="Trainer">
        {(p) => (
          <PersonPicker
            {...p}
            people={people}
            value={form.watch('trainerIds')}
            onChange={(value) => form.setValue('trainerIds', value)}
            placeholder="Niemand zugeordnet"
          />
        )}
      </FormField>

      <FormField
        label="Mitglieder zuordnen"
        hint="Nur zugeordnete Mitglieder werden gefragt — außer bei einem offenen Training."
      >
        {(p) => (
          <PersonPicker
            {...p}
            people={people}
            value={form.watch('memberIds')}
            onChange={(value) => form.setValue('memberIds', value)}
            placeholder="Niemand zugeordnet"
          />
        )}
      </FormField>

      <FormField
        label="Maximale Teilnehmeranzahl"
        hint="Leer = unbegrenzt. Gäste zählen mit."
        error={form.formState.errors.maxParticipants?.message}
      >
        {(p) => (
          <Input
            {...p}
            {...form.register('maxParticipants', { setValueAs: toNullableNumber })}
            type="number"
            min={1}
            max={999}
          />
        )}
      </FormField>

      <div className="space-y-2 rounded-xl bg-gray-50 p-3">
        <Checkbox
          checked={form.watch('isOpen')}
          onCheckedChange={(value) => form.setValue('isOpen', value)}
          label="Offenes Training (jedes Mitglied kann teilnehmen)"
          hint="Offene Trainings sehen auch Gäste."
        />
        <Checkbox
          checked={form.watch('trainerInvitesOnly')}
          onCheckedChange={(value) => form.setValue('trainerInvitesOnly', value)}
          label="Kein offenes Training — der Trainer lädt die Teilnehmer manuell ein"
        />
        <Checkbox
          checked={form.watch('isIncognito')}
          onCheckedChange={(value) => form.setValue('isIncognito', value)}
          label="Inkognito-Training (Teilnehmerzahl und Liste sind nur für Trainer sichtbar)"
        />
        <Checkbox
          checked={form.watch('requiresKeyOwner')}
          onCheckedChange={(value) => form.setValue('requiresKeyOwner', value)}
          label="Teilnehmer mit Hallenschlüssel immer notwendig"
        />
      </div>
    </div>
  );

  const settings = (
    <div className="space-y-4">
      <FormField
        label="Wie viele Stunden vor Beginn soll erinnert werden?"
        hint="Gilt für alle zugeordneten Mitglieder. 0 schaltet die Erinnerung ab."
        error={form.formState.errors.reminderHours?.message}
      >
        {(p) => (
          <Input
            {...p}
            {...form.register('reminderHours', { valueAsNumber: true })}
            type="number"
            min={0}
            max={336}
          />
        )}
      </FormField>

      <div className="space-y-2 rounded-xl bg-gray-50 p-3">
        <Checkbox
          checked={form.watch('skipPublicHolidays')}
          onCheckedChange={(value) => form.setValue('skipPublicHolidays', value)}
          label="Kein Training an gesetzlichen Feiertagen"
          hint="Nach dem Bundesland aus den Vereinsdaten."
        />
        <Checkbox
          checked={form.watch('skipSchoolHolidays')}
          onCheckedChange={(value) => form.setValue('skipSchoolHolidays', value)}
          label="Kein Training während der Schulferien"
        />
        <Checkbox
          checked={form.watch('hideInCalendar')}
          onCheckedChange={(value) => form.setValue('hideInCalendar', value)}
          label="Training im Kalender nicht anzeigen"
        />
        <Checkbox
          checked={form.watch('autoCancelNoTrainers')}
          onCheckedChange={(value) => form.setValue('autoCancelNoTrainers', value)}
          label="Training automatisch absagen, wenn alle Trainer abgesagt haben"
        />
      </div>

      {/* Im TT-Planer erscheint dieses Feld erst beim Bearbeiten — beim Anlegen gibt es
          noch keine Teilnahmen, über die eine Statistik etwas sagen könnte. */}
      {training && (
        <>
          <FormField label="Trainingsteilnahmen im Statistikbereich anzeigen">
            {(p) => (
              <Select
                {...p}
                {...form.register('statisticsVisibility')}
                options={VISIBILITY_OPTIONS}
              />
            )}
          </FormField>

          {form.watch('statisticsVisibility') === 'groups' && (
            <FormField
              label="Gruppen"
              error={form.formState.errors.statisticsGroupIds?.message}
            >
              {(p) => (
                <MultiSelect
                  {...p}
                  options={groups.map((group) => ({ value: group.id, label: group.name }))}
                  value={form.watch('statisticsGroupIds')}
                  onChange={(value) => form.setValue('statisticsGroupIds', value)}
                  placeholder="Gruppen auswählen"
                />
              )}
            </FormField>
          )}
        </>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={training ? `${training.name} bearbeiten` : 'Training anlegen'}
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
      <form noValidate>
        <Tabs
          tabs={[
            { value: 'basics', label: 'Stammdaten', content: basics },
            { value: 'participants', label: 'Teilnehmer', content: participants },
            { value: 'settings', label: 'Einstellungen', content: settings },
          ]}
        />
      </form>
    </Dialog>
  );
}

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toFormValues(training: TrainingWithPeople): TrainingValues {
  return {
    name: training.name,
    type: training.type,
    weekday: training.weekday,
    timeStart: toTimeInput(training.time_start),
    timeEnd: toTimeInput(training.time_end),
    venueId: training.venue_id ?? '',
    rhythm: training.rhythm,
    startDate: training.start_date,
    reminderHours: training.reminder_hours,
    details: training.details,
    maxParticipants: training.max_participants,
    isOpen: training.is_open,
    trainerInvitesOnly: training.trainer_invites_only,
    isIncognito: training.is_incognito,
    requiresKeyOwner: training.requires_key_owner,
    skipPublicHolidays: training.skip_public_holidays,
    skipSchoolHolidays: training.skip_school_holidays,
    hideInCalendar: training.hide_in_calendar,
    autoCancelNoTrainers: training.auto_cancel_no_trainers,
    statisticsVisibility: training.statistics_visibility,
    statisticsGroupIds: training.statisticsGroupIds,
    active: training.active,
    trainerIds: training.trainerIds,
    memberIds: training.memberIds,
  };
}
