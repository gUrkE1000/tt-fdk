import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { holderText, toKeyRow, keySchema, EMPTY_KEY } from '../../src/features/keys/schemas';
import {
  assignmentText,
  memberAssignments,
} from '../../src/features/club/assignments';

// ---------------------------------------------------------------- reine Logik

describe('holderText', () => {
  it('nennt den Inhaber, wenn es einen gibt', () => {
    expect(holderText({ holder_name: 'Spieler 01', responsible_name: 'Anna Admin' })).toBe(
      'Spieler 01',
    );
  });

  it('nennt sonst den Verantwortlichen — dort liegt er per Definition', () => {
    expect(holderText({ holder_name: null, responsible_name: 'Anna Admin' })).toBe(
      'Anna Admin (verantwortlich)',
    );
  });

  it('gibt zu, wenn niemand eingetragen ist', () => {
    expect(holderText({ holder_name: null, responsible_name: null })).toBe('niemand eingetragen');
  });
});

describe('toKeyRow', () => {
  it('macht aus dem leeren Auswahlfeld ein NULL', () => {
    // '' wäre keine gültige Kennung — die Datenbank lehnte den Fremdschlüssel ab.
    const row = toKeyRow({ ...EMPTY_KEY, name: ' Hallenschlüssel ', responsible_id: 'p-1' });
    expect(row.venue_id).toBeNull();
    expect(row.name).toBe('Hallenschlüssel');
  });
});

