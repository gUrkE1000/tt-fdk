import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, ShieldX } from 'lucide-react';
import { Button, EmptyState, FormField, Input, useToast } from '../../components/ui';
import { registerWithCode, usePublicClubInfo, validateRegistrationCode } from './api';
import { registerSchema, type RegisterValues } from './schemas';

/**
 * Selbstregistrierung über den Vereinslink oder QR-Code (/register/:code).
 * Der Code wird hier nur für eine frühe Rückmeldung geprüft; verbindlich entscheidet
 * der Trigger handle_new_user() in der Datenbank.
 */
export default function RegisterPage() {
  const { code = '' } = useParams();
  const { toast } = useToast();
  const clubInfo = usePublicClubInfo();
  const [done, setDone] = useState(false);

  const codeCheck = useQuery({
    queryKey: ['registration-code', code],
    queryFn: () => validateRegistrationCode(code),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  if (codeCheck.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div
          role="status"
          aria-label="Lädt"
          className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary"
        />
      </div>
    );
  }

  if (codeCheck.data !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <EmptyState
          icon={ShieldX}
          title="Dieser Registrierungslink gilt nicht mehr"
          description="Bitte frag im Verein nach einem aktuellen Link oder QR-Code."
          action={
            <Link to="/login">
              <Button>Zur Anmeldung</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <EmptyState
          icon={MailCheck}
          title="Fast geschafft"
          description="Wir haben dir eine E-Mail geschickt. Bestätige sie und warte kurz — ein Administrator des Vereins schaltet deinen Zugang frei."
          action={
            <Link to="/login">
              <Button>Zur Anmeldung</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="text-4xl" aria-hidden="true">
            🏓
          </span>
          <h1 className="mt-2 text-xl font-bold text-gray-900">
            {clubInfo.data?.club_name ?? 'Vereinsplaner'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Registrierung für neue Mitglieder</p>
        </div>

        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async (values) => {
            try {
              await registerWithCode({ ...values, registrationCode: code });
              setDone(true);
            } catch (error) {
              toast(
                error instanceof Error ? error.message : 'Registrierung fehlgeschlagen',
                'error',
              );
            }
          })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vorname" required error={errors.firstName?.message}>
              {(p) => <Input {...p} {...register('firstName')} autoComplete="given-name" />}
            </FormField>
            <FormField label="Nachname" required error={errors.lastName?.message}>
              {(p) => <Input {...p} {...register('lastName')} autoComplete="family-name" />}
            </FormField>
          </div>

          <FormField label="E-Mail-Adresse" required error={errors.email?.message}>
            {(p) => <Input {...p} {...register('email')} type="email" autoComplete="email" />}
          </FormField>

          <FormField
            label="Passwort"
            hint="Optional. Ohne Passwort meldest du dich per E-Mail-Link an."
            error={errors.password?.message}
          >
            {(p) => (
              <Input {...p} {...register('password')} type="password" autoComplete="new-password" />
            )}
          </FormField>

          <Button type="submit" variant="primary" block loading={isSubmitting}>
            Registrieren
          </Button>
        </form>
      </div>
    </div>
  );
}
