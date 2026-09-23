import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MESSAGE_MAX_LENGTH, messageProblem } from '../../src/features/messages/api';

describe('messageProblem', () => {
  it('lässt eine normale Nachricht durch', () => {
    expect(messageProblem('Wer bringt Bälle mit?')).toBeNull();
  });

  it('lehnt Leerraum ab', () => {
    expect(messageProblem('   ')).toMatch(/Schreib etwas/);
    expect(messageProblem('')).toMatch(/Schreib etwas/);
  });

  it('nennt die Grenze, die auch die Datenbank zieht', () => {
    // Sonst käme der CHECK-Constraint als unverständlicher Fehler zurück.
    const problem = messageProblem('a'.repeat(MESSAGE_MAX_LENGTH + 1));
    expect(problem).toMatch(new RegExp(String(MESSAGE_MAX_LENGTH)));
  });
});

// ---------------------------------------------------------------- Oberfläche

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  inserts: [] as Row[],
  deletes: [] as string[],
  profileId: 'p-01',
  role: 'member' as string,
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    eq: () => chain,
    insert: (values: Row) => {
      state.inserts.push(values);
      return Promise.resolve({ error: null });
    },
    delete: () => ({
      eq: (_column: string, value: string) => {
        state.deletes.push(value);
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

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: { id: state.profileId, full_name: 'Spieler 01', status: 'active' },
    role: state.role,
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import MessagesPanel from '../../src/features/messages/MessagesPanel';
import { ToastProvider } from '../../src/components/ui';

function renderPanel(count?: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MessagesPanel type="session" objectId="s-1" count={count} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.inserts = [];
  state.deletes = [];
  state.profileId = 'p-01';
  state.role = 'member';
  state.tables = {
    v_object_messages: [
      {
        id: 'm-1',
        object_type: 'session',
        object_id: 's-1',
        author_id: 'p-02',
        author_name: 'Spieler 02',
        body: 'Wer bringt Bälle mit?',
        created_at: '2026-09-15T18:00:00Z',
        updated_at: '2026-09-15T18:00:00Z',
        edited: false,
      },
      {
        id: 'm-2',
        object_type: 'session',
        object_id: 's-1',
        author_id: 'p-01',
        author_name: 'Spieler 01',
        body: 'Ich.',
        created_at: '2026-09-15T18:05:00Z',
        updated_at: '2026-09-15T18:09:00Z',
        edited: true,
      },
    ],
  };
});

describe('MessagesPanel', () => {
  it('bleibt zugeklappt und zeigt nur den Zähler', async () => {
    renderPanel(3);

    expect(screen.getByRole('button', { name: 'Nachrichten (3)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // Zugeklappt wird nichts geladen — sonst wären zwanzig Karten zwanzig Abfragen.
    expect(screen.queryByText('Wer bringt Bälle mit?')).toBeNull();
  });

  it('lädt den Faden erst beim Aufklappen', async () => {
    renderPanel(2);
    await userEvent.click(screen.getByRole('button', { name: 'Nachrichten (2)' }));

    expect(await screen.findByText('Wer bringt Bälle mit?')).toBeInTheDocument();
    expect(screen.getByText('Spieler 02')).toBeInTheDocument();
  });

  it('markiert eine bearbeitete Nachricht', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Nachrichten/ }));

    expect(await screen.findByText(/bearbeitet/)).toBeInTheDocument();
  });

  it('schickt eine Nachricht mit dem eigenen Verfasser ab', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Nachrichten/ }));

    await userEvent.type(await screen.findByLabelText('Nachricht'), 'Bin dabei');
    await userEvent.click(screen.getByRole('button', { name: /Abschicken/ }));

    await waitFor(() => expect(state.inserts).toHaveLength(1));
    expect(state.inserts[0]).toEqual({
      object_type: 'session',
      object_id: 's-1',
      author_id: 'p-01',
      body: 'Bin dabei',
    });
  });

  it('schickt nichts Leeres ab', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Nachrichten/ }));

    await userEvent.click(await screen.findByRole('button', { name: /Abschicken/ }));

    expect(await screen.findByText(/Schreib etwas/)).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });

  it('bietet das Löschen nur bei der eigenen Nachricht an', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Nachrichten/ }));
    await screen.findByText('Wer bringt Bälle mit?');

    expect(screen.getAllByRole('button', { name: 'Löschen' })).toHaveLength(1);
  });

  it('lässt den Administrator jede löschen', async () => {
    // Ein Verein braucht eine Stelle, die eine entgleiste Zeile wegräumen kann.
    state.role = 'admin';
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Nachrichten/ }));
    await screen.findByText('Wer bringt Bälle mit?');

    expect(screen.getAllByRole('button', { name: 'Löschen' })).toHaveLength(2);
  });
});
