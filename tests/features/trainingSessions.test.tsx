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
  inserts: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; values: unknown[] }[],
};

function makeBuilder(table: string) {
  const deleted: unknown[] = [];
  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    gte: () => chain,
    lte: () => chain,
    eq: (_column: string, value: unknown) => {
      deleted.push(value);
      return chain;
    },
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 'neu-1' }, error: null }) }),
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
    },
    delete: () => {
      const target = { table, values: deleted };
      state.deletes.push(target);
      return chain;
    },
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
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

const profile = { id: 'p-01', full_name: 'Spieler 01', role: 'member', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({ session: null, profile, role: 'member', loading: false, previousLoginAt: null }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SessionsTab from '../../src/features/trainings/SessionsTab';
import OpenTrainingsList from '../../src/features/trainings/OpenTrainingsList';
import { ToastProvider } from '../../src/components/ui';

const inTwoDays = new Date(Date.now() + 2 * 86_400_000);
const day = inTwoDays.toISOString().slice(0, 10);

const training = {
  id: 'tr-1',
  name: 'Erwachsenentraining',
  type: 'adults',
  weekday: 2,
  time_start: '19:00:00',
  time_end: '21:00:00',
  venue_id: 'v-1',
  rhythm: 'weekly',
  start_date: '2026-09-01',
  reminder_hours: 5,
  details: 'Bitte Hallenschuhe mitbringen',
  max_participants: null,
  is_open: false,
  trainer_invites_only: false,
  is_incognito: false,
  requires_key_owner: false,
  skip_public_holidays: true,
  skip_school_holidays: false,
  hide_in_calendar: false,
  auto_cancel_no_trainers: false,
  statistics_visibility: 'admins',
  active: true,
};

const incognito = {
  ...training,
  id: 'tr-2',
  name: 'Jugendtraining',
  is_incognito: true,
  max_participants: 4,
};

const openTraining = {
  ...training,
  id: 'tr-3',
  name: 'Offenes Training',
  is_open: true,
  rhythm: 'biweekly',
};

function renderPage(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    trainings: [training, incognito, openTraining],
    training_trainers: [{ training_id: 'tr-1', profile_id: 'p-tina' }],
    training_members: [
      { training_id: 'tr-1', profile_id: 'p-01' },
      { training_id: 'tr-2', profile_id: 'p-01' },
    ],
    training_statistics_groups: [],
    training_sessions: [
      {
        id: 's-1',
        training_id: 'tr-1',
        session_date: day,
        starts_at: `${day}T17:00:00.000Z`,
        ends_at: `${day}T19:00:00.000Z`,
        cancelled: false,
        cancel_reason: '',
        cancellation_id: null,
        reminder_sent_at: null,
      },
      {
        id: 's-2',
        training_id: 'tr-2',
        session_date: day,
        starts_at: `${day}T15:00:00.000Z`,
        ends_at: null,
        cancelled: false,
        cancel_reason: '',
        cancellation_id: null,
        reminder_sent_at: null,
      },
      {
        id: 's-3',
        training_id: 'tr-1',
        session_date: day,
        starts_at: `${day}T18:00:00.000Z`,
        ends_at: null,
        cancelled: true,
        cancel_reason: 'Halle ist Wahllokal',
        cancellation_id: 'c-1',
        reminder_sent_at: null,
      },
    ],
    // Zum inkognito geführten Training gibt die Datenbank weder Namen noch Zähler heraus.
    v_session_participants: [
      {
        session_id: 's-1',
        training_id: 'tr-1',
        profile_id: 'p-01',
        full_name: 'Spieler 01',
        status: 'yes',
        guests: 1,
        source: 'self',
        updated_at: '2026-09-10T00:00:00Z',
      },
      {
        session_id: 's-1',
        training_id: 'tr-1',
        profile_id: 'p-02',
        full_name: 'Spieler 02',
        status: 'late',
        guests: 0,
        source: 'self',
        updated_at: '2026-09-10T00:00:00Z',
      },
    ],
    v_session_counts: [
      {
        session_id: 's-1',
        training_id: 'tr-1',
        yes_count: 1,
        late_count: 1,
        no_count: 0,
        guest_count: 1,
      },
    ],
    profiles: [
      { id: 'p-01', full_name: 'Spieler 01', qttr: 1217, deleted_at: null },
      { id: 'p-02', full_name: 'Spieler 02', qttr: 1234, deleted_at: null },
      { id: 'p-tina', full_name: 'Tina Trainerin', qttr: 1710, deleted_at: null },
    ],
    venues: [
      {
        id: 'v-1',
        name: 'Sporthalle Musterstadt',
        address: 'Turnstraße 5',
        postal_code: '12345',
        city: 'Musterstadt',
        active: true,
      },
    ],
  };
  state.rpcCalls = [];
  state.inserts = [];
  state.deletes = [];
});

