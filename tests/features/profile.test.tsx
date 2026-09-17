import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Der Supabase-Client wird durch einen kleinen Kettenbau ersetzt. Er ahmt nur so viel
 * nach, wie die Abfragen im Feature tatsächlich benutzen: select/eq/order liefern Zeilen,
 * insert/update/delete merken sich den Aufruf. So testen wir unsere Logik, nicht die
 * Bibliothek.
 */
const state = {
  absences: [] as Record<string, unknown>[],
  inserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; id: unknown }[],
  insertError: null as { message: string } | null,
};

const rpc = vi.fn();
const updateUser = vi.fn();

function builderFor(table: string) {
  const chain = {
    select: () => chain,
    eq: (_column: string, value: unknown) => {
      chain._lastEq = value;
      return chain;
    },
    order: () => Promise.resolve({ data: state.absences, error: null }),
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return Promise.resolve({ error: state.insertError });
    },
    update: (values: unknown) => {
      state.updates.push({ table, values });
      return {
        eq: () => Promise.resolve({ error: null }),
      };
    },
    delete: () => ({
      eq: (_column: string, value: unknown) => {
        state.deletes.push({ table, id: value });
        return Promise.resolve({ error: null });
      },
    }),
    _lastEq: undefined as unknown,
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => builderFor(table),
    rpc: (...args: unknown[]) => rpc(...args),
    auth: {
      updateUser: (...args: unknown[]) => updateUser(...args),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

import type { Profile } from '../../src/features/profile/api';
import ProfilePage from '../../src/features/profile/ProfilePage';
import { parseEmailList, absenceSchema } from '../../src/features/profile/schemas';
import { ToastProvider } from '../../src/components/ui';

const profile: Profile = {
  id: 'p-1',
  first_name: 'Anna',
  last_name: 'Beispiel',
  full_name: 'Anna Beispiel',
  email: 'anna@example.com',
  phone: null,
  mobile_phone: null,
  gender: 'female',
  birthday: '1990-04-12',
  member_number: null,
  role: 'member',
  status: 'active',
  no_games: false,
  qttr: 1420,
  contact_visible: true,
  hide_birthday: false,
  emails_copies: [],
  reminder_games_hours: 48,
  auth_linked_at: null,
  last_login_at: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile,
    role: 'member',
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderProfilePage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <ProfilePage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.absences = [];
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.insertError = null;
  rpc.mockResolvedValue({ data: null, error: null });
  updateUser.mockResolvedValue({ error: null });
});

describe('ProfilePage', () => {
  it('zeigt alle vier Reiter', () => {
    renderProfilePage();

    for (const label of [
      'Profil',
      'Abwesenheiten',
      'Benachrichtigungen',
      'Automatische Trainingszusagen',
    ]) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('füllt das Formular mit den vorhandenen Daten', () => {
    renderProfilePage();

    expect(screen.getByLabelText(/Vorname/)).toHaveValue('Anna');
    expect(screen.getByLabelText(/Nachname/)).toHaveValue('Beispiel');
    expect(screen.getByLabelText(/Erinnerung vor einem Spiel/)).toHaveValue(48);
  });

  it('speichert die geänderten Stammdaten', async () => {
    renderProfilePage();

    const firstName = screen.getByLabelText(/Vorname/);
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Annika');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]).toMatchObject({
      table: 'profiles',
      values: expect.objectContaining({ first_name: 'Annika', reminder_games_hours: 48 }),
    });
  });

  it('verlangt einen Vornamen', async () => {
    renderProfilePage();

    await userEvent.clear(screen.getByLabelText(/Vorname/));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte Vornamen eingeben')).toBeInTheDocument();
    expect(state.updates).toHaveLength(0);
  });

  it('weist eine unsinnige Erinnerungszeit ab', async () => {
    renderProfilePage();

    const hours = screen.getByLabelText(/Erinnerung vor einem Spiel/);
    await userEvent.clear(hours);
    await userEvent.type(hours, '999');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/Höchstens 336 Stunden/)).toBeInTheDocument();
    expect(state.updates).toHaveLength(0);
  });

  it('ändert das Passwort nur, wenn die Wiederholung passt', async () => {
    renderProfilePage();

    await userEvent.type(screen.getByLabelText('Neues Passwort'), 'geheim123');
    await userEvent.type(screen.getByLabelText('Wiederholen'), 'geheim124');
    await userEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));

    expect(await screen.findByText(/stimmen nicht überein/)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Wiederholen'));
    await userEvent.type(screen.getByLabelText('Wiederholen'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'geheim123' }));
  });

  it('löscht das Konto erst nach Rückfrage', async () => {
    renderProfilePage();

    await userEvent.click(screen.getByRole('button', { name: /Profil & Zugang löschen/ }));
    expect(rpc).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Endgültig löschen' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('rpc_delete_my_account'));
  });
});

