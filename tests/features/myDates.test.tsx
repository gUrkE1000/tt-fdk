import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  rpcCalls: [] as { name: string; args: unknown }[],
  token: '11111111-2222-3333-4444-555555555555',
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: state.tables[table] ?? [], error: null }),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (name: string, args: unknown) => {
      state.rpcCalls.push({ name, args });
      if (name === 'rpc_reset_calendar_token') {
        state.token = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      }
      return Promise.resolve({ data: state.token, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
  FUNCTIONS_URL: 'http://localhost:54321/functions/v1',
}));

const profile = { id: 'p-01', full_name: 'Spieler 01', role: 'member', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({ session: null, profile, role: 'member', loading: false, previousLoginAt: null }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import MyDatesPage from '../../src/features/calendar/MyDatesPage';
import { ToastProvider } from '../../src/components/ui';

const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <MyDatesPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.token = '11111111-2222-3333-4444-555555555555';
  state.rpcCalls = [];
  state.tables = {
    v_my_upcoming: [
      {
        profile_id: 'p-01',
        kind: 'match',
        id: 'm-1',
        starts_at: soon,
        ends_at: soon,
        title: '1. Herren gegen TTC Nachbarstadt',
        location: 'Sporthalle Musterstadt',
        my_status: 'yes',
        active: true,
      },
      {
        profile_id: 'p-01',
        kind: 'training',
        id: 's-1',
        starts_at: soon,
        ends_at: soon,
        title: 'Erwachsenentraining',
        location: null,
        my_status: 'late',
        active: true,
      },
      {
        profile_id: 'p-01',
        kind: 'event',
        id: 'e-1',
        starts_at: soon,
        ends_at: null,
        title: 'Clubmeisterschaft',
        location: 'Turnstraße 5',
        my_status: 'no',
        active: true,
      },
      {
        profile_id: 'p-01',
        kind: 'match',
        id: 'm-2',
        starts_at: soon,
        ends_at: soon,
        title: 'Abgesagtes Spiel',
        location: null,
        my_status: 'yes',
        active: false,
      },
      {
        profile_id: 'p-01',
        kind: 'match',
        id: 'm-3',
        starts_at: soon,
        ends_at: soon,
        title: 'Noch offen',
        location: null,
        my_status: 'none',
        active: true,
      },
    ],
  };
});

describe('MyDatesPage', () => {
  it('trennt zugesagte und abgesagte Termine', async () => {
    renderPage();

    expect(await screen.findByRole('tab', { name: 'Zugesagte Termine (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Abgesagte Termine (1)' })).toBeInTheDocument();
  });

  it('mischt Spiele, Trainings und Vereinstermine', async () => {
    renderPage();

    expect(await screen.findByText('1. Herren gegen TTC Nachbarstadt')).toBeInTheDocument();
    expect(screen.getByText('Erwachsenentraining')).toBeInTheDocument();
    expect(screen.getByText('Spiel')).toBeInTheDocument();
    expect(screen.getByText('Training')).toBeInTheDocument();
  });

  it('zählt „Komme später" als Zusage', async () => {
    renderPage();
    expect(await screen.findByText('Komme später')).toBeInTheDocument();
  });

  it('lässt offene Termine draußen', async () => {
    renderPage();
    await screen.findByText('1. Herren gegen TTC Nachbarstadt');
    expect(screen.queryByText('Noch offen')).toBeNull();
  });

  it('lässt abgesagte Spiele draußen', async () => {
    renderPage();
    await screen.findByText('1. Herren gegen TTC Nachbarstadt');
    expect(screen.queryByText('Abgesagtes Spiel')).toBeNull();
  });
});

describe('SubscribeDialog', () => {
  it('holt den eigenen Kalender-Link', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Kalender abonnieren/ }));

    const field = (await screen.findByLabelText('Kalender-Link')) as HTMLInputElement;

    await waitFor(() =>
      expect(field.value).toBe(
        'http://localhost:54321/functions/v1/calendar-feed?token=11111111-2222-3333-4444-555555555555',
      ),
    );
    expect(state.rpcCalls.some((call) => call.name === 'rpc_my_calendar_token')).toBe(true);
  });

  it('sagt, was der Link bedeutet', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Kalender abonnieren/ }));

    expect(
      await screen.findByText(/Wer den Link hat, sieht deine zugesagten Termine/),
    ).toBeInTheDocument();
  });

  it('erzeugt auf Wunsch einen neuen Link', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Kalender abonnieren/ }));
    await screen.findByLabelText('Kalender-Link');

    await userEvent.click(screen.getByRole('button', { name: /Link neu erzeugen/ }));

    await waitFor(() =>
      expect((screen.getByLabelText('Kalender-Link') as HTMLInputElement).value).toContain(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ),
    );
  });

  it('nennt Anleitungen für die gängigen Kalender', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Kalender abonnieren/ }));

    expect(await screen.findByRole('link', { name: 'Google Kalender' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Outlook' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apple Kalender' })).toBeInTheDocument();
  });
});
