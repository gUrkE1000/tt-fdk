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
  upserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown }[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    eq: () => chain,
    upsert: (values: unknown) => {
      state.upserts.push({ table, values });
      return Promise.resolve({ error: null });
    },
    update: (values: unknown) => {
      state.updates.push({ table, values });
      return { eq: () => Promise.resolve({ error: null }) };
    },
    insert: () => ({ then: (r: (v: { error: null }) => unknown) => r({ error: null }) }),
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: state.tables[table] ?? [], error: null }),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

import NotificationsTab from '../../src/features/profile/NotificationsTab';
import { ToastProvider } from '../../src/components/ui';
import { changedPreferences, type PreferenceRow } from '../../src/features/notifications/api';
import type { Profile } from '../../src/features/profile/api';

const profile = {
  id: 'p-1',
  first_name: 'Anna',
  last_name: 'Admin',
  full_name: 'Anna Admin',
  email: 'anna@example.com',
  reminder_games_hours: 48,
  emails_copies: ['eltern@example.com'],
  role: 'member',
  status: 'active',
  deleted_at: null,
} as unknown as Profile;

const preferenceRows = [
  { type: 'match_created', label: 'Neues Mannschaftsspiel angelegt', sort_order: 6, profile_id: 'p-1', email: true, push: true },
  { type: 'match_reminder', label: 'Erinnerung an Spieltermin', sort_order: 8, profile_id: 'p-1', email: false, push: true },
] as unknown as PreferenceRow[];

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <NotificationsTab profile={profile} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = { v_my_notification_preferences: preferenceRows as unknown as Row[] };
  state.upserts = [];
  state.updates = [];
});

// ------------------------------------------------------------------ reine Logik

describe('changedPreferences', () => {
  it('meldet nichts, solange nichts geändert wurde', () => {
    const draft = {
      match_created: { email: true, push: true },
      match_reminder: { email: false, push: true },
    };
    expect(changedPreferences(preferenceRows, draft)).toEqual([]);
  });

  it('meldet nur die geänderten Zeilen', () => {
    const draft = {
      match_created: { email: false, push: true },
      match_reminder: { email: false, push: true },
    };
    expect(changedPreferences(preferenceRows, draft)).toEqual([
      { type: 'match_created', email: false, push: true },
    ]);
  });

  it('übergeht Typen, die im Entwurf fehlen', () => {
    expect(changedPreferences(preferenceRows, {})).toEqual([]);
  });
});

// ------------------------------------------------------------------ Oberfläche

describe('NotificationsTab', () => {
  it('zeigt jeden Typ mit beiden Kanälen', async () => {
    renderTab();

    expect(
      await screen.findByLabelText('Neues Mannschaftsspiel angelegt per E-Mail'),
    ).toBeChecked();
    expect(screen.getByLabelText('Erinnerung an Spieltermin per E-Mail')).not.toBeChecked();
    expect(screen.getByLabelText('Erinnerung an Spieltermin in der App')).toBeChecked();
  });

  it('erklärt, welche Nachrichten nicht abwählbar sind', async () => {
    renderTab();
    expect(
      await screen.findByText(/bekommst du immer eine E-Mail/),
    ).toBeInTheDocument();
  });

  it('übernimmt Vorlauf und Kopie-Adressen aus dem Profil', async () => {
    renderTab();

    expect(await screen.findByLabelText(/Wie viele Stunden vor einem Spiel/)).toHaveValue(48);
    expect(screen.getByLabelText(/E-Mail-Adressen für Kopien/)).toHaveValue(
      'eltern@example.com',
    );
  });

  it('speichert nur die geänderte Zeile', async () => {
    renderTab();
    await screen.findByLabelText('Neues Mannschaftsspiel angelegt per E-Mail');

    await userEvent.click(screen.getByLabelText('Neues Mannschaftsspiel angelegt per E-Mail'));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.upserts).toHaveLength(1));
    expect(state.upserts[0].values).toEqual([
      { profile_id: 'p-1', type: 'match_created', email: false, push: true },
    ]);
  });

  it('speichert Vorlauf und Kopien am Profil', async () => {
    renderTab();
    const hours = await screen.findByLabelText(/Wie viele Stunden vor einem Spiel/);

    await userEvent.clear(hours);
    await userEvent.type(hours, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]).toMatchObject({
      table: 'profiles',
      values: { reminder_games_hours: 12, emails_copies: ['eltern@example.com'] },
    });
  });

  it('weist einen unsinnigen Vorlauf ab', async () => {
    renderTab();
    const hours = await screen.findByLabelText(/Wie viele Stunden vor einem Spiel/);

    await userEvent.clear(hours);
    await userEvent.type(hours, '999');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/zwischen 0 und 336 Stunden/)).toBeInTheDocument();
    expect(state.updates).toHaveLength(0);
  });
});
