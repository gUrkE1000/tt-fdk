import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Nachbau des Supabase-Kettenbaus, so weit die Mitgliederverwaltung ihn benutzt.
 * Die Kette selbst ist „thenable": am Ende jeder Kette steht in supabase-js ein await,
 * egal wie viele Filter davor hängen.
 */
interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  inserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; value: unknown }[],
  rpcCalls: [] as { name: string; args: unknown }[],
};

function makeBuilder(table: string) {
  const result = () => ({ data: state.tables[table] ?? [], error: null });

  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    is: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: (state.tables[table] ?? [])[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: (state.tables[table] ?? [])[0] ?? null, error: null }),

    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      const inserted = {
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'neu-1' }, error: null }),
        }),
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
      return inserted;
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

    then: (resolve: (value: ReturnType<typeof result>) => unknown) => resolve(result()),
  };

  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (name: string, args: unknown) => {
      state.rpcCalls.push({ name, args });
      // Die Verwaltung liest die vollständigen Profile über die Datenbankfunktion,
      // nicht über die Tabelle (dort sind Kontaktdaten per Spaltenrecht gesperrt).
      if (name === 'rpc_admin_members') {
        return Promise.resolve({ data: state.tables.profiles ?? [], error: null });
      }
      return Promise.resolve({ data: 2, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

import MembersPage from '../../src/features/members/MembersPage';
import { ToastProvider } from '../../src/components/ui';
import {
  EMPTY_FILTERS,
  filterMembers,
  hasActiveFilters,
  type MemberFilters,
} from '../../src/features/members/filter';
import {
  matchQttrLines,
  parseQttrLines,
  validateRankings,
} from '../../src/features/members/schemas';
import { toFormValues, toRankingInputs } from '../../src/features/members/MemberDialog';
import type { Member } from '../../src/features/members/api';

function member(overrides: Partial<Member> & { id: string }): Member {
  return {
    first_name: 'Vor',
    last_name: 'Nach',
    full_name: 'Vor Nach',
    email: null,
    phone: null,
    mobile_phone: null,
    gender: 'unspecified',
    birthday: null,
    member_number: null,
    role: 'member',
    status: 'active',
    no_games: false,
    qttr: null,
    contact_visible: false,
    hide_birthday: false,
    emails_copies: [],
    reminder_games_hours: 24,
    auth_linked_at: null,
    last_login_at: null,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Member;
}

const anna = member({
  id: 'm-anna',
  first_name: 'Anna',
  last_name: 'Admin',
  full_name: 'Anna Admin',
  email: 'anna@example.com',
  role: 'admin',
  qttr: 1620,
  member_number: '4711',
});
const meik = member({
  id: 'm-meik',
  first_name: 'Meik',
  last_name: 'Mannschaft',
  full_name: 'Meik Mannschaft',
  email: 'meik@example.com',
  role: 'team_leader',
  qttr: 1680,
});
const petra = member({
  id: 'm-petra',
  first_name: 'Petra',
  last_name: 'Pending',
  full_name: 'Petra Pending',
  email: 'petra@example.com',
  status: 'pending_approval',
});

/** „Mitglied anlegen" liegt im Aufklappmenü „Mitglieder hinzufügen". */
async function openAddMenu(entry: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: /Mitglieder hinzufügen/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: entry }));
}

function renderMembersPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/players']}>
          <MembersPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    profiles: [anna, meik, petra] as unknown as Row[],
    member_rankings: [
      { profile_id: 'm-anna', ranking_type: 'men', team_number: 1, position_number: 3 },
    ],
    groups: [{ id: 'g-1', name: 'Jugend' }],
    group_members: [{ group_id: 'g-1', profile_id: 'm-petra' }],
  };
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.rpcCalls = [];
});

// ------------------------------------------------------------------ Filterlogik

