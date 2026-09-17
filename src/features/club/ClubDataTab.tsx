import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';
import { BUNDESLAND_OPTIONS } from '../../lib/bundeslaender';
import { useVenues } from '../venues/api';
import { generateRegistrationCode, useClubSettings, useUpdateClubSettings } from './api';
import { clubDataSchema, toClubFormValues, type ClubDataValues } from './schemas';

export default function ClubDataTab() {
  const { toast } = useToast();
  const settings = useClubSettings();
  const updateSettings = useUpdateClubSettings();
  const venues = useVenues();

  const form = useForm<ClubDataValues>({
    resolver: zodResolver(clubDataSchema),
    defaultValues: toClubFormValues({}),
  });

  // Erst wenn die Einstellungen da sind, kann das Formular gefüllt werden.
  useEffect(() => {
    if (settings.data) form.reset(toClubFormValues(settings.data));
  }, [settings.data, form]);

  async function onSubmit(values: ClubDataValues) {
    try {
      await updateSettings.mutateAsync(values as unknown as Record<string, string>);
      toast('Vereinsdaten gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  const venueOptions = [
    { value: '', label: 'Kein Standardort' },
    ...(venues.data ?? [])
      .filter((venue) => venue.active)
      .map((venue) => ({ value: venue.id, label: venue.name })),
  ];

  return (
    <form noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Verein</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Name" required error={form.formState.errors.club_name?.message}>
              {(p) => <Input {...p} {...form.register('club_name')} />}
            </FormField>
            <FormField label="Kurzname" hint="Erscheint in engen Ansichten und im Kalender.">
              {(p) => <Input {...p} {...form.register('club_short_name')} />}
            </FormField>
          </div>

          <FormField
            label="Weitere Schreibweisen"
            hint="Kommagetrennt. Damit erkennt der Spielimport, welche Spiele eure Heimspiele sind."
          >
            {(p) => (
              <Input {...p} {...form.register('club_aliases')} placeholder="TTC Musterstadt, TTC Muster" />
            )}
          </FormField>

          <FormField
            label="Bundesland"
            hint="Steuert Feiertage und Schulferien in der Trainingsplanung."
            error={form.formState.errors.bundesland?.message}
          >
            {(p) => <Select {...p} {...form.register('bundesland')} options={BUNDESLAND_OPTIONS} />}
          </FormField>

          <FormField
            label="Standardort"
            hint="Vorbelegung für neue Termine und Trainings."
          >
            {(p) => <Select {...p} {...form.register('default_venue_id')} options={venueOptions} />}
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Im Netz</h3>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Webseite" error={form.formState.errors.website_url?.message}>
              {(p) => <Input {...p} {...form.register('website_url')} placeholder="https://" />}
            </FormField>
            <FormField label="Facebook" error={form.formState.errors.facebook_url?.message}>
              {(p) => <Input {...p} {...form.register('facebook_url')} placeholder="https://" />}
            </FormField>
            <FormField label="Instagram" error={form.formState.errors.instagram_url?.message}>
              {(p) => <Input {...p} {...form.register('instagram_url')} placeholder="https://" />}
            </FormField>
            <FormField label="YouTube" error={form.formState.errors.youtube_url?.message}>
              {(p) => <Input {...p} {...form.register('youtube_url')} placeholder="https://" />}
            </FormField>
            <FormField label="WhatsApp-Kanal" error={form.formState.errors.whatsapp_url?.message}>
              {(p) => <Input {...p} {...form.register('whatsapp_url')} placeholder="https://" />}
            </FormField>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Texte</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <FormField
            label="Informationen über den Verein"
            hint="Erscheint unter „Mein Verein“."
          >
            {(p) => <Textarea {...p} {...form.register('about_html')} rows={5} />}
          </FormField>
          <FormField
            label="Willkommens-E-Mail"
            hint="Geht an frisch freigeschaltete Mitglieder. Leer lassen für den Standardtext."
          >
            {(p) => <Textarea {...p} {...form.register('welcome_email_html')} rows={5} />}
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h3 className="font-bold text-gray-900">Registrierungscode</h3>
            <p className="text-sm text-gray-500">
              Wer sich damit registriert, wartet auf deine Freischaltung. Leer heißt: keine
              Selbstregistrierung.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <FormField label="Code">
            {(p) => <Input {...p} {...form.register('registration_code')} />}
          </FormField>
          <Button
            onClick={() => form.setValue('registration_code', generateRegistrationCode())}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Neuen Code vorschlagen
          </Button>
          <p className="text-xs text-gray-500">
            Der neue Code gilt erst nach dem Speichern — der alte ist dann ungültig.
          </p>
        </CardBody>
      </Card>

      <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
        Speichern
      </Button>
    </form>
  );
}
