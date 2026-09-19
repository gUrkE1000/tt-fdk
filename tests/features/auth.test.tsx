import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Der Supabase-Client wird vollständig ersetzt: es soll nie eine echte Anfrage rausgehen.
const signInWithOtp = vi.fn();
const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
const rpc = vi.fn();

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: (...args: unknown[]) => rpc(...args),
    from: vi.fn(),
  },
  APP_URL: 'http://localhost:5173',
}));

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: null,
    role: null,
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import LoginPage from '../../src/features/auth/LoginPage';
import RegisterPage from '../../src/features/auth/RegisterPage';
import { withTimeout } from '../../src/features/auth/api';
import { ToastProvider } from '../../src/components/ui';

function renderWithProviders(ui: React.ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={ui} />
            <Route path="/register" element={ui} />
            <Route path="/register/:code" element={ui} />
            <Route path="*" element={ui} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [{ club_name: 'TTC Musterstadt', club_short_name: 'TTC' }], error: null });
  signInWithOtp.mockResolvedValue({ error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

describe('LoginPage', () => {
  it('zeigt den Vereinsnamen', async () => {
    renderWithProviders(<LoginPage />, '/login');
    expect(await screen.findByText('TTC Musterstadt')).toBeInTheDocument();
  });

  it('startet mit der Anmeldung per E-Mail-Link', () => {
    renderWithProviders(<LoginPage />, '/login');
    expect(screen.getByRole('button', { name: 'Link senden' })).toBeInTheDocument();
    expect(screen.queryByText('Direkt-Auswahl')).toBeNull();
  });

  it('fordert einen Anmeldelink an und legt dabei kein Konto an', async () => {
    renderWithProviders(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('E-Mail-Adresse'), 'anna@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Link senden' }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'anna@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    );
  });

  it('bestätigt den Versand statt still zu bleiben', async () => {
    renderWithProviders(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('E-Mail-Adresse'), 'anna@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Link senden' }));

    expect(await screen.findByText(/Anmeldelink/)).toBeInTheDocument();
    expect(screen.getByText('anna@example.com')).toBeInTheDocument();
  });

  it('prüft die E-Mail-Adresse vor dem Absenden', async () => {
    renderWithProviders(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('E-Mail-Adresse'), 'keine-email');
    await userEvent.click(screen.getByRole('button', { name: 'Link senden' }));

    expect(await screen.findByText(/sieht nicht nach einer E-Mail/)).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('erklärt verständlich, wenn die Adresse dem Verein nicht bekannt ist', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } });
    renderWithProviders(<LoginPage />, '/login');

    await userEvent.type(screen.getByLabelText('E-Mail-Adresse'), 'fremd@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Link senden' }));

    expect(await screen.findByText(/im Verein nicht bekannt/)).toBeInTheDocument();
  });

  it('meldet über den zweiten Tab mit Passwort an', async () => {
    renderWithProviders(<LoginPage />, '/login');

    await userEvent.click(screen.getByRole('tab', { name: 'Mit Passwort' }));
    await userEvent.type(screen.getByLabelText('E-Mail-Adresse'), 'anna@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
  });
});

describe('RegisterPage', () => {
  it('weist einen ungültigen Vereinscode ab', async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === 'rpc_validate_registration_code') return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: [{ club_name: 'TTC Musterstadt' }], error: null });
    });

    renderWithProviders(<RegisterPage />, '/register/FALSCH');

    expect(await screen.findByText(/gilt nicht mehr/)).toBeInTheDocument();
  });

  it('zeigt das Formular bei gültigem Code', async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === 'rpc_validate_registration_code') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: [{ club_name: 'TTC Musterstadt' }], error: null });
    });

    renderWithProviders(<RegisterPage />, '/register/TESTCODE');

    expect(await screen.findByRole('button', { name: 'Registrieren' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Vorname/)).toBeInTheDocument();
  });

  /*
    Der Ladekringel darf nie der Endzustand sein. Jeder Fall hier endete vorher in einer
    Anzeige, aus der nicht hervorging, was zu tun ist — oder gar nicht.
  */
  it('nennt den Grund, statt den Code zu beschuldigen, wenn die Prüfung scheitert', async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === 'rpc_validate_registration_code') {
        return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      }
      return Promise.resolve({ data: [{ club_name: 'TTC Musterstadt' }], error: null });
    });

    renderWithProviders(<RegisterPage />, '/register/TESTCODE');

    expect(await screen.findByText(/ließ sich gerade nicht prüfen/)).toBeInTheDocument();
    expect(screen.getByText(/Keine Verbindung zum Server/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    // Gerade nicht: Der Code kann völlig richtig sein.
    expect(screen.queryByText(/gilt nicht mehr/)).not.toBeInTheDocument();
  });

  it('erklärt einen fehlenden Einrichtungsschritt, statt ihn dem Mitglied anzulasten', async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === 'rpc_validate_registration_code') {
        return Promise.resolve({
          data: null,
          error: { message: 'Could not find the function', code: 'PGRST202' },
        });
      }
      return Promise.resolve({ data: [{ club_name: 'TTC Musterstadt' }], error: null });
    });

    renderWithProviders(<RegisterPage />, '/register/TESTCODE');

    expect(await screen.findByText(/noch nicht fertig eingerichtet/)).toBeInTheDocument();
  });

  it('dreht sich nicht ewig, wenn der Link keinen Code enthält', async () => {
    renderWithProviders(<RegisterPage />, '/register');

    expect(await screen.findByText(/fehlt der Vereinscode/)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Lädt' })).not.toBeInTheDocument();
    // Ohne Code darf gar nicht erst gefragt werden.
    expect(
      rpc.mock.calls.filter((call) => call[0] === 'rpc_validate_registration_code'),
    ).toHaveLength(0);
  });
});

describe('withTimeout', () => {
  it('gibt das Ergebnis weiter, solange es rechtzeitig kommt', async () => {
    await expect(withTimeout(Promise.resolve('da'), 'Prüfen')).resolves.toBe('da');
  });

  it('bricht ab, statt endlos zu warten', async () => {
    vi.useFakeTimers();
    try {
      // Eine Anfrage, die nie beantwortet wird — genau der Fall, der die
      // Registrierungsseite ewig laden ließ.
      const pending = withTimeout(new Promise(() => {}), 'Prüfen des Registrierungslinks');
      const caught = expect(pending).rejects.toThrow(/nicht geantwortet/);
      await vi.advanceTimersByTimeAsync(13_000);
      await caught;
    } finally {
      vi.useRealTimers();
    }
  });
});
