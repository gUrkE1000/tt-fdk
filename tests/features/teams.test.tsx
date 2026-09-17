import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  inserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; value: unknown }[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
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
      eq: (_column: string, value: unknown) => {
        state.deletes.push({ table, value });
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
  APP_URL: 'http://localhost:5173',
}));

import TeamsPage from '../../src/features/teams/TeamsPage';
import PlayersManagementPage from '../../src/features/teams/PlayersManagementPage';
import { ToastProvider } from '../../src/components/ui';
import {
  EMPTY_TEAM,
  parseLeagues,
  teamSchema,
  teamSubtitle,
  LINEUP_MODE_HELP,
  SUBSTITUTE_MODE_HELP,
} from '../../src/features/teams/schemas';

const team = {
  id: 't-1',
  name: '1. Herren',
  color: '#1D4ED8',
  size: 4,
  ranking_type: 'men',
  ranking: 1,
  leagues: ['Bezirksliga'],
  lineup_mode: 'fixed',
  substitute_mode: 'sequential',
  substitute_timeout_hours: 24,
  hide_users_no_ranking: false,
  block_participants_after: null,
  comment_home_games: '',
  comment_away_games: '',
  arrival_minutes_home: 60,
  arrival_minutes_away: 30,
  manual_request_auto_add: true,
  hide_drivers_catering: false,
  is_braunschweiger: false,
  webcal_url: null,
  sync_enabled: true,
  active: true,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderPage(ui: React.ReactElement) {
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
  state.tables = {
    teams: [team],
    team_leaders: [{ team_id: 't-1', profile_id: 'p-meik' }],
    team_members: [
      { team_id: 't-1', profile_id: 'p-tina', kind: 'regular', rank: null },
      { team_id: 't-1', profile_id: 'p-meik', kind: 'regular', rank: null },
      { team_id: 't-1', profile_id: 'p-theo', kind: 'substitute', rank: 2 },
      { team_id: 't-1', profile_id: 'p-olaf', kind: 'substitute', rank: 1 },
    ],
    profiles: [
      { id: 'p-tina', full_name: 'Tina Trainerin', qttr: 1710, deleted_at: null },
      { id: 'p-meik', full_name: 'Meik Mannschaft', qttr: 1680, deleted_at: null },
      { id: 'p-theo', full_name: 'Theo Trainer', qttr: 1530, deleted_at: null },
      { id: 'p-olaf', full_name: 'Olaf Organisator', qttr: 1450, deleted_at: null },
    ],
  };
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
});

// ------------------------------------------------------------------ reine Logik

