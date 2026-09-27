import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Row = Record<string, unknown>;

const state = {
  tables: {} as Record<string, Row[]>,
  ops: [] as { table: string; op: string; values?: unknown; filter?: Record<string, unknown> }[],
  rpc: [] as { name: string; args: unknown }[],
  pdfLines: [] as string[],
};

function makeBuilder(table: string) {
  const filter: Record<string, unknown> = {};
  let pending: { op: string; values?: unknown } | null = null;

  const result = () => {
    if (pending) state.ops.push({ table, ...pending, filter: { ...filter } });
    if (pending?.op === 'insert' && table === 'teams') {
      return { data: { id: `neu-${state.ops.length}` }, error: null };
    }
    return { data: pending ? null : (state.tables[table] ?? []), error: null };
  };

  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    eq: (column: string, value: unknown) => {
      filter[column] = value;
      return chain;
    },
    insert: (values: unknown) => {
      pending = { op: 'insert', values };
      return chain;
    },
    update: (values: unknown) => {
      pending = { op: 'update', values };
      return chain;
    },
    upsert: (values: unknown) => {
      pending = { op: 'upsert', values };
      return chain;
    },
    delete: () => {
      pending = { op: 'delete' };
      return chain;
    },
    single: () => Promise.resolve(result()),
    then: (resolve: (value: unknown) => unknown) => resolve(result()),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (name: string, args: unknown) => {
      state.rpc.push({ name, args });
      return Promise.resolve({ data: 1, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

vi.mock('../../src/lib/pdfText', () => ({
  readPdfLines: vi.fn(async () => state.pdfLines),
}));

import MeldungImportDialog from '../../src/features/teams/MeldungImportDialog';
import { ToastProvider } from '../../src/components/ui';

// Erfunden, im Aufbau der click-TT-Meldung.
const LINES = [
  'Oberbayern-Mitte | 2026/27',
  'Kontaktadresse Erwachsene (4er) Adler, Anton; T 01700000001 1.1 1780 Adler, Anton (1983/m) GER',
  'Hauptstr. 1, 85000 Musterdorf Landesliga Südsüdwest Staffel, Sven, 1.2 1700 Berg, Bernd (1990/m) GER',
  'Erwachsene II (2er) Ernst, Emil; T 0890000000 2.1 1600 Ernst, Emil (1985/m) GER',
  'Bezirksklasse A Gruppe 3 München-Ost Leiter, Lars, 2.2 1550 Fuchs, Fritz (1972/m) GER',
  '2.3 1540 Groß, Günter (1965/m) GER RES',
  '2.4 1500 Unbekannt, Ute (1980/w) GER',
];

function profile(id: string, first: string, last: string, qttr: number | null) {
  return { id, first_name: first, last_name: last, full_name: `${first} ${last}`, qttr };
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MeldungImportDialog open onOpenChange={() => {}} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.ops = [];
  state.rpc = [];
  state.pdfLines = LINES;
  state.tables = {
    profiles: [
      profile('adler', 'Anton', 'Adler', 1780),
      profile('berg', 'Bernd', 'Berg', 1650),
      profile('ernst', 'Emil', 'Ernst', 1600),
      profile('fuchs', 'Fritz', 'Fuchs', 1550),
      profile('gross', 'Günter', 'Gross', 1540),
      profile('alt', 'Otto', 'Alt', 1200),
    ],
    teams: [
      {
        id: 'team-2',
        name: 'Herren II',
        ranking_type: 'men',
        ranking: 2,
        size: 4,
        leagues: ['Kreisliga'],
      },
    ],
    team_leaders: [{ team_id: 'team-2', profile_id: 'alt' }],
    team_members: [],
    member_rankings: [{ profile_id: 'alt', ranking_type: 'men', team_number: 2, position_number: 1 }],
  };
});

describe('MeldungImportDialog', () => {
  it('zeigt die Vorschau und schreibt Mannschaften, Kader, Ränge und QTTR', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.upload(
      screen.getByLabelText('Mannschaftsmeldung (PDF)'),
      new File(['%PDF'], 'meldung.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByText('Erwachsene I')).toBeInTheDocument();
    // Die vorhandene zweite Mannschaft behält ihren Namen.
    expect(screen.getByText('Herren II')).toBeInTheDocument();
    expect(screen.getByText('1 neu')).toBeInTheDocument();
    expect(screen.getByText('1 aktualisiert')).toBeInTheDocument();
    expect(screen.getByText('1 nicht gefunden')).toBeInTheDocument();
    expect(screen.getByText(/1 QTTR-Werte aus der Meldung übernehmen/)).toBeInTheDocument();
    expect(screen.getByText('1 alte Ränge entfernen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(await screen.findByText('Mannschaftsmeldung übernommen')).toBeInTheDocument();

    const ops = (table: string, op: string) =>
      state.ops.filter((entry) => entry.table === table && entry.op === op);

    expect(ops('teams', 'insert')[0].values).toMatchObject({
      name: 'Erwachsene I',
      size: 4,
      ranking: 1,
      ranking_type: 'men',
      leagues: ['Landesliga Südsüdwest'],
    });
    expect(ops('teams', 'update')[0]).toMatchObject({
      values: { size: 2, ranking: 2, leagues: ['Bezirksklasse A Gruppe 3 München-Ost'] },
      filter: { id: 'team-2' },
    });

    // Zweite Mannschaft ist ein 2er: zwei Stammspieler, der Dritte Ersatz, die
    // Unbekannte fehlt. Mannschaftsführer wird der aus der Meldung.
    const roster = ops('team_members', 'insert').find(
      (entry) => (entry.values as Row[])[0].team_id === 'team-2',
    );
    expect(roster?.values).toEqual([
      { team_id: 'team-2', profile_id: 'ernst', kind: 'regular', rank: null },
      { team_id: 'team-2', profile_id: 'fuchs', kind: 'regular', rank: null },
      { team_id: 'team-2', profile_id: 'gross', kind: 'substitute', rank: 1 },
    ]);
    expect(
      ops('team_leaders', 'insert').find((entry) => (entry.values as Row[])[0].team_id === 'team-2')
        ?.values,
    ).toEqual([{ team_id: 'team-2', profile_id: 'ernst' }]);

    const ranks = ops('member_rankings', 'upsert').flatMap((entry) => entry.values as Row[]);
    expect(ranks).toContainEqual({
      profile_id: 'gross',
      ranking_type: 'men',
      team_number: 2,
      position_number: 3,
    });
    expect(ops('member_rankings', 'delete')[0].filter).toEqual({
      profile_id: 'alt',
      ranking_type: 'men',
    });

    expect(state.rpc).toEqual([
      { name: 'rpc_update_qttr_bulk', args: { p_values: [{ id: 'berg', qttr: 1700 }] } },
    ]);
  });

  it('lässt QTTR und alte Ränge auf Wunsch unangetastet', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.upload(
      screen.getByLabelText('Mannschaftsmeldung (PDF)'),
      new File(['%PDF'], 'meldung.pdf', { type: 'application/pdf' }),
    );
    await user.click(await screen.findByText(/QTTR-Werte aus der Meldung übernehmen/));
    await user.click(screen.getByText('1 alte Ränge entfernen'));
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

    await screen.findByText('Mannschaftsmeldung übernommen');
    expect(state.rpc).toEqual([]);
    expect(state.ops.filter((entry) => entry.table === 'member_rankings' && entry.op === 'delete')).toEqual(
      [],
    );
  });

  it('lässt den Kader stehen, wenn aus der Meldung niemand Mitglied ist', async () => {
    const user = userEvent.setup();
    state.tables.profiles = [];
    renderDialog();

    await user.upload(
      screen.getByLabelText('Mannschaftsmeldung (PDF)'),
      new File(['%PDF'], 'meldung.pdf', { type: 'application/pdf' }),
    );
    await screen.findByText('Herren II');
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(
      await screen.findAllByText(/Kader unverändert — kein Spieler als Mitglied gefunden/),
    ).toHaveLength(2);
    const touched = state.ops.filter((entry) =>
      ['team_members', 'team_leaders'].includes(entry.table),
    );
    expect(touched).toEqual([]);
  });

  it('meldet ein Dokument ohne Mannschaften', async () => {
    const user = userEvent.setup();
    state.pdfLines = ['Spiel-Erfassungs-Codes', 'Codetabelle'];
    renderDialog();

    await user.upload(
      screen.getByLabelText('Mannschaftsmeldung (PDF)'),
      new File(['%PDF'], 'codes.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByText(/ist es die Mannschaftsmeldung/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeDisabled());
  });
});
