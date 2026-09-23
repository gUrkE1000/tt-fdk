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
      return Promise.resolve({ data: state.rpcResult, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

const profile = { id: 'p-me', full_name: 'Theo Trainer', role: 'member', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({ session: null, profile, role: 'member', loading: false, previousLoginAt: null }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ChainStepper from '../../src/features/substitutes/ChainStepper';
import SubstituteBanner from '../../src/features/substitutes/SubstituteBanner';
import { ToastProvider } from '../../src/components/ui';
import {
  chainFor,
  pendingForMe,
  type SubstituteRequest,
} from '../../src/features/substitutes/api';

const future = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
const past = new Date(Date.now() - 3600_000).toISOString();

function request(overrides: Partial<SubstituteRequest> & { id: string }): SubstituteRequest {
  return {
    match_id: 'm-1',
    match_version: 1,
    profile_id: 'p-1',
    rank: 1,
    status: 'pending',
    created_by: 'system',
    requested_at: '2026-10-01T10:00:00Z',
    expires_at: future,
    answered_at: null,
    full_name: 'Theo Trainer',
    current_version: true,
    ...overrides,
  } as SubstituteRequest;
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
  state.rpcResult = { status: 'ok' };
});

// ------------------------------------------------------------------ reine Logik

describe('pendingForMe', () => {
  const rows = [
    request({ id: 'r-1', profile_id: 'p-me' }),
    request({ id: 'r-2', profile_id: 'p-andere' }),
    request({ id: 'r-3', profile_id: 'p-me', status: 'declined' }),
    request({ id: 'r-4', profile_id: 'p-me', expires_at: past }),
    request({ id: 'r-5', profile_id: 'p-me', current_version: false }),
  ];

  it('zeigt nur offene Anfragen an mich', () => {
    expect(pendingForMe(rows, 'p-me').map((entry) => entry.id)).toEqual(['r-1']);
  });

  it('zeigt nichts, solange niemand angemeldet ist', () => {
    expect(pendingForMe(rows, null)).toEqual([]);
  });
});

describe('chainFor', () => {
  it('sortiert nach Rang', () => {
    const rows = [
      request({ id: 'r-2', rank: 2 }),
      request({ id: 'r-1', rank: 1 }),
      request({ id: 'r-3', rank: 3 }),
    ];

    expect(chainFor(rows, 'm-1').map((entry) => entry.id)).toEqual(['r-1', 'r-2', 'r-3']);
  });

  it('übergeht Anfragen zu einer überholten Fassung', () => {
    const rows = [request({ id: 'r-1' }), request({ id: 'r-2', current_version: false })];
    expect(chainFor(rows, 'm-1').map((entry) => entry.id)).toEqual(['r-1']);
  });

  it('übergeht Anfragen zu einem anderen Spiel', () => {
    const rows = [request({ id: 'r-1' }), request({ id: 'r-2', match_id: 'm-2' })];
    expect(chainFor(rows, 'm-1')).toHaveLength(1);
  });

  it('sortiert gleichrangige nach dem Zeitpunkt der Anfrage', () => {
    const rows = [
      request({ id: 'spaet', rank: null, requested_at: '2026-10-02T10:00:00Z' }),
      request({ id: 'frueh', rank: null, requested_at: '2026-10-01T10:00:00Z' }),
    ];

    expect(chainFor(rows, 'm-1').map((entry) => entry.id)).toEqual(['frueh', 'spaet']);
  });
});

// ------------------------------------------------------------------ Schrittleiste

describe('ChainStepper', () => {
  it('erklärt, wenn noch niemand gefragt wurde', () => {
    renderWith(<ChainStepper matchId="m-1" requests={[]} onAskSomeone={() => {}} />);
    expect(screen.getByText(/Noch niemand angefragt/)).toBeInTheDocument();
  });

  it('zeigt jede Anfrage mit Rang, Namen und Status', () => {
    renderWith(
      <ChainStepper
        matchId="m-1"
        requests={[
          request({ id: 'r-1', rank: 1, full_name: 'Theo Trainer' }),
          request({ id: 'r-2', rank: 2, full_name: 'Olaf Organisator', status: 'declined' }),
        ]}
        onAskSomeone={() => {}}
      />,
    );

    expect(screen.getByText('Theo Trainer')).toBeInTheDocument();
    expect(screen.getByText('wartet')).toBeInTheDocument();
    expect(screen.getByText('abgesagt')).toBeInTheDocument();
  });

  it('nennt die Frist einer offenen Anfrage', () => {
    renderWith(
      <ChainStepper matchId="m-1" requests={[request({ id: 'r-1' })]} onAskSomeone={() => {}} />,
    );

    expect(screen.getByText(/^Frist:/)).toBeInTheDocument();
  });

  it('kennzeichnet eine von Hand gestellte Anfrage', () => {
    renderWith(
      <ChainStepper
        matchId="m-1"
        requests={[request({ id: 'r-1', created_by: 'leader' })]}
        onAskSomeone={() => {}}
      />,
    );

    expect(screen.getByText('von Hand')).toBeInTheDocument();
  });

  it('bietet das Zurückziehen nur für offene Anfragen an', () => {
    renderWith(
      <ChainStepper
        matchId="m-1"
        requests={[
          request({ id: 'r-1', full_name: 'Theo Trainer' }),
          request({ id: 'r-2', rank: 2, full_name: 'Olaf Organisator', status: 'accepted' }),
        ]}
        onAskSomeone={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Anfrage an Theo Trainer zurückziehen/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Anfrage an Olaf Organisator zurückziehen/ }),
    ).toBeNull();
  });

  it('zieht eine Anfrage zurück', async () => {
    renderWith(
      <ChainStepper matchId="m-1" requests={[request({ id: 'r-1' })]} onAskSomeone={() => {}} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /zurückziehen/ }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_cancel_substitute_request',
        args: { p_request_id: 'r-1' },
      }),
    );
  });
});

