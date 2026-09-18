import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, Dialog, FormField, Input, Select, useToast } from '../../components/ui';
import { useMembers } from '../members/api';
import { useVenues } from '../venues/api';
import { useCreateKey, useUpdateKey, type KeyRow } from './api';
import { EMPTY_KEY, keySchema, toKeyRow, type KeyValues } from './schemas';

export interface KeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neuen Schlüssel anlegen. */
  entry: KeyRow | null;
}

/** Anlegen und Bearbeiten eines Schlüssels (Bestandsaufnahme F). */
export default function KeyDialog({ open, onOpenChange, entry }: KeyDialogProps) {
  const { toast } = useToast();
  const venues = useVenues();
  const members = useMembers();
  const createKey = useCreateKey();
  const updateKey = useUpdateKey();

  const form = useForm<KeyValues>({
    resolver: zodResolver(keySchema),
    defaultValues: EMPTY_KEY,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      entry
        ? {
            name: entry.name ?? '',
            venue_id: entry.venue_id ?? '',
            responsible_id: entry.responsible_id ?? '',
            no_forwarding: entry.no_forwarding ?? false,
            active: entry.active ?? true,
          }
        : EMPTY_KEY,
    );
  }, [open, entry, form]);

  const venueOptions = useMemo(
    () => [
      { value: '', label: 'nicht definiert' },
      ...(venues.data ?? [])
        .filter((venue) => venue.active)
        .map((venue) => ({ value: venue.id, label: venue.name })),
    ],
    [venues.data],
  );

  const memberOptions = useMemo(
    () => [
      { value: '', label: 'Bitte wählen' },
      ...(members.data ?? [])
        .filter((member) => member.status === 'active')
        .map((member) => ({ value: member.id, label: member.full_name ?? '' })),
    ],
    [members.data],
  );

  async function onSubmit(values: KeyValues) {
    try {
      if (entry?.id) await updateKey.mutateAsync({ id: entry.id, values: toKeyRow(values) });
      else await createKey.mutateAsync(toKeyRow(values));
      toast(entry ? 'Schlüssel gespeichert' : 'Schlüssel angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? `${entry.name} bearbeiten` : 'Schlüssel anlegen'}
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
          {(p) => (
            <Input {...p} {...form.register('name')} placeholder="Hallenschlüssel Sporthalle" />
          )}
        </FormField>

        <FormField label="Ort" hint="Steuert, bei welchen Trainings dieser Schlüssel zählt.">
          {(p) => <Select {...p} options={venueOptions} {...form.register('venue_id')} />}
        </FormField>

        <FormField
          label="Verantwortlicher"
          required
          hint="Bekommt den Schlüssel immer zurück und darf ihn jederzeit neu vergeben."
          error={form.formState.errors.responsible_id?.message}
        >
          {(p) => <Select {...p} options={memberOptions} {...form.register('responsible_id')} />}
        </FormField>

        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <Checkbox
            checked={form.watch('no_forwarding')}
            onCheckedChange={(value) => form.setValue('no_forwarding', value)}
            label="Keine Weitergabe des Schlüssels ermöglichen"
            hint="Dann gibt nur der Verantwortliche ihn aus — wer ihn hat, kann ihn nicht weiterreichen."
          />
          <Checkbox
            checked={form.watch('active')}
            onCheckedChange={(value) => form.setValue('active', value)}
            label="Schlüssel im Umlauf"
            hint="Abwählen statt löschen, wenn ein Schlüssel eingezogen wurde — das Protokoll bleibt lesbar."
          />
        </div>
      </form>
    </Dialog>
  );
}