describe('filterMembers', () => {
  const all = [anna, meik, petra];
  const context = { groupMembers: { 'g-1': ['m-petra'] } };

  function withFilters(overrides: Partial<MemberFilters>): MemberFilters {
    return { ...EMPTY_FILTERS, ...overrides };
  }

  it('gibt ohne Filter alles zurück', () => {
    expect(filterMembers(all, EMPTY_FILTERS, context)).toHaveLength(3);
  });

  it('sucht über den Namen, unabhängig von Groß- und Kleinschreibung', () => {
    expect(filterMembers(all, withFilters({ search: 'mEiK' }), context)).toEqual([meik]);
  });

  it('sucht auch über E-Mail und Mitgliedsnummer', () => {
    expect(filterMembers(all, withFilters({ search: 'petra@' }), context)).toEqual([petra]);
    expect(filterMembers(all, withFilters({ search: '4711' }), context)).toEqual([anna]);
  });

  it('filtert nach Rolle und Status', () => {
    expect(filterMembers(all, withFilters({ role: 'admin' }), context)).toEqual([anna]);
    expect(filterMembers(all, withFilters({ status: 'pending_approval' }), context)).toEqual([
      petra,
    ]);
  });

  it('filtert nach Gruppe', () => {
    expect(filterMembers(all, withFilters({ groupId: 'g-1' }), context)).toEqual([petra]);
  });

  it('kombiniert Filter mit UND, nicht mit ODER', () => {
    expect(filterMembers(all, withFilters({ role: 'admin', status: 'pending_approval' }), context))
      .toHaveLength(0);
  });

  it('liefert für eine unbekannte Mannschaft nichts, statt alle durchzulassen', () => {
    expect(filterMembers(all, withFilters({ teamId: 'unbekannt' }), context)).toHaveLength(0);
  });

  it('erkennt, ob überhaupt gefiltert wird', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters(withFilters({ search: '  ' }))).toBe(false);
    expect(hasActiveFilters(withFilters({ role: 'admin' }))).toBe(true);
  });
});

// ------------------------------------------------------------------ Ränge

describe('Ränge', () => {
  it('nimmt leere Felder als „kein Rang" hin', () => {
    expect(validateRankings({ men: '', women: '  ' })).toBeNull();
  });

  it('weist ein unverständliches Format zurück', () => {
    expect(validateRankings({ men: '1-2' })).toMatch(/Mannschaft.Position/);
  });

  it('zerlegt „1.2" in Mannschaft und Position', () => {
    expect(toRankingInputs({ men: '1.2', women: '', seniors_40: '3.4' })).toEqual([
      { type: 'men', teamNumber: 1, positionNumber: 2 },
      { type: 'seniors_40', teamNumber: 3, positionNumber: 4 },
    ]);
  });

  it('füllt das Formular aus den gespeicherten Rängen', () => {
    const values = toFormValues(
      anna,
      [
        {
          profile_id: 'm-anna',
          ranking_type: 'men',
          team_number: 1,
          position_number: 3,
          created_at: '',
          updated_at: '',
        },
      ],
      [{ id: 'g-1', name: 'Jugend', created_at: '', updated_at: '', memberIds: ['m-anna'] }],
    );

    expect(values.rankings).toEqual({ men: '1.3' });
    expect(values.groupIds).toEqual(['g-1']);
    expect(values.qttr).toBe(1620);
  });
});

// ------------------------------------------------------------------ QTTR-Liste

describe('QTTR-Liste', () => {
  it('liest Name und Wert aus verschiedenen Trennzeichen', () => {
    const { lines, invalid } = parseQttrLines(
      'Anna Admin 1620\nMeik Mannschaft\t1680\nPetra Pending; 1400\n\n',
    );

    expect(invalid).toEqual([]);
    expect(lines).toEqual([
      { name: 'Anna Admin', qttr: 1620 },
      { name: 'Meik Mannschaft', qttr: 1680 },
      { name: 'Petra Pending', qttr: 1400 },
    ]);
  });

  it('sammelt Zeilen ohne erkennbaren Wert getrennt ein', () => {
    const { lines, invalid } = parseQttrLines('Anna Admin\nMeik Mannschaft 1680');
    expect(lines).toHaveLength(1);
    expect(invalid).toEqual(['Anna Admin']);
  });

  it('ordnet auch „Nachname, Vorname" zu', () => {
    const { matched, unmatched } = matchQttrLines(
      [
        { name: 'Admin, Anna', qttr: 1620 },
        { name: 'Unbekannt Person', qttr: 1000 },
      ],
      [anna, meik],
    );

    expect(matched).toEqual([{ id: 'm-anna', qttr: 1620, name: 'Admin, Anna' }]);
    expect(unmatched).toEqual([{ name: 'Unbekannt Person', qttr: 1000 }]);
  });
});