// ------------------------------------------------------------------ Banner

describe('SubstituteBanner', () => {
  it('bleibt still, wenn es nichts zu beantworten gibt', () => {
    state.tables = { v_substitute_requests: [] };
    const { container } = renderWith(<SubstituteBanner describe={() => 'Ein Spiel'} />);
    expect(container.textContent).toBe('');
  });

  it('fragt bei einer offenen Anfrage nach', async () => {
    state.tables = {
      v_substitute_requests: [request({ id: 'r-1', profile_id: 'p-me' })] as unknown as Row[],
    };

    renderWith(<SubstituteBanner describe={() => '1. Herren gegen TTC Nachbarstadt'} />);

    expect(await screen.findByText('Kannst du Ersatz spielen?')).toBeInTheDocument();
    expect(screen.getByText('1. Herren gegen TTC Nachbarstadt')).toBeInTheDocument();
    expect(screen.getByText(/Bitte antworte bis/)).toBeInTheDocument();
  });

  it('speichert eine Zusage', async () => {
    state.tables = {
      v_substitute_requests: [request({ id: 'r-1', profile_id: 'p-me' })] as unknown as Row[],
    };

    renderWith(<SubstituteBanner describe={() => 'Ein Spiel'} />);
    await screen.findByText('Kannst du Ersatz spielen?');

    await userEvent.click(screen.getByRole('button', { name: /Ja, ich spiele/ }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_answer_substitute_request',
        args: { p_request_id: 'r-1', p_answer: 'yes' },
      }),
    );
    expect(await screen.findByText('Danke, du bist dabei')).toBeInTheDocument();
  });

  it('erklärt eine abgelaufene Frist', async () => {
    state.tables = {
      v_substitute_requests: [request({ id: 'r-1', profile_id: 'p-me' })] as unknown as Row[],
    };
    state.rpcResult = { status: 'expired' };

    renderWith(<SubstituteBanner describe={() => 'Ein Spiel'} />);
    await screen.findByText('Kannst du Ersatz spielen?');

    await userEvent.click(screen.getByRole('button', { name: /Nein, geht nicht/ }));

    expect(await screen.findByText(/Frist für diese Anfrage ist abgelaufen/)).toBeInTheDocument();
  });

  it('erklärt einen inzwischen verlegten Termin', async () => {
    state.tables = {
      v_substitute_requests: [request({ id: 'r-1', profile_id: 'p-me' })] as unknown as Row[],
    };
    state.rpcResult = { status: 'stale' };

    renderWith(<SubstituteBanner describe={() => 'Ein Spiel'} />);
    await screen.findByText('Kannst du Ersatz spielen?');

    await userEvent.click(screen.getByRole('button', { name: /Ja, ich spiele/ }));

    expect(await screen.findByText(/Termin hat sich geändert/)).toBeInTheDocument();
  });
});