describe('Abwesenheiten', () => {
  async function openAbsences() {
    renderProfilePage();
    await userEvent.click(screen.getByRole('tab', { name: 'Abwesenheiten' }));
  }

  it('erklärt den leeren Zustand', async () => {
    await openAbsences();
    expect(await screen.findByText('Keine Abwesenheiten eingetragen')).toBeInTheDocument();
  });

  it('listet vorhandene Abwesenheiten', async () => {
    state.absences = [
      {
        id: 'a-1',
        profile_id: 'p-1',
        start_date: '2026-10-05',
        end_date: '2026-10-12',
        comment_private: 'Urlaub',
      },
    ];

    await openAbsences();

    // Die Tabelle rendert beide Varianten (Zeilen und Karten); das Ausblenden macht CSS,
    // das jsdom nicht auswertet. Deshalb hier bewusst die *All*-Abfragen.
    expect(await screen.findAllByText('Urlaub')).not.toHaveLength(0);
    expect(screen.getAllByText(/05\.10\.2026/).length).toBeGreaterThan(0);
  });

  it('lässt ein Ende vor dem Anfang nicht zu', async () => {
    await openAbsences();

    await userEvent.click(screen.getByRole('button', { name: /Abwesenheit anlegen/ }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText(/Von/), '2026-10-12');
    await userEvent.type(within(dialog).getByLabelText(/Bis/), '2026-10-05');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    expect(
      await screen.findByText('Das Ende darf nicht vor dem Anfang liegen'),
    ).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });

  it('legt eine Abwesenheit mit privatem Kommentar an', async () => {
    await openAbsences();

    await userEvent.click(screen.getByRole('button', { name: /Abwesenheit anlegen/ }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText(/Von/), '2026-10-05');
    await userEvent.type(within(dialog).getByLabelText(/Bis/), '2026-10-12');
    await userEvent.type(within(dialog).getByLabelText(/Kommentar/), 'Urlaub');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.inserts).toHaveLength(1));
    expect(state.inserts[0]).toMatchObject({
      table: 'absences',
      values: {
        profile_id: 'p-1',
        start_date: '2026-10-05',
        end_date: '2026-10-12',
        comment_private: 'Urlaub',
      },
    });
  });

  it('löscht eine Abwesenheit', async () => {
    state.absences = [
      {
        id: 'a-1',
        profile_id: 'p-1',
        start_date: '2026-10-05',
        end_date: '2026-10-12',
        comment_private: null,
      },
    ];

    await openAbsences();

    const buttons = await screen.findAllByRole('button', { name: 'Abwesenheit löschen' });
    await userEvent.click(buttons[0]);

    await waitFor(() => expect(state.deletes).toEqual([{ table: 'absences', id: 'a-1' }]));
  });
});

describe('Hilfsfunktionen', () => {
  it('zerlegt eine Kommaliste von E-Mail-Adressen', () => {
    expect(parseEmailList(' eltern@example.com , oma@example.com ,, ')).toEqual([
      'eltern@example.com',
      'oma@example.com',
    ]);
    expect(parseEmailList('')).toEqual([]);
  });

  it('akzeptiert eine eintägige Abwesenheit', () => {
    const result = absenceSchema.safeParse({
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      comment: '',
    });
    expect(result.success).toBe(true);
  });
});
