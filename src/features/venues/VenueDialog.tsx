import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, Dialog, FormField, Input, useToast } from '../../components/ui';
import { useCreateVenue, useUpdateVenue, type Venue } from './api';
import { EMPTY_VENUE, venueSchema, type VenueValues } from './schemas';

/**
 * Leeres Feld heißt „unbegrenzt", nicht „null Spiele". react-hook-form reicht bei einem
 * leeren Zahlenfeld je nach Zustand '' oder undefined durch — beides muss hier zu null
 * werden, sonst landet NaN im Schema und die Prüfung meldet einen Fehler, den niemand
 * versteht.
 */
function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface VenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neuen Ort anlegen. */
  venue: Venue | null;
}

export default function VenueDialog({ open, onOpenChange, venue }: VenueDialogProps) {
  const { toast } = useToast();
  const createVenue = useCreateVenue();
  const updateVenue = useUpdateVenue();

  const form = useForm<VenueValues>({
    resolver: zodResolver(venueSchema),
    defaultValues: EMPTY_VENUE,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      venue
        ? {
            name: venue.name,
            address: venue.address ?? '',
            postalCode: venue.postal_code ?? '',
            city: venue.city ?? '',
            maxGames: venue.max_games,
            allowTrainingAtMaxGames: venue.allow_training_at_max_games,
            trainingOnly: venue.training_only,
            active: venue.active,
          }
        : EMPTY_VENUE,
    );
  }, [open, venue, form]);

  async function onSubmit(values: VenueValues) {
    const row = {
      name: values.name,
      address: values.address,
      postal_code: values.postalCode || null,
      city: values.city,
      max_games: values.maxGames,
      allow_training_at_max_games: values.allowTrainingAtMaxGames,
      training_only: values.trainingOnly,
      active: values.active,
    };

    try {
      if (venue) await updateVenue.mutateAsync({ id: venue.id, values: row });
      else await createVenue.mutateAsync(row);
      toast(venue ? 'Ort gespeichert' : 'Ort angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={venue ? `${venue.name} bearbeiten` : 'Ort anlegen'}
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
          {(p) => <Input {...p} {...form.register('name')} placeholder="Sporthalle Musterstadt" />}
        </FormField>

        <FormField label="Straße und Hausnummer">
          {(p) => <Input {...p} {...form.register('address')} />}
        </FormField>

        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <FormField label="PLZ">{(p) => <Input {...p} {...form.register('postalCode')} />}</FormField>
          <FormField label="Ort">{(p) => <Input {...p} {...form.register('city')} />}</FormField>
        </div>

        <FormField
          label="Gleichzeitige Spieltermine"
          hint="Wie viele Heimspiele können hier zur selben Zeit stattfinden? Leer = unbegrenzt."
          error={form.formState.errors.maxGames?.message}
        >
          {(p) => (
            <Input
              {...p}
              {...form.register('maxGames', { setValueAs: toNullableNumber })}
              type="number"
              min={1}
              max={99}
            />
          )}
        </FormField>

        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <Checkbox
            checked={form.watch('allowTrainingAtMaxGames')}
            onCheckedChange={(value) => form.setValue('allowTrainingAtMaxGames', value)}
            label="Training auch bei voller Belegung zulassen"
            hint="Sonst warnt die Terminplanung, wenn Training und Heimspiele zusammenfallen."
          />
          <Checkbox
            checked={form.watch('trainingOnly')}
            onCheckedChange={(value) => form.setValue('trainingOnly', value)}
            label="Nur für Training"
            hint="Der Ort steht dann bei Spielterminen nicht zur Auswahl."
          />
          <Checkbox
            checked={form.watch('active')}
            onCheckedChange={(value) => form.setValue('active', value)}
            label="Aktiv"
            hint="Stillgelegte Orte bleiben an vergangenen Terminen erhalten, stehen aber nicht mehr zur Auswahl."
          />
        </div>
      </form>
    </Dialog>
  );
}
