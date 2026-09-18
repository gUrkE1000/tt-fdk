import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  FormField,
  Input,
  Textarea,
  TimeInput,
  useToast,
} from '../../components/ui';
import { useClubSettings, useUpdateClubSettings } from '../club/api';
import { SUGGESTED_QUICKLINKS } from '../dashboard/summary';
import {
  operationsSchema,
  previewQuicklinks,
  toOperationsValues,
  type OperationsValues,
} from './schemas';

const QUICKLINKS_PLACEHOLDER = JSON.stringify(
  SUGGESTED_QUICKLINKS.map((label) => ({ label, url: 'https://www.mytischtennis.de/…' })),
  null,
  2,
);

/**
 * Was die Anwendung tut, nicht wer der Verein ist (Aufgabe 8.4).
 *
 * Bis hierher standen diese Werte nur in der Tabelle `club_settings` und waren
 * ausschließlich über psql zu ändern. Das ist für einen Verein ohne Datenbankkenntnisse
 * keine Einstellung, sondern eine Konstante.
 */
export default function SettingsPanel() {
  const { toast } = useToast();
  const settings = useClubSettings();
  const updateSettings = useUpdateClubSettings();

  const form = useForm<OperationsValues>({
    resolver: zodResolver(operationsSchema),
    defaultValues: toOperationsValues({}),
  });

  useEffect(() => {
    if (settings.data) form.reset(toOperationsValues(settings.data));
  }, [settings.data, form]);

  const quicklinks = previewQuicklinks(form.watch('quicklinks_json') ?? '');

  async function onSubmit(values: OperationsValues) {
    try {
      await updateSettings.mutateAsync(values as unknown as Record<string, string>);
      toast('Einstellungen gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <form noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Erinnerungen</h3>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <FormField
            label="Offene Rückmeldungen: Vorlauf"
            hint="Nur Termine innerhalb dieser Zahl von Tagen werden angemahnt."
            error={form.formState.errors.open_reminder_days?.message}
          >
            {(p) => <Input {...p} inputMode="numeric" {...form.register('open_reminder_days')} />}
          </FormField>

          <FormField
            label="Uhrzeit des Sammelhinweises"
            error={form.formState.errors.open_reminder_time?.message}
          >
            {(p) => <TimeInput {...p} {...form.register('open_reminder_time')} />}
          </FormField>

          <FormField
            label="Vereinstermine: Vorlauf in Stunden"
            error={form.formState.errors.event_reminder_hours?.message}
          >
            {(p) => <Input {...p} inputMode="numeric" {...form.register('event_reminder_hours')} />}
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Versand</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Absendername">
              {(p) => <Input {...p} {...form.register('notification_sender_name')} />}
            </FormField>

            <FormField
              label="Absenderadresse"
              hint="Muss zu einer bei Resend verifizierten Domain gehören. Braucht kein Postfach."
              error={form.formState.errors.notification_sender_email?.message}
            >
              {(p) => (
                <Input {...p} type="email" {...form.register('notification_sender_email')} />
              )}
            </FormField>
          </div>

          <FormField
            label="Antwortadresse"
            hint="Hierhin geht, wer auf eine Benachrichtigung antwortet — und das tut jemand. Ein Postfach, das der Verein ohnehin hat. Leer: Antworten laufen ins Leere."
            error={form.formState.errors.notification_reply_to?.message}
          >
            {(p) => <Input {...p} type="email" {...form.register('notification_reply_to')} />}
          </FormField>

          <FormField
            label="Adresse der Anwendung"
            hint="Basis für alle Links in Benachrichtigungen. Fehlt sie, führt kein Antwortlink irgendwohin."
            error={form.formState.errors.app_url?.message}
          >
            {(p) => <Input {...p} placeholder="https://" {...form.register('app_url')} />}
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Rechtliches</h3>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Datenschutzhinweis"
            hint="Ohne diese Adresse erfährt niemand, was mit seinen Daten passiert — und die Registrierung verschweigt es."
            error={form.formState.errors.privacy_url?.message}
          >
            {(p) => <Input {...p} placeholder="https://" {...form.register('privacy_url')} />}
          </FormField>

          <FormField
            label="Impressum"
            hint="Für einen eingetragenen Verein mit Website ohnehin Pflicht."
            error={form.formState.errors.imprint_url?.message}
          >
            {(p) => <Input {...p} placeholder="https://" {...form.register('imprint_url')} />}
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Quicklinks der Übersicht</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <FormField
            label="Links"
            hint="Ein JSON-Array aus Objekten mit „label“ und „url“. Nur http- und https-Adressen werden angezeigt."
            error={form.formState.errors.quicklinks_json?.message}
          >
            {(p) => (
              <Textarea
                {...p}
                rows={8}
                className="font-mono text-sm"
                placeholder={QUICKLINKS_PLACEHOLDER}
                {...form.register('quicklinks_json')}
              />
            )}
          </FormField>

          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vorschau</p>
            {quicklinks.accepted.length === 0 ? (
              <p className="mt-1 text-sm text-gray-600">
                Es würde kein Link auf der Übersicht erscheinen.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {quicklinks.accepted.map((link) => (
                  <li
                    key={`${link.label}:${link.url}`}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-700"
                  >
                    {link.label}
                  </li>
                ))}
              </ul>
            )}
            {quicklinks.dropped > 0 && (
              <p className="mt-2 text-sm text-status-late">
                {quicklinks.dropped}{' '}
                {quicklinks.dropped === 1 ? 'Eintrag wird' : 'Einträge werden'} nicht angezeigt —
                fehlende Beschriftung oder eine Adresse ohne https://.
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={updateSettings.isPending}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
