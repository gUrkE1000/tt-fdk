import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/*
  Schlüsseldienst (KeyDutyPanel): feste Wochentage vergibt der Administrator, einen
  einzelnen Tag tragen Administrator und Schlüsseldienst ein. Zur Auswahl stehen alle
  aktiven Mitglieder, per Suche.
*/

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  role: 'admin' as string,
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
    },
    role: state.role,
    loading: false,
    previousLoginAt: null,
  }),
}));

import KeyDutyPanel from '../../src/features/keys/KeyDutyPanel';
import { ToastProvider } from '../../src/components/ui';

const member = (id: string, name: string, status = 'active') => ({
  id,
  full_name: name,
  status,
  role: 'member',
});

function renderPanel(props: React.ComponentProps<typeof KeyDutyPanel> = {}, path = '/?tab=keys') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <KeyDutyPanel {...props} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.role = 'admin';
  state.upserts = [];
  state.deletes = [];
  state.rpcs = [];
  state.tables = {
    profiles: [
      member('p-lena', 'Lena Lang'),
      member('p-karl', 'Karl Klein'),
      member('p-otto', 'Otto Ohne'),
      member('p-paul', 'Paul Passiv', 'inactive'),
    ],
    key_duty_weekdays: [{ weekday: 1, profile_id: 'p-karl' }],
    v_key_duty_days: [
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
      {
        duty_date: '2026-10-16',
        weekday: 5,
        profile_id: null,
        full_name: null,
        is_override: false,
        regular_id: null,
      },
    ],
  };
});

/** Öffnet die Suchauswahl, sucht und wählt den Eintrag. */
async function choose(label: string, search: string, option: string) {
  await userEvent.click(await screen.findByRole('button', { name: label }));
  await userEvent.type(screen.getByLabelText('Suchen'), search);
  await userEvent.click(screen.getByRole('button', { name: option }));
}

describe('KeyDutyPanel', () => {
  it('lässt den Administrator die festen Wochentage an alle aktiven Mitglieder vergeben', async () => {
    renderPanel({ editWeekdays: true });

    const monday = await screen.findByRole('button', { name: 'Schlüsseldienst Montag' });
    await waitFor(() => expect(monday).toHaveTextContent('Karl Klein'));

    await userEvent.click(monday);
    const names = screen.getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['niemand', 'Karl Klein', 'Lena Lang', 'Otto Ohne']);
    await userEvent.keyboard('{Escape}');

    await choose('Schlüsseldienst Dienstag', 'ott', 'Otto Ohne');
    await waitFor(() =>
      expect(state.upserts).toContainEqual({
        table: 'key_duty_weekdays',
        values: expect.objectContaining({ weekday: 2, profile_id: 'p-otto' }),
      }),
    );

    await choose('Schlüsseldienst Montag', 'nie', 'niemand');
    await waitFor(() =>
      expect(state.deletes).toContainEqual({ table: 'key_duty_weekdays', filter: { weekday: 1 } }),
    );
  });

  it('findet per Suche nur passende Mitglieder', async () => {
    renderPanel({ editWeekdays: true });

    await userEvent.click(await screen.findByRole('button', { name: 'Schlüsseldienst Montag' }));
    await userEvent.type(screen.getByLabelText('Suchen'), 'lang');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Lena Lang',
    ]);
  });

  it('zeigt die Vertretung und trägt eine neue für genau den einen Tag ein', async () => {
    renderPanel();

    expect(await screen.findByText('Vertretung für Karl Klein')).toBeInTheDocument();

    await choose('Schlüsseldienst am 05.10.2026', 'otto', 'Otto Ohne');
    await waitFor(() =>
      expect(state.rpcs).toContainEqual({
        name: 'rpc_set_key_duty_override',
        args: { p_date: '2026-10-05', p_profile_id: 'p-otto' },
      }),
    );
  });

  it('nimmt die Vertretung zurück, wenn wieder der feste Inhaber gewählt wird', async () => {
    renderPanel();

    await choose('Schlüsseldienst am 12.10.2026', 'karl', 'Karl Klein');
    await waitFor(() =>
      expect(state.rpcs).toContainEqual({
        name: 'rpc_set_key_duty_override',
        args: { p_date: '2026-10-12', p_profile_id: null },
      }),
    );
  });

  it('trägt jemanden an einem Hallentag ohne festen Schlüsseldienst ein', async () => {
    renderPanel();

    const friday = await screen.findByRole('button', { name: 'Schlüsseldienst am 16.10.2026' });
    expect(friday).toHaveTextContent('niemand');
    await choose('Schlüsseldienst am 16.10.2026', 'lena', 'Lena Lang');
    await waitFor(() =>
      expect(state.rpcs).toContainEqual({
        name: 'rpc_set_key_duty_override',
        args: { p_date: '2026-10-16', p_profile_id: 'p-lena' },
      }),
    );
  });

  it('trägt einen einzelnen anderen Tag ein', async () => {
    renderPanel();

    const eintragen = await screen.findByRole('button', { name: 'Eintragen' });
    expect(eintragen).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Tag'), '2026-11-21');
    await choose('Schlüsseldienst am anderen Tag', 'otto', 'Otto Ohne');
    await userEvent.click(eintragen);
    await waitFor(() =>
      expect(state.rpcs).toContainEqual({
        name: 'rpc_set_key_duty_override',
        args: { p_date: '2026-11-21', p_profile_id: 'p-otto' },
      }),
    );
  });

  it('hebt den Tag hervor, mit dem man von der Trainingsseite kommt', async () => {
    renderPanel({}, '/?tab=keys&date=2026-10-12');

    const button = await screen.findByRole('button', { name: 'Schlüsseldienst am 12.10.2026' });
    expect(button.closest('li')).toHaveClass('bg-primary-soft');
    expect(
      screen.getByRole('button', { name: 'Schlüsseldienst am 05.10.2026' }).closest('li'),
    ).not.toHaveClass('bg-primary-soft');
  });

  it('zeigt einem Mitglied ohne Schlüsseldienst den Plan nur zum Lesen', async () => {
    state.role = 'member';
    renderPanel();

    expect(await screen.findByText('Lena Lang')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Schlüsseldienst/ })).toBeNull();
    expect(screen.queryByText('Anderer Tag')).toBeNull();
  });

  it('lässt wer einen festen Wochentag hat Vertretungen eintragen', async () => {
    state.role = 'member';
    state.tables.key_duty_weekdays = [{ weekday: 1, profile_id: 'p-me' }];
    renderPanel();

    expect(
      await screen.findByRole('button', { name: 'Schlüsseldienst am 05.10.2026' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schlüsseldienst Montag' })).toBeNull();
  });

  it('lässt die eingeteilte Vertretung ihren Tag weitergeben', async () => {
    state.role = 'member';
    state.tables.key_duty_weekdays = [];
    state.tables.v_key_duty_days[1] = {
      ...state.tables.v_key_duty_days[1],
      profile_id: 'p-me',
      full_name: 'Ich Selbst',
    };
    renderPanel();

    expect(
      await screen.findByRole('button', { name: 'Schlüsseldienst am 12.10.2026' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schlüsseldienst am 05.10.2026' })).toBeNull();
  });
});
