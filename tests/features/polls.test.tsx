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
  rpcResult: { status: 'ok' } as Record<string, unknown>,
  inserts: [] as { table: string; values: unknown }[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    eq: () => chain,
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 'neu-1' }, error: null }) }),
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
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
      return Promise.resolve({ data: state.rpcResult, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

const profile = { id: 'p-01', full_name: 'Spieler 01', role: 'organizer', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile,
    role: 'organizer',
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import PollsPage from '../../src/features/polls/PollsPage';
import { ToastProvider } from '../../src/components/ui';
import {
  EMPTY_POLL,
  POLL_TYPE_HELP,
  TARGET_HINT,
  isExpired,
  pollSchema,
  resultBars,
} from '../../src/features/polls/schemas';

const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
const past = new Date(Date.now() - 10 * 86_400_000).toISOString();

const poll = {
  id: 'po-1',
  title: 'Termin für die Weihnachtsfeier',
  details_html: '<p>Bitte alle passenden Termine ankreuzen.</p>',
  type: 'vote',
  max_answers: 2,
  expires_at: future,
  hide_results: false,
  created_by: 'p-olaf',
  created_at: past,
  updated_at: past,
};

const personsPoll = {
  ...poll,
  id: 'po-2',
  title: 'Wer hilft beim Aufbau?',
  type: 'persons',
  max_answers: 1,
  expires_at: past,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <PollsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    polls: [poll, personsPoll],
    poll_targets: [],
    poll_options: [
      { id: 'o-1', poll_id: 'po-1', text: 'Freitag, 12.12.', position: 0 },
      { id: 'o-2', poll_id: 'po-1', text: 'Samstag, 13.12.', position: 1 },
      { id: 'o-3', poll_id: 'po-1', text: 'Freitag, 19.12.', position: 2 },
      { id: 'o-9', poll_id: 'po-2', text: 'Ich helfe beim Aufbau', position: 0 },
    ],
    v_poll_results: [
      { poll_id: 'po-1', option_id: 'o-1', text: 'Freitag, 12.12.', position: 0, votes: 1 },
      { poll_id: 'po-1', option_id: 'o-2', text: 'Samstag, 13.12.', position: 1, votes: 4 },
      { poll_id: 'po-1', option_id: 'o-3', text: 'Freitag, 19.12.', position: 2, votes: 0 },
    ],
    v_poll_voters: [
      { poll_id: 'po-2', option_id: 'o-9', profile_id: 'p-02', full_name: 'Spieler 02' },
    ],
    teams: [],
    team_leaders: [],
    team_members: [],
    groups: [],
    group_members: [],
  };
  state.rpcCalls = [];
  state.rpcResult = { status: 'ok' };
  state.inserts = [];
});

// ------------------------------------------------------------------ reine Logik

describe('Umfrage-Schema', () => {
  it('verlangt einen Namen', () => {
    expect(pollSchema.safeParse({ ...EMPTY_POLL, options: ['a'] }).success).toBe(false);
  });

  it('verlangt mindestens eine Antwort', () => {
    const result = pollSchema.safeParse({ ...EMPTY_POLL, title: 'Frage', options: ['  '] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/mindestens eine Antwort/);
    }
  });

  it('lässt nicht mehr Kreuze zu, als es Antworten gibt', () => {
    const result = pollSchema.safeParse({
      ...EMPTY_POLL,
      title: 'Frage',
      options: ['a', 'b'],
      maxAnswers: 3,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Mehr Kreuze als Antworten/);
    }
  });

  it('nimmt eine gültige Umfrage an', () => {
    expect(
      pollSchema.safeParse({ ...EMPTY_POLL, title: 'Frage', options: ['a', 'b'], maxAnswers: 2 })
        .success,
    ).toBe(true);
  });

  it('hält die Hilfetexte des TT-Planers wörtlich vor', () => {
    expect(POLL_TYPE_HELP.vote).toMatch(/einer oder mehreren Antwortmöglichkeiten/);
    expect(POLL_TYPE_HELP.persons).toMatch(/Personen hinterlegen können/);
    expect(TARGET_HINT).toMatch(/gesamten Verein/);
  });
});

describe('isExpired', () => {
  it('erkennt ein vergangenes Ablaufdatum', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(isExpired({ expires_at: '2026-10-09T12:00:00Z' }, now)).toBe(true);
    expect(isExpired({ expires_at: '2026-10-11T12:00:00Z' }, now)).toBe(false);
  });

  it('nennt eine Umfrage ohne Datum nie abgelaufen', () => {
    expect(isExpired({ expires_at: null })).toBe(false);
  });
});