// ------------------------------------------------------------------ Oberfläche

describe('MembersPage', () => {
  it('zeigt alle Mitglieder mit Rang und Gruppe', async () => {
    renderMembersPage();

    expect(await screen.findAllByText('Anna Admin')).not.toHaveLength(0);
    expect(screen.getAllByText(/Erwachsene 1\.3/).length).toBeGreaterThan(0);
    expect(screen.getByText('3 von 3 Mitgliedern')).toBeInTheDocument();
  });

  it('filtert nach Rolle', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    await userEvent.selectOptions(screen.getByLabelText('Rolle'), 'admin');

    expect(await screen.findByText('1 von 3 Mitgliedern')).toBeInTheDocument();
    expect(screen.queryByText('Meik Mannschaft')).toBeNull();
  });

  it('setzt die Filter zurück', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    await userEvent.selectOptions(screen.getByLabelText('Rolle'), 'admin');
    await userEvent.click(screen.getByRole('button', { name: /Zurücksetzen/ }));

    expect(await screen.findByText('3 von 3 Mitgliedern')).toBeInTheDocument();
  });

  it('bietet Freischalten nur für wartende Mitglieder an', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    expect(screen.getAllByRole('button', { name: /Petra Pending freischalten/ })).not.toHaveLength(
      0,
    );
    expect(screen.queryByRole('button', { name: /Anna Admin freischalten/ })).toBeNull();
  });

  it('schaltet ein Mitglied über die Datenbankfunktion frei', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    const buttons = screen.getAllByRole('button', { name: /Petra Pending freischalten/ });
    await userEvent.click(buttons[0]);

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_activate_member',
        args: { p_profile_id: 'm-petra' },
      }),
    );
  });

  it('löscht erst nach Rückfrage und nur weich', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    await userEvent.click(screen.getAllByRole('button', { name: /Meik Mannschaft löschen/ })[0]);
    expect(state.updates).toHaveLength(0);

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0].table).toBe('profiles');
    expect(Object.keys(state.updates[0].values as object)).toEqual(['deleted_at']);
  });

  it('verlangt im Anlegen-Dialog einen Namen', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    await openAddMenu(/Mitglied anlegen/);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte Vornamen eingeben')).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });

  it('weist eine unbrauchbare E-Mail-Adresse ab', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    await openAddMenu(/Mitglied anlegen/);
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText(/Vorname/), 'Neues');
    await userEvent.type(within(dialog).getByLabelText(/Nachname/), 'Mitglied');
    await userEvent.type(within(dialog).getByLabelText(/E-Mail/), 'keine-email');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/sieht nicht nach einer E-Mail-Adresse aus/)).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });

  it('legt ein Mitglied ohne E-Mail an', async () => {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');

    await openAddMenu(/Mitglied anlegen/);
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText(/Vorname/), 'Kind');
    await userEvent.type(within(dialog).getByLabelText(/Nachname/), 'Ohnemail');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.inserts.some((i) => i.table === 'profiles')).toBe(true));
    const insert = state.inserts.find((i) => i.table === 'profiles')!;
    expect(insert.values).toMatchObject({
      first_name: 'Kind',
      last_name: 'Ohnemail',
      email: null,
      qttr: null,
    });
  });
});

describe('Gruppen', () => {
  async function openGroups() {
    renderMembersPage();
    await screen.findAllByText('Anna Admin');
    await userEvent.click(screen.getByRole('tab', { name: 'Gruppen' }));
  }

  it('listet die Gruppen mit der Zahl der Mitglieder', async () => {
    await openGroups();
    expect(await screen.findAllByText('Jugend')).not.toHaveLength(0);
  });

  it('legt eine Gruppe an', async () => {
    await openGroups();

    await userEvent.click(screen.getByRole('button', { name: /Gruppe anlegen/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'Vorstand');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(state.inserts).toContainEqual({ table: 'groups', values: { name: 'Vorstand' } }),
    );
  });

  it('verlangt einen Gruppennamen', async () => {
    await openGroups();

    await userEvent.click(screen.getByRole('button', { name: /Gruppe anlegen/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte einen Namen eingeben')).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });
});
