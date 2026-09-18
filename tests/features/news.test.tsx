import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { isScheduled } from '../../src/features/club/newsApi';

describe('isScheduled', () => {
  const now = new Date('2026-09-18T12:00:00Z');

  it('erkennt eine vordatierte Neuigkeit', () => {
    expect(isScheduled({ published_at: '2026-09-25T12:00:00Z' }, now)).toBe(true);
  });

  it('lässt Veröffentlichtes in Ruhe', () => {
    expect(isScheduled({ published_at: '2026-09-11T12:00:00Z' }, now)).toBe(false);
    expect(isScheduled({ published_at: null }, now)).toBe(false);
  });
});

// ---------------------------------------------------------------- Oberfläche

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  inserts: [] as { table: string; values: unknown }[],
  deletes: [] as string[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    eq: () => chain,
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return Promise.resolve({ error: null });
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
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

import NewsTab from '../../src/features/club/NewsTab';
import { ToastProvider } from '../../src/components/ui';

function renderTab(canEdit = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <NewsTab canEdit={canEdit} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const soon = new Date(Date.now() + 7 * 86_400_000).toISOString();
const past = new Date(Date.now() - 3 * 86_400_000).toISOString();

beforeEach(() => {
  state.inserts = [];
  state.deletes = [];
  state.tables = {
    v_news: [
      {
        id: 'n-1',
        title: 'Jahreshauptversammlung',
        body_html: '<p>Beginn um <strong>19 Uhr</strong>.</p>',
        published_at: past,
        pinned: true,
        author_id: 'p-1',
        author_name: 'Anna Admin',
      },
      {
        id: 'n-2',
        title: 'Sommerfest — Vorankündigung',
        body_html: '',
        published_at: soon,
        pinned: false,
        author_id: 'p-2',
        author_name: 'Olaf Organisator',
      },
    ],
  };
});

describe('NewsTab', () => {
  it('zeigt Neuigkeiten mit Verfasser und formatiertem Text', async () => {
    renderTab();

    expect(await screen.findByText('Jahreshauptversammlung')).toBeInTheDocument();
    expect(screen.getByText(/Anna Admin/)).toBeInTheDocument();
    expect(screen.getByText('19 Uhr').tagName).toBe('STRONG');
  });

  it('markiert Angeheftetes und Geplantes', async () => {
    renderTab();
    expect(await screen.findByLabelText('angeheftet')).toBeInTheDocument();
    expect(screen.getByText('geplant')).toBeInTheDocument();
  });

  it('zeigt einem Mitglied keine Knöpfe', async () => {
    renderTab();
    await screen.findByText('Jahreshauptversammlung');

    expect(screen.queryByRole('button', { name: /Neuigkeit schreiben/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
  });

  it('sagt dem Organisator, dass keine Benachrichtigung rausgeht', async () => {
    // Sonst rechnet er damit, dass alle es sofort erfahren.
    renderTab(true);
    expect(await screen.findByText(/keine\s+Benachrichtigung raus/)).toBeInTheDocument();
  });

  it('schreibt eine Neuigkeit — ohne Verfasser im Aufruf', async () => {
    renderTab(true);
    await screen.findByText('Jahreshauptversammlung');

    await userEvent.click(screen.getByRole('button', { name: /Neuigkeit schreiben/ }));
    await userEvent.type(await screen.findByLabelText(/^Überschrift/), 'Neue Trikots');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.inserts).toHaveLength(1));

    const values = state.inserts[0].values as Record<string, unknown>;
    expect(values.title).toBe('Neue Trikots');
    // Den Verfasser setzt ein Trigger aus der Sitzung — die Oberfläche schickt ihn nicht mit.
    expect(values).not.toHaveProperty('author_id');
  });

  it('verlangt eine Überschrift', async () => {
    renderTab(true);
    await screen.findByText('Jahreshauptversammlung');

    await userEvent.click(screen.getByRole('button', { name: /Neuigkeit schreiben/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Die Neuigkeit braucht eine Überschrift')).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });
});