describe('SessionsTab', () => {
  it('zeigt Name, Ort und Trainer eines Termins', async () => {
    renderPage(<SessionsTab />);

    expect(await screen.findAllByText('Erwachsenentraining')).not.toHaveLength(0);
    expect(screen.getAllByText(/Sporthalle Musterstadt/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trainer: Tina Trainerin').length).toBeGreaterThan(0);
  });

  it('zählt Teilnehmer und Gäste', async () => {
    renderPage(<SessionsTab />);
    expect(await screen.findByText('2 Teilnehmer · 1 Gäste')).toBeInTheDocument();
  });

  it('verrät bei einem Inkognito-Training weder Liste noch Zahl', async () => {
    renderPage(<SessionsTab />);

    expect(await screen.findByText('Jugendtraining')).toBeInTheDocument();
    expect(
      screen.getByText('Wer mitmacht, sieht bei diesem Training nur der Trainer.'),
    ).toBeInTheDocument();
  });

  it('nennt bei einem abgesagten Termin den Grund und bietet keine Rückmeldung an', async () => {
    renderPage(<SessionsTab />);

    expect(await screen.findByText('Halle ist Wahllokal')).toBeInTheDocument();
    // Zwei offene Termine, der abgesagte hat keine Knöpfe.
    expect(screen.getAllByRole('button', { name: 'Bin dabei' })).toHaveLength(2);
  });

  it('zeigt die eigene Rückmeldung als gedrückt', async () => {
    renderPage(<SessionsTab />);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Bin dabei' })[0]).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('speichert eine Absage über die Datenbankfunktion', async () => {
    renderPage(<SessionsTab />);
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(screen.getAllByRole('button', { name: 'Bin nicht dabei' })[0]);

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_set_training_attendance',
        args: {
          p_session_id: 's-1',
          p_status: 'no',
          p_guests: 1,
          p_profile_id: null,
        },
      }),
    );
  });

  it('schickt die Gästezahl mit der Rückmeldung', async () => {
    renderPage(<SessionsTab />);
    await screen.findAllByText('Erwachsenentraining');

    const guests = screen.getAllByLabelText('Gäste')[0];
    await userEvent.clear(guests);
    await userEvent.type(guests, '3');

    await waitFor(() => {
      const last = state.rpcCalls.at(-1);
      expect((last?.args as { p_guests: number })?.p_guests).toBe(3);
    });
  });

  it('übernimmt den Hinweis des Trainings', async () => {
    renderPage(<SessionsTab />);
    expect(await screen.findAllByText('Bitte Hallenschuhe mitbringen')).not.toHaveLength(0);
  });

  it('zeigt mit „onlyMine“ nur Trainings, zu denen man gehört', async () => {
    state.tables.training_members = [{ training_id: 'tr-1', profile_id: 'p-01' }];
    renderPage(<SessionsTab onlyMine />);

    await screen.findAllByText('Erwachsenentraining');
    expect(screen.queryByText('Jugendtraining')).toBeNull();
  });
});

describe('OpenTrainingsList', () => {
  it('listet nur offene Trainings', async () => {
    renderPage(<OpenTrainingsList />);

    expect(await screen.findAllByText('Offenes Training')).not.toHaveLength(0);
    expect(screen.queryByText('Jugendtraining')).toBeNull();
  });

  it('erklärt, worum es geht', async () => {
    renderPage(<OpenTrainingsList />);
    expect(
      await screen.findByText(/jedes Vereinsmitglied herzlich eingeladen/),
    ).toBeInTheDocument();
  });

  it('trägt bei „Teilnehmen“ die eigene Zeile ein', async () => {
    renderPage(<OpenTrainingsList />);
    await screen.findAllByText('Offenes Training');

    await userEvent.click(screen.getAllByRole('button', { name: 'Teilnehmen' })[0]);

    await waitFor(() =>
      expect(state.inserts).toContainEqual({
        table: 'training_members',
        values: { training_id: 'tr-3', profile_id: 'p-01' },
      }),
    );
  });

  it('bietet zum Austragen den Gegenknopf an', async () => {
    state.tables.training_members = [
      ...(state.tables.training_members ?? []),
      { training_id: 'tr-3', profile_id: 'p-01' },
    ];

    renderPage(<OpenTrainingsList />);

    expect(await screen.findAllByRole('button', { name: 'Nicht mehr teilnehmen' })).not.toHaveLength(
      0,
    );
  });
});
