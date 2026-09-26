import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { SessionKeys } from '../../src/features/keys/api';
import type { MemberSummary } from '../../src/features/members/api';
import type { TrainingSession, TrainingWithPeople } from '../../src/features/trainings/api';

// ---------------------------------------------------------------- Attrappen

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  rpcCalls: [] as { name: string; args: unknown }[],
  profileId: 'p-me',
  role: 'member',
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
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
      return Promise.resolve({ data: null, error: null });
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
    profile: { id: state.profileId, full_name: 'Ich', status: 'active' },
    role: state.role,
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import KeyBearerRow, { bearerOptions } from '../../src/features/trainings/KeyBearerRow';
import { ToastProvider } from '../../src/components/ui';

const inTwoDays = new Date(Date.now() + 2 * 86_400_000);

const session = {
  id: 's-1',
  training_id: 't-1',
  starts_at: inTwoDays.toISOString(),
  ends_at: new Date(inTwoDays.getTime() + 2 * 3600_000).toISOString(),
  cancelled: false,
} as unknown as TrainingSession;

const training = {
  id: 't-1',
  venue_id: 'v-1',
  trainerIds: ['p-trainer'],
} as unknown as TrainingWithPeople;

function sessionKeys(extra: Partial<SessionKeys> = {}): SessionKeys {
  return {
    session_id: 's-1',
    has_bearer: false,
    bearer_id: null,
    bearer_name: null,
    duty_id: null,
    duty_name: null,
    ...extra,
  } as SessionKeys;
}

function renderRow(keys: SessionKeys, sessionOverride: Partial<TrainingSession> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <KeyBearerRow
          session={{ ...session, ...sessionOverride }}
          training={training}
          keys={keys}
          profileId={state.profileId}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.rpcCalls = [];
  state.profileId = 'p-me';
  state.role = 'member';
  state.tables = {
    profiles: [
      { id: 'p-me', full_name: 'Ich', status: 'active', deleted_at: null },
      { id: 'p-anna', full_name: 'Anna', status: 'active', deleted_at: null, key_service: true },
      { id: 'p-zora', full_name: 'Zora', status: 'active', deleted_at: null },
    ],
  };
});

// ---------------------------------------------------------------- reine Logik

describe('bearerOptions', () => {
  it('stellt den Schlüsseldienst voran und lässt Inaktive weg', () => {
    const members = [
      { id: 'p-z', full_name: 'Zora', status: 'active', deleted_at: null, key_service: true },
      { id: 'p-b', full_name: 'Bert', status: 'active', deleted_at: null },
      { id: 'p-a', full_name: 'Anna', status: 'active', deleted_at: null },
      { id: 'p-x', full_name: 'Xaver', status: 'pending_approval', deleted_at: null },
    ] as MemberSummary[];
    expect(bearerOptions(members)).toEqual([
      { value: 'p-z', label: 'Zora · Schlüsseldienst' },
      { value: 'p-a', label: 'Anna' },
      { value: 'p-b', label: 'Bert' },
    ]);
  });
});

// ---------------------------------------------------------------- Oberfläche

describe('KeyBearerRow', () => {
  it('zeigt, dass noch niemand den Schlüssel bringt', async () => {
    renderRow(sessionKeys());
    expect(await screen.findByText('Noch niemand bringt den Schlüssel.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jemanden eintragen/ })).toBeNull();
  });

  it('trägt einen selbst ein', async () => {
    renderRow(sessionKeys());
    await userEvent.click(await screen.findByRole('button', { name: /Ich bringe den Schlüssel/ }));
    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_set_session_key_bearer',
        args: { p_session_id: 's-1', p_profile_id: 'p-me' },
      }),
    );
  });

  it('lässt einen sich wieder austragen', async () => {
    renderRow(sessionKeys({ has_bearer: true, bearer_id: 'p-me', bearer_name: 'Ich' }));
    expect(screen.getByText('Du bringst den Schlüssel.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Doch nicht' }));
    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_set_session_key_bearer',
        args: { p_session_id: 's-1', p_profile_id: null },
      }),
    );
  });

  it('zeigt einem Mitglied den Eingetragenen ohne Knöpfe', () => {
    renderRow(sessionKeys({ has_bearer: true, bearer_id: 'p-anna', bearer_name: 'Anna' }));
    expect(screen.getByText('Schlüssel bringt: Anna')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('verrät bei Inkognito keinen Namen', () => {
    renderRow(sessionKeys({ has_bearer: true }));
    expect(screen.getByText('Schlüssel bringt: jemand ist eingetragen')).toBeInTheDocument();
  });

  it('lässt den Trainer jemanden eintragen', async () => {
    state.profileId = 'p-trainer';
    renderRow(sessionKeys());
    await userEvent.click(await screen.findByRole('button', { name: /Jemanden eintragen/ }));
    const select = await screen.findByRole('combobox', { name: 'Wer bringt den Schlüssel?' });
    await screen.findByRole('option', { name: 'Anna · Schlüsseldienst' });
    await userEvent.selectOptions(select, 'p-zora');
    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_set_session_key_bearer',
        args: { p_session_id: 's-1', p_profile_id: 'p-zora' },
      }),
    );
  });

  it('lässt den Admin einen Eintrag ändern und austragen', async () => {
    state.role = 'admin';
    renderRow(sessionKeys({ has_bearer: true, bearer_id: 'p-anna', bearer_name: 'Anna' }));
    expect(screen.getByRole('button', { name: 'Ändern' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Austragen' }));
    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_set_session_key_bearer',
        args: { p_session_id: 's-1', p_profile_id: null },
      }),
    );
  });

  it('bleibt bei einem ausgefallenen Termin weg', () => {
    renderRow(sessionKeys(), { cancelled: true });
    expect(screen.queryByText(/Schlüssel/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('bietet bei einem vergangenen Termin nichts mehr an', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    renderRow(sessionKeys(), { starts_at: past, ends_at: past });
    expect(screen.getByText('Niemand war für den Schlüssel eingetragen.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