describe('keySchema', () => {
  it('verlangt Name und Verantwortlichen', () => {
    expect(keySchema.safeParse(EMPTY_KEY).success).toBe(false);
    expect(
      keySchema.safeParse({ ...EMPTY_KEY, name: 'Schlüssel', responsible_id: 'p-1' }).success,
    ).toBe(true);
  });

  it('lässt den Ort leer', () => {
    const result = keySchema.safeParse({
      ...EMPTY_KEY,
      name: 'Schrankschlüssel',
      responsible_id: 'p-1',
      venue_id: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('memberAssignments', () => {
  const map = memberAssignments({
    trainings: [
      { name: 'Erwachsenentraining', memberIds: ['p-1', 'p-2'] },
      { name: 'Jugendtraining', memberIds: ['p-2'] },
    ],
    teams: [
      { name: '1. Herren', regularIds: ['p-1'], substituteIds: ['p-2'] },
      { name: '2. Herren', regularIds: [], substituteIds: ['p-2'] },
    ],
    keys: [
      { name: 'Hallenschlüssel', holder_id: 'p-1' },
      { name: 'Schrankschlüssel', holder_id: null },
    ],
  });

  it('sammelt die Trainings je Mitglied', () => {
    expect(map.get('p-2')?.trainings).toEqual(['Erwachsenentraining', 'Jugendtraining']);
  });

  it('trennt Kader und Ersatz', () => {
    expect(map.get('p-1')?.teams).toEqual(['1. Herren']);
    expect(map.get('p-2')?.substituteFor).toEqual(['1. Herren', '2. Herren']);
    expect(map.get('p-2')?.teams).toEqual([]);
  });

  it('nennt nur Schlüssel, die jemand hat', () => {
    expect(map.get('p-1')?.keys).toEqual(['Hallenschlüssel']);
    expect(map.has('kein-mitglied')).toBe(false);
  });

  it('formatiert leere Listen als Gedankenstrich', () => {
    expect(assignmentText([])).toBe('—');
    expect(assignmentText(['1. Herren', '2. Herren'])).toBe('1. Herren, 2. Herren');
  });
});

// ---------------------------------------------------------------- Oberfläche

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  rpcCalls: [] as { name: string; args: unknown }[],
  rpcResult: { status: 'ok' } as { status: string },
  profileId: 'p-01',
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    limit: () => chain,
    eq: () => chain,
    is: () => chain,
    in: () => chain,
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
  APP_URL: 'https://verein.example.org',
  FUNCTIONS_URL: 'https://verein.example.org/functions/v1',
}));

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: { id: state.profileId, full_name: 'Spieler 01', status: 'active' },
    role: 'member',
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import MyKeysTab from '../../src/features/keys/MyKeysTab';
import { ToastProvider } from '../../src/components/ui';

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MyKeysTab />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.rpcCalls = [];
  state.rpcResult = { status: 'ok' };
  state.profileId = 'p-01';
  state.tables = {
    profiles: [
      { id: 'p-01', full_name: 'Spieler 01', status: 'active' },
      { id: 'p-02', full_name: 'Spieler 02', status: 'active' },
    ],
    key_handovers: [],
    v_keys: [
      {
        id: 'k-1',
        name: 'Hallenschlüssel Sporthalle',
        venue_id: 'v-1',
        venue_name: 'Sporthalle Musterstadt',
        responsible_id: 'p-02',
        responsible_name: 'Spieler 02',
        holder_id: 'p-01',
        holder_name: 'Spieler 01',
        no_forwarding: false,
        active: true,
        may_hand_over: true,
      },
      {
        id: 'k-2',
        name: 'Schlüssel Gymnasium',
        venue_id: 'v-2',
        venue_name: 'Gymnasium Musterstadt',
        responsible_id: 'p-02',
        responsible_name: 'Spieler 02',
        holder_id: 'p-01',
        holder_name: 'Spieler 01',
        no_forwarding: true,
        active: true,
        may_hand_over: false,
      },
      {
        id: 'k-3',
        name: 'Fremder Schlüssel',
        venue_id: null,
        venue_name: null,
        responsible_id: 'p-02',
        responsible_name: 'Spieler 02',
        holder_id: 'p-02',
        holder_name: 'Spieler 02',
        no_forwarding: false,
        active: true,
        may_hand_over: false,
      },
    ],
  };
});

describe('MyKeysTab', () => {
  it('zeigt die Schlüssel, die bei mir liegen', async () => {
    renderTab();
    expect(await screen.findByText('Hallenschlüssel Sporthalle')).toBeInTheDocument();
    expect(screen.getByText('Schlüssel Gymnasium')).toBeInTheDocument();
  });

  it('zeigt fremde Schlüssel nicht', async () => {
    renderTab();
    await screen.findByText('Hallenschlüssel Sporthalle');
    expect(screen.queryByText('Fremder Schlüssel')).toBeNull();
  });

  it('bietet die Übergabe nur an, wo sie erlaubt ist', async () => {
    renderTab();
    await screen.findByText('Hallenschlüssel Sporthalle');

    // Ein Knopf für k-1, keiner für k-2.
    expect(screen.getAllByRole('button', { name: /Schlüssel übergeben/ })).toHaveLength(1);
    expect(screen.getByText(/gibt nur Spieler 02 weiter/)).toBeInTheDocument();
  });

  it('zeigt dem Verantwortlichen, wo sein Schlüssel steckt', async () => {
    state.profileId = 'p-02';
    renderTab();

    expect(await screen.findByText('Fremder Schlüssel')).toBeInTheDocument();
    expect(screen.getAllByText(/Aktuell bei: Spieler 01/).length).toBeGreaterThan(0);
  });

  it('übergibt über die RPC, nicht über ein UPDATE', async () => {
    renderTab();
    await screen.findByText('Hallenschlüssel Sporthalle');

    await userEvent.click(screen.getByRole('button', { name: /Schlüssel übergeben/ }));
    await screen.findByLabelText('Übergeben an');

    await userEvent.selectOptions(screen.getByLabelText('Übergeben an'), 'p-02');
    await userEvent.click(screen.getByRole('button', { name: 'Jetzt übergeben' }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_hand_over_key',
        args: { p_key_id: 'k-1', p_to: 'p-02', p_note: '' },
      }),
    );
  });

  it('gibt „zurück an den Verantwortlichen" als NULL weiter', async () => {
    renderTab();
    await screen.findByText('Hallenschlüssel Sporthalle');

    await userEvent.click(screen.getByRole('button', { name: /Schlüssel übergeben/ }));
    await screen.findByLabelText('Übergeben an');
    await userEvent.click(screen.getByRole('button', { name: 'Jetzt übergeben' }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_hand_over_key',
        args: { p_key_id: 'k-1', p_to: null, p_note: '' },
      }),
    );
  });

  it('erklärt eine abgelehnte Übergabe im Klartext', async () => {
    state.rpcResult = { status: 'not_allowed' };
    renderTab();
    await screen.findByText('Hallenschlüssel Sporthalle');

    await userEvent.click(screen.getByRole('button', { name: /Schlüssel übergeben/ }));
    await screen.findByLabelText('Übergeben an');
    await userEvent.click(screen.getByRole('button', { name: 'Jetzt übergeben' }));

    expect(
      await screen.findByText('Du darfst diesen Schlüssel nicht weitergeben'),
    ).toBeInTheDocument();
  });
});