describe('resultBars', () => {
  const rows = [
    { option_id: 'b', text: 'B', position: 1, votes: 4 },
    { option_id: 'a', text: 'A', position: 0, votes: 1 },
    { option_id: 'c', text: 'C', position: 2, votes: 0 },
  ];

  it('sortiert nach der Reihenfolge der Antworten', () => {
    expect(resultBars(rows).map((bar) => bar.text)).toEqual(['A', 'B', 'C']);
  });

  it('misst am stärksten Balken, nicht an der Summe', () => {
    // Bei Mehrfachauswahl übersteigt die Summe die Zahl der Abstimmenden.
    const bars = resultBars(rows);
    expect(bars.find((bar) => bar.text === 'B')?.percent).toBe(100);
    expect(bars.find((bar) => bar.text === 'A')?.percent).toBe(25);
    expect(bars.find((bar) => bar.text === 'C')?.percent).toBe(0);
  });

  it('kommt ohne Stimmen zurecht', () => {
    const bars = resultBars([{ option_id: 'a', text: 'A', position: 0, votes: 0 }]);
    expect(bars[0].percent).toBe(0);
  });
});

// ------------------------------------------------------------------ Seite

describe('PollsPage', () => {
  it('trennt offene und abgelaufene Umfragen', async () => {
    renderPage();

    expect(await screen.findByRole('tab', { name: 'Offene Umfragen (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Abgelaufene (1)' })).toBeInTheDocument();
  });

  it('zeigt Antworten mit Stimmenzahl', async () => {
    renderPage();

    expect(await screen.findByText('Termin für die Weihnachtsfeier')).toBeInTheDocument();
    expect(screen.getByText('4 Stimmen')).toBeInTheDocument();
    expect(screen.getByText('1 Stimme')).toBeInTheDocument();
  });

  it('nennt die Grenze bei Mehrfachauswahl', async () => {
    renderPage();
    expect(await screen.findByText('Bis zu 2 Antworten wählbar.')).toBeInTheDocument();
  });

  it('speichert die Stimme über die Datenbankfunktion', async () => {
    renderPage();
    await screen.findByText('Termin für die Weihnachtsfeier');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Freitag, 12.12.' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stimme abgeben' }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_vote_poll',
        args: { p_option_ids: ['o-1'] },
      }),
    );
  });

  it('lässt nicht mehr Kreuze zu als erlaubt', async () => {
    renderPage();
    await screen.findByText('Termin für die Weihnachtsfeier');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Freitag, 12.12.' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Samstag, 13.12.' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Freitag, 19.12.' }));

    expect(screen.getByRole('checkbox', { name: 'Freitag, 19.12.' })).not.toBeChecked();
  });

  it('meldet, wenn die Umfrage abgelaufen ist', async () => {
    state.rpcResult = { status: 'expired' };
    renderPage();
    await screen.findByText('Termin für die Weihnachtsfeier');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Freitag, 12.12.' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stimme abgeben' }));

    expect(await screen.findByText('Diese Umfrage ist abgelaufen.')).toBeInTheDocument();
  });

  it('nennt beim Typ „Personen“ die Namen', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'Abgelaufene (1)' }));

    expect(await screen.findByText('Wer hilft beim Aufbau?')).toBeInTheDocument();
    expect(screen.getByText('Spieler 02')).toBeInTheDocument();
  });

  it('sperrt eine abgelaufene Umfrage', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('tab', { name: 'Abgelaufene (1)' }));

    expect(await screen.findByRole('checkbox', { name: 'Ich helfe beim Aufbau' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Stimme abgeben' })).toBeNull();
  });

  it('warnt vor dem Löschen, dass die Stimmen mitgehen', async () => {
    renderPage();
    await screen.findByText('Termin für die Weihnachtsfeier');

    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]);

    expect(await screen.findByText(/alle abgegebenen Stimmen/)).toBeInTheDocument();
  });
});
