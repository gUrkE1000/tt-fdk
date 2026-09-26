import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
  Schlüsseldienst (KeyDutyPanel): feste Wochentage vergibt der Administrator, eine
  Vertretung für einen Tag tragen Administrator und Schlüsseldienst ein.
*/

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  role: 'admin' as string,
  keyService: false,
  tables: {} as Record<string, Row[]>,
  upserts: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; filter: unknown }[],
  rpcs: [] as { name: string; args: unknown }[],
}));

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    gte: () => chain,
    range: () => chain,
    eq: (column: string, value: unknown) => {
      if (pendingDelete) state.deletes.push({ table, filter: { [column]: value } });
      return chain;
    },
    upsert: (values: unknown) => {
      state.upserts.push({ table, values });
      return Promise.resolve({ error: null });
    },
    delete: () => {
      pendingDelete = true;
      return chain;
    },
    then: (resolve: (value: { data: Row[]; error: null; count: number }) => unknown) => {
      const data = state.tables[table] ?? [];
      return resolve({ data, error: null, count: data.length });
    },
  };
  let pendingDelete = false;
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (name: string, args: unknown) => {
      state.rpcs.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: {
      id: 'p-me',
      full_name: 'Ich Selbst',
      role: state.role,
      status: 'active',
      key_service: state.keyService,
    },
    role: state.role,
    loading: false,
    previousLoginAt: null,
  }),
}));

import KeyDutyPanel from '../../src/features/keys/KeyDutyPanel';
import { ToastProvider } from '../../src/components/ui';

const member = (id: string, name: string, keyService: boolean) => ({
  id,
  full_name: name,
  status: 'active',
  role: 'member',
  key_service: keyService,
});

function renderPanel(props: React.ComponentProps<typeof KeyDutyPanel> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <KeyDutyPanel {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.role = 'admin';
  state.keyService = false;
  state.upserts = [];
  state.deletes = [];
  state.rpcs = [];
  state.tables = {
    profiles: [
      member('p-karl', 'Karl Klein', true),
      member('p-lena', 'Lena Lang', true),
      member('p-otto', 'Otto Ohne', false),
    ],
    key_duty_weekdays: [{ weekday: 1, profile_id: 'p-karl' }],
    v_key_duty_dates: [
      {
        duty_date: '2026-10-05',
        weekday: 1,
        profile_id: 'p-karl',
        full_name: 'Karl Klein',
        is_override: false,
        regular_id: 'p-karl',
      },
      {
        duty_date: '2026-10-12',
        weekday: 1,
        profile_id: 'p-lena',
        full_name: 'Lena Lang',
        is_override: true,
        regular_id: 'p-karl',
      },
    ],
  };
});

describe('KeyDutyPanel', () => {
  it('lässt den Administrator die festen Wochentage vergeben — nur an den Schlüsseldienst', async () => {
    renderPanel({ editWeekdays: true });

    const monday = await screen.findByLabelText('Schlüsseldienst Montag');
    await waitFor(() => expect(monday).toHaveValue('p-karl'));
    const names = Array.from((monday as HTMLSelectElement).options).map((option) => option.text);
    expect(names).toEqual(['niemand', 'Karl Klein', 'Lena Lang']);

    await userEvent.selectOptions(screen.getByLabelText('Schlüsseldienst Dienstag'), 'p-lena');
    await waitFor(() =>
      expect(state.upserts).toContainEqual({
        table: 'key_duty_weekdays',
        values: expect.objectContaining({ weekday: 2, profile_id: 'p-lena' }),
      }),
    );

    await userEvent.selectOptions(monday, '');
    await waitFor(() =>
      expect(state.deletes).toContainEqual({ table: 'key_duty_weekdays', filter: { weekday: 1 } }),
    );
  });

  it('zeigt die Vertretung und trägt eine neue für genau den einen Tag ein', async () => {
    renderPanel();

    expect(await screen.findByText('Vertretung für Karl Klein')).toBeInTheDocument();

    await userEvent.selectOptions(
      await screen.findByLabelText('Schlüsseldienst am 05.10.2026'),
      'p-lena',
    );
    await waitFor(() =>
      expect(state.rpcs).toContainEqual({
        name: 'rpc_set_key_duty_override',
        args: { p_date: '2026-10-05', p_profile_id: 'p-lena' },
      }),
    );
  });

  it('nimmt die Vertretung zurück, wenn wieder der feste Inhaber gewählt wird', async () => {
    renderPanel();

    await userEvent.selectOptions(
      await screen.findByLabelText('Schlüsseldienst am 12.10.2026'),
      'p-karl',
    );
    await waitFor(() =>
      expect(state.rpcs).toContainEqual({
        name: 'rpc_set_key_duty_override',
        args: { p_date: '2026-10-12', p_profile_id: null },
      }),
    );
  });

  it('zeigt einem Mitglied ohne Schlüsseldienst den Plan nur zum Lesen', async () => {
    state.role = 'member';
    renderPanel();

    expect(await screen.findByText('Lena Lang')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('lässt den Schlüsseldienst selbst Vertretungen eintragen', async () => {
    state.role = 'member';
    state.keyService = true;
    renderPanel();

    expect(await screen.findByLabelText('Schlüsseldienst am 05.10.2026')).toBeInTheDocument();
    expect(screen.queryByLabelText('Schlüsseldienst Montag')).toBeNull();
  });

  it('erklärt, was zu tun ist, solange niemand Schlüsseldienst hat', async () => {
    state.tables.profiles = [member('p-otto', 'Otto Ohne', false)];
    renderPanel({ editWeekdays: true });

    expect(await screen.findByText('Noch niemand hat Schlüsseldienst')).toBeInTheDocument();
    expect(screen.getByText(/Setze bei den Mitgliedern das Kennzeichen/)).toBeInTheDocument();
  });
});
