import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DateInput,
  Dialog,
  FormField,
  Input,
  PasswordInput,
  Select,
  useToast,
} from '../../components/ui';
import { GENDER_LABELS, roleLabel } from '../../lib/labels';
import { changePassword, deleteMyAccount, useUpdateMyProfile, type Profile } from './api';
import {
  parseEmailList,
  passwordSchema,
  profileSchema,
  type PasswordValues,
  type ProfileValues,
} from './schemas';
import { signOut } from '../auth/api';
import ThemeToggle from './ThemeToggle';

const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }));

export default function ProfileTab({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const updateProfile = useUpdateMyProfile();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile.first_name,
      lastName: profile.last_name,
      gender: profile.gender,
      birthday: profile.birthday ?? '',
      phone: profile.phone ?? '',
      mobilePhone: profile.mobile_phone ?? '',
      emailsCopies: (profile.emails_copies ?? []).join(', '),
      reminderGamesHours: profile.reminder_games_hours,
      contactVisible: profile.contact_visible,
      hideBirthday: profile.hide_birthday,
    },
  });

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <h3 className="font-bold text-gray-900">Meine Daten</h3>
            <p className="text-sm text-gray-500">
              Rolle: {roleLabel(profile.role)}
              {profile.qttr != null && ` · ${profile.qttr} QTTR`}
            </p>
          </div>
        </CardHeader>

        <CardBody>
          <form
            noValidate
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await updateProfile.mutateAsync({
                  id: profile.id,
                  values: {
                    first_name: values.firstName,
                    last_name: values.lastName,
                    gender: values.gender,
                    birthday: values.birthday || null,
                    phone: values.phone || null,
                    mobile_phone: values.mobilePhone || null,
                    emails_copies: parseEmailList(values.emailsCopies ?? ''),
                    reminder_games_hours: values.reminderGamesHours,
                    contact_visible: values.contactVisible,
                    hide_birthday: values.hideBirthday,
                  },
                });
                toast('Profil gespeichert', 'success');
              } catch (error) {
                toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
              }
            })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Vorname" required error={form.formState.errors.firstName?.message}>
                {(p) => <Input {...p} {...form.register('firstName')} />}
              </FormField>
              <FormField label="Nachname" required error={form.formState.errors.lastName?.message}>
                {(p) => <Input {...p} {...form.register('lastName')} />}
              </FormField>
              <FormField label="Geschlecht">
                {(p) => <Select {...p} {...form.register('gender')} options={GENDER_OPTIONS} />}
              </FormField>
              <FormField label="Geburtstag">
                {(p) => <DateInput {...p} {...form.register('birthday')} />}
              </FormField>
              <FormField label="Telefon">
                {(p) => <Input {...p} {...form.register('phone')} type="tel" />}
              </FormField>
              <FormField label="Handy">
                {(p) => <Input {...p} {...form.register('mobilePhone')} type="tel" />}
              </FormField>
            </div>

            <FormField
              label="E-Mail-Adressen für Kopien"
              hint="Kommagetrennt. An diese Adressen gehen alle Benachrichtigungen zusätzlich — hilfreich für Eltern."
              error={form.formState.errors.emailsCopies?.message}
            >
              {(p) => <Input {...p} {...form.register('emailsCopies')} placeholder="eltern@example.com" />}
            </FormField>

            <FormField
              label="Erinnerung vor einem Spiel (Stunden)"
              hint="Wie lange vor dem Spiel möchtest du erinnert werden?"
              error={form.formState.errors.reminderGamesHours?.message}
            >
              {(p) => (
                <Input
                  {...p}
                  {...form.register('reminderGamesHours', { valueAsNumber: true })}
                  type="number"
                  min={0}
                  max={336}
                />
              )}
            </FormField>

            <div className="space-y-2 rounded-xl bg-gray-50 p-3">
              <Checkbox
                checked={form.watch('contactVisible')}
                onCheckedChange={(value) => form.setValue('contactVisible', value)}
                label="Kontaktdaten für alle Mitglieder sichtbar machen"
                hint="Sonst sehen nur Administratoren deine E-Mail-Adresse und Telefonnummer."
              />
              <Checkbox
                checked={form.watch('hideBirthday')}
                onCheckedChange={(value) => form.setValue('hideBirthday', value)}
                label="Geburtstag nicht anzeigen"
                hint="Betrifft die Anzeige im Vereinskalender."
              />
            </div>

            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              Speichern
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Darstellung</h3>
        </CardHeader>
        <CardBody className="space-y-2">
          <ThemeToggle />
          <p className="text-sm text-gray-500">
            Die Einstellung gilt für dieses Gerät — abends am Handy dunkel und tagsüber am
            Rechner hell ist damit kein Widerspruch.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Passwort</h3>
        </CardHeader>
        <CardBody>
          <form
            noValidate
            className="space-y-3"
            onSubmit={passwordForm.handleSubmit(async (values) => {
              try {
                await changePassword(values.password);
                passwordForm.reset();
                toast('Passwort geändert', 'success');
              } catch (error) {
                toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
              }
            })}
          >
            <p className="text-sm text-gray-500">
              Optional — du kannst dich auch weiterhin per E-Mail-Link anmelden.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Neues Passwort" error={passwordForm.formState.errors.password?.message}>
                {(p) => (
                  <PasswordInput {...p} {...passwordForm.register('password')} autoComplete="new-password" />
                )}
              </FormField>
              <FormField label="Wiederholen" error={passwordForm.formState.errors.confirm?.message}>
                {(p) => (
                  <PasswordInput {...p} {...passwordForm.register('confirm')} autoComplete="new-password" />
                )}
              </FormField>
            </div>
            <Button type="submit" loading={passwordForm.formState.isSubmitting}>
              Passwort setzen
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-danger">Konto löschen</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-gray-600">
            Dein Zugang wird gesperrt und dein Profil aus allen Listen entfernt. Vergangene
            Spiele und Aufstellungen bleiben für den Verein nachvollziehbar.
          </p>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Profil &amp; Zugang löschen
          </Button>
        </CardBody>
      </Card>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Konto wirklich löschen?"
        description="Das lässt sich nur durch einen Administrator rückgängig machen."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Abbrechen</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await deleteMyAccount();
                  await signOut();
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
                  setDeleteOpen(false);
                }
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Du wirst abgemeldet und kannst dich nicht mehr anmelden.
        </p>
      </Dialog>
    </div>
  );
}
