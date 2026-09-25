import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { MailCheck, UserPlus } from 'lucide-react';
import { Button, FormField, Input, PasswordInput, Tabs, useToast } from '../../components/ui';
import {
  requestMagicLink,
  requestPasswordReset,
  signInWithPassword,
  usePublicClubInfo,
} from './api';
import {
  magicLinkSchema,
  passwordLoginSchema,
  type MagicLinkValues,
  type PasswordLoginValues,
} from './schemas';
import { useSession } from './session';

function MagicLinkForm() {
  const { toast } = useToast();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkValues>({ resolver: zodResolver(magicLinkSchema) });

  if (sentTo) {
    return (
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-status-yes" aria-hidden="true" />
        <p className="text-sm text-gray-700">
          Wir haben dir einen Anmeldelink an <strong>{sentTo}</strong> geschickt.
        </p>
        <p className="text-xs text-gray-500">
          Öffne den Link auf diesem Gerät. Er ist nur kurze Zeit gültig.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>
          Andere Adresse verwenden
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        try {
          await requestMagicLink(values.email);
          setSentTo(values.email.trim());
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen', 'error');
        }
      })}
    >
      <FormField label="E-Mail-Adresse" error={errors.email?.message}>
        {(p) => (
          <Input
            {...p}
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
          />
        )}
      </FormField>

      <Button type="submit" variant="primary" block loading={isSubmitting}>
        Link senden
      </Button>

      <p className="text-center text-xs text-gray-500">
        Kein Passwort nötig. Du bekommst eine E-Mail mit einem Link, der dich anmeldet.
      </p>
    </form>
  );
}

function PasswordForm() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PasswordLoginValues>({ resolver: zodResolver(passwordLoginSchema) });

  async function onForgotPassword() {
    const email = getValues('email');
    if (!email) {
      toast('Bitte zuerst die E-Mail-Adresse eintragen.', 'warning');
      return;
    }
    try {
      await requestPasswordReset(email);
      toast('Wir haben dir eine E-Mail zum Zurücksetzen geschickt.', 'success');
    } catch {
      toast('Das hat nicht geklappt. Bitte später erneut versuchen.', 'error');
    }
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        try {
          await signInWithPassword(values.email, values.password);
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen', 'error');
        }
      })}
    >
      <FormField label="E-Mail-Adresse" error={errors.email?.message}>
        {(p) => <Input {...p} {...register('email')} type="email" autoComplete="email" />}
      </FormField>

      <FormField label="Passwort" error={errors.password?.message}>
        {(p) => (
          <PasswordInput {...p} {...register('password')} autoComplete="current-password" />
        )}
      </FormField>

      <Button type="submit" variant="primary" block loading={isSubmitting}>
        Anmelden
      </Button>

      <button
        type="button"
        onClick={onForgotPassword}
        className="block w-full text-center text-xs text-gray-500 underline hover:text-gray-700"
      >
        Passwort vergessen?
      </button>
    </form>
  );
}

/**
 * „Konto erstellen": Registrieren geht nur mit dem Vereinscode (Link oder QR-Code),
 * danach schaltet der Administrator frei. Der Reiter fragt den Code ab und öffnet das
 * Registrierungsformular — dasselbe, auf das der Vereinslink führt.
 */
export function RegisterCodeForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const trimmed = code.trim();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) navigate(`/register/${encodeURIComponent(trimmed)}`);
      }}
    >
      <FormField
        label="Vereinscode"
        hint="Steht im Registrierungslink oder unter dem QR-Code des Vereins. Hast du keinen, frag im Verein."
      >
        {(p) => (
          <Input
            {...p}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
          />
        )}
      </FormField>
      <Button type="submit" variant="primary" className="w-full" disabled={!trimmed}>
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Weiter zur Registrierung
      </Button>
      <p className="text-xs text-gray-500">
        Nach der Registrierung schaltet dich ein Administrator frei. Wurdest du per E-Mail
        eingeladen, brauchst du kein Konto anzulegen — melde dich einfach mit dem E-Mail-Link an.
      </p>
    </form>
  );
}

export default function LoginPage() {
  const { session, loading } = useSession();
  const clubInfo = usePublicClubInfo();

  // Wer schon angemeldet ist, hat auf dem Anmeldebildschirm nichts zu suchen.
  if (!loading && session) return <Navigate to="/" replace />;

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
          <p className="mt-0.5 text-sm text-gray-500">Anmeldung für Vereinsmitglieder</p>
        </div>

        <Tabs
          tabs={[
            { value: 'link', label: 'Mit E-Mail-Link', content: <MagicLinkForm /> },
            { value: 'password', label: 'Mit Passwort', content: <PasswordForm /> },
            { value: 'register', label: 'Konto erstellen', content: <RegisterCodeForm /> },
          ]}
        />
      </div>
    </div>
  );
}
