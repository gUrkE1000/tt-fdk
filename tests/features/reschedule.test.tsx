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
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    eq: () => chain,
    is: () => chain,
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
      return Promise.resolve({ data: { status: 'ok' }, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

const profile = { id: 'p-me', full_name: 'Meik Mannschaft', role: 'team_leader', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({ session: null, profile, role: 'team_leader', loading: false, previousLoginAt: null }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import RescheduleDialog from '../../src/features/matches/RescheduleDialog';
import RescheduleVotePanel from '../../src/features/matches/RescheduleVotePanel';
import { ToastProvider } from '../../src/components/ui';
import {
  myVotes,
  pollFor,
  type ReschedulePoll,
  type RescheduleVote,
} from '../../src/features/matches/rescheduleApi';
import type { MatchRow } from '../../src/features/matches/api';

const match = {
  id: 'm-1',
  team_id: 't-1',
  opponent: 'TTC Nachbarstadt',
  dtstart: '2026-10-05T17:00:00Z',
  dtend: '2026-10-05T21:00:00Z',
  dtstart_external: '2026-10-05T17:00:00Z',
  required_players: 4,
  version: 1,
  active: true,
  is_home: true,
  confirmedCount: 0,
} as unknown as MatchRow;

const OPTION_A = '2026-10-12T17:00:00Z';
const OPTION_B = '2026-10-19T17:00:00Z';

function poll(overrides: Partial<ReschedulePoll> = {}): ReschedulePoll {
  return {
    id: 'poll-1',
    match_id: 'm-1',
    initiated_by: 'p-me',
    options: [OPTION_A, OPTION_B],
    status: 'open',
    chosen_index: null,
    created_at: '2026-09-20T10:00:00Z',
    closed_at: null,
    ...overrides,
  } as ReschedulePoll;
}

function renderWith(ui: React.ReactElement) {
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
  state.tables = {};
  state.rpcCalls = [];
});

// ------------------------------------------------------------------ reine Logik

describe('pollFor', () => {
  it('bevorzugt die laufende Umfrage', () => {
    const rows = [poll({ id: 'alt', status: 'applied' }), poll({ id: 'neu', status: 'open' })];
    expect(pollFor(rows, 'm-1')?.id).toBe('neu');
  });

  it('nimmt sonst die jüngste', () => {
    const rows = [poll({ id: 'alt', status: 'applied' })];
    expect(pollFor(rows, 'm-1')?.id).toBe('alt');
  });

  it('gibt nichts zurück, wenn es zu diesem Spiel keine gibt', () => {
    expect(pollFor([poll({ match_id: 'm-2' })], 'm-1')).toBeNull();
  });
});

describe('myVotes', () => {
  const votes = [
    { poll_id: 'poll-1', profile_id: 'p-me', option_index: 0, available: true },
    { poll_id: 'poll-1', profile_id: 'p-me', option_index: 1, available: false },
    { poll_id: 'poll-1', profile_id: 'p-andere', option_index: 0, available: true },
  ] as unknown as RescheduleVote[];

  it('liefert nur die eigenen Stimmen', () => {
    expect(myVotes(votes, 'poll-1', 'p-me')).toEqual({ 0: true, 1: false });
  });

  it('liefert nichts ohne Anmeldung', () => {
    expect(myVotes(votes, 'poll-1', null)).toEqual({});
  });
});

// ------------------------------------------------------------------ Dialog

describe('RescheduleDialog', () => {
  it('nennt den bisherigen Termin', () => {
    renderWith(<RescheduleDialog open onOpenChange={() => {}} match={match} />);
    expect(screen.getByText(/^Bisher:/)).toBeInTheDocument();
  });

  it('erlaubt bis zu drei Vorschläge', async () => {
    renderWith(<RescheduleDialog open onOpenChange={() => {}} match={match} />);

    expect(screen.getByLabelText('Vorschlag 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Weiterer Vorschlag/ }));
    await userEvent.click(screen.getByRole('button', { name: /Weiterer Vorschlag/ }));

    expect(screen.getByLabelText('Vorschlag 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Weiterer Vorschlag/ })).toBeNull();
  });

  it('verlangt mindestens einen Termin', async () => {
    renderWith(<RescheduleDialog open onOpenChange={() => {}} match={match} />);

    await userEvent.click(screen.getByRole('button', { name: /Umfrage jetzt starten/ }));

    expect(await screen.findByText(/mindestens einen Terminvorschlag/)).toBeInTheDocument();
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('startet die Umfrage mit den ausgefüllten Vorschlägen', async () => {
    renderWith(<RescheduleDialog open onOpenChange={() => {}} match={match} />);

    await userEvent.type(screen.getByLabelText('Vorschlag 1'), '2026-10-12');
    await userEvent.click(screen.getByRole('button', { name: /Umfrage jetzt starten/ }));

    await waitFor(() =>
      expect(state.rpcCalls.some((call) => call.name === 'rpc_start_reschedule_poll')).toBe(true),
    );

    const call = state.rpcCalls.find((entry) => entry.name === 'rpc_start_reschedule_poll')!;
    const args = call.args as { p_match_id: string; p_options: string[] };
    expect(args.p_match_id).toBe('m-1');
    expect(args.p_options).toHaveLength(1);
  });

  it('zeigt bei laufender Umfrage das Ergebnis je Vorschlag', async () => {
    state.tables = {
      reschedule_polls: [poll()] as unknown as Row[],
      v_reschedule_results: [
        {
          poll_id: 'poll-1',
          match_id: 'm-1',
          status: 'open',
          chosen_index: null,
          option_index: 0,
          option_at: OPTION_A,
          available_count: 3,
          unavailable_count: 1,
        },
      ],
    };

    renderWith(<RescheduleDialog open onOpenChange={() => {}} match={match} />);

    expect(await screen.findByText('3 können')).toBeInTheDocument();
    expect(screen.getByText('1 können nicht')).toBeInTheDocument();
  });

  it('wendet einen gewählten Termin an', async () => {
    state.tables = {
      reschedule_polls: [poll()] as unknown as Row[],
      v_reschedule_results: [
        {
          poll_id: 'poll-1',
          match_id: 'm-1',
          status: 'open',
          chosen_index: null,
          option_index: 1,
          option_at: OPTION_B,
          available_count: 4,
          unavailable_count: 0,
        },
      ],
    };

    renderWith(<RescheduleDialog open onOpenChange={() => {}} match={match} />);
    await screen.findByText('4 können');

    await userEvent.click(screen.getByRole('button', { name: /Diesen Termin nehmen/ }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_apply_reschedule',
        args: { p_poll_id: 'poll-1', p_option_index: 1 },
      }),
    );
  });

  it('erklärt, dass die Verlegung zunächst nur intern gilt', async () => {
    state.tables = { reschedule_polls: [poll()] as unknown as Row[], v_reschedule_results: [] };
    renderWith(<RescheduleDialog open onOpenChange={() => {}} match={match} />);

    expect(await screen.findByText(/Verband weiß noch nichts davon/)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------ Abstimmen

describe('RescheduleVotePanel', () => {
  it('bleibt still, wenn keine Umfrage läuft', () => {
    state.tables = { reschedule_polls: [] };
    const { container } = renderWith(<RescheduleVotePanel matchId="m-1" />);
    expect(container.textContent).toBe('');
  });

  it('bleibt still, wenn die Umfrage schon angewendet wurde', async () => {
    state.tables = { reschedule_polls: [poll({ status: 'applied' })] as unknown as Row[] };
    const { container } = renderWith(<RescheduleVotePanel matchId="m-1" />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('bietet je Vorschlag zwei Knöpfe', async () => {
    state.tables = { reschedule_polls: [poll()] as unknown as Row[], reschedule_votes: [] };
    renderWith(<RescheduleVotePanel matchId="m-1" />);

    expect(await screen.findByText(/Wann kannst du/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Kann ich' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Kann ich nicht' })).toHaveLength(2);
  });

  it('speichert eine Stimme', async () => {
    state.tables = { reschedule_polls: [poll()] as unknown as Row[], reschedule_votes: [] };
    renderWith(<RescheduleVotePanel matchId="m-1" />);
    await screen.findByText(/Wann kannst du/);

    await userEvent.click(screen.getAllByRole('button', { name: 'Kann ich' })[1]);

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_vote_reschedule',
        args: { p_poll_id: 'poll-1', p_option_index: 1, p_available: true },
      }),
    );
  });

  it('zeigt die eigene Stimme als gedrückt', async () => {
    state.tables = {
      reschedule_polls: [poll()] as unknown as Row[],
      reschedule_votes: [
        { poll_id: 'poll-1', profile_id: 'p-me', option_index: 0, available: true },
      ],
    };

    renderWith(<RescheduleVotePanel matchId="m-1" />);
    await screen.findByText(/Wann kannst du/);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Kann ich' })[0]).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(screen.getAllByRole('button', { name: 'Kann ich' })[1]).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