describe('Mannschafts-Schema', () => {
  it('verlangt einen Namen', () => {
    expect(teamSchema.safeParse({ ...EMPTY_TEAM, name: '  ' }).success).toBe(false);
  });

  it('lässt nicht mehr Stammspieler zu, als die Mannschaft Plätze hat', () => {
    const result = teamSchema.safeParse({
      ...EMPTY_TEAM,
      name: '1. Herren',
      size: 2,
      regularIds: ['a', 'b', 'c'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/mehr Stammspieler ausgewählt/);
    }
  });

  it('erlaubt genau so viele Stammspieler wie Plätze', () => {
    expect(
      teamSchema.safeParse({ ...EMPTY_TEAM, name: '1. Herren', size: 2, regularIds: ['a', 'b'] })
        .success,
    ).toBe(true);
  });

  it('weist jemanden zurück, der Stamm- und Ersatzspieler zugleich ist', () => {
    const result = teamSchema.safeParse({
      ...EMPTY_TEAM,
      name: '1. Herren',
      regularIds: ['a'],
      substituteIds: ['a'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/gleichzeitig als Stamm- und als Ersatz/);
    }
  });

  it('bildet den Untertitel der Mannschaftsliste', () => {
    expect(teamSubtitle({ size: 4, ranking: 2, rankingTypeLabel: 'Erwachsene' })).toBe(
      '4er Mannschaft · Rang: 2 | Erwachsene',
    );
    expect(teamSubtitle({ size: 6, ranking: null, rankingTypeLabel: 'Damen' })).toBe(
      '6er Mannschaft · Damen',
    );
  });

  it('zerlegt eine Kommaliste von Ligen', () => {
    expect(parseLeagues('Bezirksliga, Bezirkspokal ,, ')).toEqual([
      'Bezirksliga',
      'Bezirkspokal',
    ]);
  });

  it('hält die Hilfetexte des TT-Planers wörtlich vor', () => {
    expect(LINEUP_MODE_HELP.fixed).toMatch(/automatisch ein Ersatz gesucht/);
    expect(LINEUP_MODE_HELP.open).toMatch(/bei einer Überbesetzung die finale Aufstellung/);
    expect(SUBSTITUTE_MODE_HELP.sequential).toMatch(/der Reihe nach angefragt/);
    expect(SUBSTITUTE_MODE_HELP.parallel).toMatch(/gleichzeitig benachrichtigt/);
    expect(SUBSTITUTE_MODE_HELP.manual).toMatch(/keine automatischen Ersatzanfragen/);
  });
});

// ------------------------------------------------------------------ Oberfläche

describe('TeamsPage', () => {
  it('zeigt Mannschaft, Führung und Kaderzahlen', async () => {
    renderPage(<TeamsPage />);

    expect(await screen.findAllByText('1. Herren')).not.toHaveLength(0);
    expect(screen.getAllByText('Meik Mannschaft').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 / 4').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4er Mannschaft · Rang: 1 \| Erwachsene/).length).toBeGreaterThan(0);
  });

  it('öffnet den Dialog mit den gespeicherten Werten', async () => {
    renderPage(<TeamsPage />);
    await screen.findAllByText('1. Herren');

    await userEvent.click(screen.getAllByRole('button', { name: /1\. Herren bearbeiten/ })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue('1. Herren');
    expect(within(dialog).getByLabelText(/Anzahl Spieler/)).toHaveValue(4);
    expect(within(dialog).getByLabelText('Ligen')).toHaveValue('Bezirksliga');
  });

  it('erklärt die gewählte Spieler-Logik im Wortlaut des TT-Planers', async () => {
    renderPage(<TeamsPage />);
    await screen.findAllByText('1. Herren');

    await userEvent.click(screen.getAllByRole('button', { name: /1\. Herren bearbeiten/ })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Kader' }));

    expect(await screen.findByText(/automatisch ein Ersatz gesucht/)).toBeInTheDocument();
  });

  it('nennt die Höchstzahl der Stammspieler', async () => {
    renderPage(<TeamsPage />);
    await screen.findAllByText('1. Herren');

    await userEvent.click(screen.getAllByRole('button', { name: /1\. Herren bearbeiten/ })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Kader' }));

    expect(await screen.findByText('Maximal 4 Stammspieler.')).toBeInTheDocument();
  });

  it('speichert Mannschaft und Kader zusammen', async () => {
    renderPage(<TeamsPage />);
    await screen.findAllByText('1. Herren');

    await userEvent.click(screen.getAllByRole('button', { name: /1\. Herren bearbeiten/ })[0]);
    const dialog = await screen.findByRole('dialog');

    const name = within(dialog).getByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Erste Herren');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]).toMatchObject({
      table: 'teams',
      values: { name: 'Erste Herren', size: 4 },
    });

    // Der Kader wird vollständig ersetzt: erst löschen, dann neu schreiben.
    await waitFor(() => expect(state.deletes.map((d) => d.table)).toEqual([
      'team_leaders',
      'team_members',
    ]));
  });

  it('speichert die Ersatzreihenfolge als Rang', async () => {
    renderPage(<TeamsPage />);
    await screen.findAllByText('1. Herren');

    await userEvent.click(screen.getAllByRole('button', { name: /1\. Herren bearbeiten/ })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(state.inserts.some((entry) => entry.table === 'team_members')).toBe(true),
    );

    const rows = state.inserts.find((entry) => entry.table === 'team_members')!.values as {
      profile_id: string;
      kind: string;
      rank: number | null;
    }[];

    // Olaf hat Rang 1, Theo Rang 2 — die Liste kommt in dieser Reihenfolge zurück.
    expect(rows.filter((row) => row.kind === 'substitute')).toEqual([
      { team_id: 't-1', profile_id: 'p-olaf', kind: 'substitute', rank: 1 },
      { team_id: 't-1', profile_id: 'p-theo', kind: 'substitute', rank: 2 },
    ]);
  });

  it('verlangt vor dem Löschen eine Bestätigung', async () => {
    renderPage(<TeamsPage />);
    await screen.findAllByText('1. Herren');

    await userEvent.click(screen.getAllByRole('button', { name: /1\. Herren löschen/ })[0]);
    expect(state.deletes).toHaveLength(0);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/verschwinden auch ihre Spieltermine/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(state.deletes).toEqual([{ table: 'teams', value: 't-1' }]));
  });
});

describe('PlayersManagementPage', () => {
  it('zeigt jede Mannschaft mit ihrem Kaderstand', async () => {
    renderPage(<PlayersManagementPage />);

    expect(await screen.findByText('1. Herren')).toBeInTheDocument();
    expect(screen.getByText('Stammspieler (2/4)')).toBeInTheDocument();
  });

  it('speichert nur, was sich geändert hat', async () => {
    renderPage(<PlayersManagementPage />);
    await screen.findByText('1. Herren');

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(screen.getByText('Kader gespeichert')).toBeInTheDocument());
    expect(state.deletes).toHaveLength(0);
  });
});
