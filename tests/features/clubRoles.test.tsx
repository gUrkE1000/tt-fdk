import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { dutiesToText, parseDuties } from '../../src/features/club/rolesApi';

describe('parseDuties', () => {
  it('nimmt eine Tätigkeit pro Zeile', () => {
    expect(parseDuties('Training organisieren\nPressearbeit')).toEqual([
      'Training organisieren',
      'Pressearbeit',
    ]);
  });

  it('nimmt auch Kommas — der Platzhalter nennt beides', () => {
    expect(parseDuties('Kasse, Beiträge')).toEqual(['Kasse', 'Beiträge']);
  });

  it('wirft leere Zeilen weg', () => {
    expect(parseDuties('Kasse\n\n  \nBeiträge')).toEqual(['Kasse', 'Beiträge']);
    expect(parseDuties('')).toEqual([]);
  });

  it('kommt heil zurück ins Textfeld', () => {
    // Sonst verschwänden Einträge beim zweiten Öffnen des Dialogs.
    const duties = ['Training organisieren', 'Pressearbeit'];
    expect(parseDuties(dutiesToText(duties))).toEqual(duties);
  });
});

// ---------------------------------------------------------------- Oberfläche

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  inserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown }[],
  deletes: [] as string[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    is: () => chain,
    eq: () => chain,
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 'neu-1' }, error: null }) }),
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
    },
    update: (values: unknown) => {
      state.updates.push({ table, values });
      return { eq: () => Promise.resolve({ error: null }) };
    },
    delete: () => ({
      eq: (_column: string, value: string) => {
        state.deletes.push(`${table}:${value}`);
        return Promise.resolve({ error: null });
      },
    }),
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
  APP_URL: 'https://verein.example.org',
}));

import ClubRolesTab from '../../src/features/club/ClubRolesTab';
import { ToastProvider } from '../../src/components/ui';

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <ClubRolesTab />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.tables = {
    profiles: [
      { id: 'p-1', full_name: 'Anna Admin', status: 'active' },
      { id: 'p-2', full_name: 'Tina Trainerin', status: 'active' },
    ],
    club_roles: [
      {
        id: 'r-1',
        name: 'Jugendwart',
        description: 'Kümmert sich um die Jugend.',
        duties: ['Training organisieren', 'Turniere melden'],
        sort_order: 1,
      },
      { id: 'r-2', name: 'Kassier', description: '', duties: [], sort_order: 2 },
    ],
    v_club_role_members: [
      { role_id: 'r-1', profile_id: 'p-2', full_name: 'Tina Trainerin', user_role: 'trainer' },
    ],
  };
});

describe('ClubRolesTab', () => {
  it('zeigt Ämter mit Inhabern und Tätigkeiten', async () => {
    renderTab();

    expect(await screen.findByText('Jugendwart')).toBeInTheDocument();
    expect(screen.getByText('Tina Trainerin')).toBeInTheDocument();
    expect(screen.getByText('Training organisieren')).toBeInTheDocument();
  });

  it('sagt es, wenn ein Amt niemanden hat', async () => {
    renderTab();
    expect(await screen.findByText('niemand zugeordnet')).toBeInTheDocument();
  });

  it('macht klar, dass ein Amt keine Rechte gibt', async () => {
    // Sonst hielte es jemand für eine Benutzerrolle — der häufigste Irrtum bei diesem Modul.
    renderTab();
    expect(await screen.findByText(/geben keine Rechte/)).toBeInTheDocument();
  });

  it('legt ein Amt mit Tätigkeiten an', async () => {
    renderTab();
    await screen.findByText('Jugendwart');

    await userEvent.click(screen.getByRole('button', { name: /Amt anlegen/ }));
    await userEvent.type(await screen.findByLabelText(/^Name/), 'Pressewart');
    await userEvent.type(screen.getByLabelText('Tätigkeiten'), 'Berichte schreiben');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.inserts.length).toBeGreaterThan(0));
    expect(state.inserts[0]).toEqual({
      table: 'club_roles',
      values: {
        name: 'Pressewart',
        description: '',
        duties: ['Berichte schreiben'],
        sort_order: 3,
      },
    });
  });

  it('verlangt einen Namen', async () => {
    renderTab();
    await screen.findByText('Jugendwart');

    await userEvent.click(screen.getByRole('button', { name: /Amt anlegen/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Das Amt braucht einen Namen')).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });

  it('füllt den Dialog beim Bearbeiten vor', async () => {
    renderTab();
    await screen.findByText('Jugendwart');

    await userEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);

    expect(((await screen.findByLabelText(/^Name/)) as HTMLInputElement).value).toBe('Jugendwart');
    expect((screen.getByLabelText('Tätigkeiten') as HTMLTextAreaElement).value).toBe(
      'Training organisieren\nTurniere melden',
    );
  });
});
