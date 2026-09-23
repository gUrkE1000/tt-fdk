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
  rpcCalls: [] as { name: string; args: unknown }[],
  inserts: [] as { table: string; values: unknown }[],
  deletes: [] as string[],
  copied: [] as string[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    is: () => chain,
    not: () => chain,
    gte: () => chain,
    in: () => Promise.resolve({ error: null }),
    eq: () => chain,
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 'neu-1' }, error: null }) }),
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => {
      state.deletes.push(table);
      return chain;
    },
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
  APP_URL: 'http://localhost:5173',
}));

// Veränderbar, damit einzelne Tests als Administrator laufen können.
const sessionState = { role: 'team_leader' };

const profile = {
  id: 'p-me',
  first_name: 'Meik',
  last_name: 'Mannschaft',
  full_name: 'Meik Mannschaft',
  role: 'team_leader',
  status: 'active',
  qttr: 1680,
  deleted_at: null,
};

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile,
    role: sessionState.role,
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import MyGamesPage from '../../src/features/matches/MyGamesPage';
import OpenItemsList from '../../src/features/dashboard/OpenItemsList';
import ManagePlayersDialog from '../../src/features/matches/ManagePlayersDialog';
import ShareLineupDialog from '../../src/features/matches/ShareLineupDialog';
import { ToastProvider } from '../../src/components/ui';
import {
  findSameDayConflicts,
  groupParticipations,
  statusOf,
  ACTION_HELP,
} from '../../src/features/matches/lineupSections';
import type { MatchRow, Participation } from '../../src/features/matches/api';
import type { TeamWithRoster } from '../../src/features/teams/api';

// In vier Wochen — damit das Spiel unabhängig vom Testdatum in der Zukunft liegt.
const soon = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
const matchDay = soon.toISOString().slice(0, 10);

const upcoming = {
  id: 'm-1',
  team_id: 't-1',
  source: 'manual',
  external_uid: null,
  summary: '1. Herren – TTC Nachbarstadt',
  opponent: 'TTC Nachbarstadt',
  league: 'Bezirksliga',
  description: '',
  location_text: '',
  venue_id: 'v-1',
  is_home: true,
  dtstart_external: soon.toISOString(),
  dtend_external: new Date(soon.getTime() + 4 * 3600_000).toISOString(),
  dtstart_override: null,
  dtend_override: null,
  dtstart: soon.toISOString(),
  dtend: new Date(soon.getTime() + 4 * 3600_000).toISOString(),
  required_players: 4,
  supervisor_id: null,
  comment: '',
  nuscore_code: null,
  nuscore_pin: null,
  matchday: 5,
  version: 2,
  active: true,
  cancel_reason: null,
  lineup_locked: false,
  last_synced_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as MatchRow;

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
  comment_home_games: 'Bitte helle Trikots mitbringen.',
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
  leaderIds: ['p-me'],
  regularIds: ['p-me', 'p-tina'],
  substituteIds: ['p-theo'],
} as unknown as TeamWithRoster;

function participation(overrides: Partial<Participation> & { profile_id: string }): Participation {
  return {
    match_id: 'm-1',
    response: 'none',
    version_responded: null,
    lineup_position: null,
    removed: false,
    comment: '',
    source: 'auto',
    updated_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Participation;
}

function renderWith(ui: React.ReactElement) {
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
  sessionState.role = 'team_leader';
  state.tables = {
    matches: [upcoming as unknown as Row],
    match_participations: [
      participation({ profile_id: 'p-me', response: 'yes', lineup_position: 1, version_responded: 1 }),
      participation({ profile_id: 'p-tina', response: 'yes', lineup_position: 2, version_responded: 2 }),
      participation({ profile_id: 'p-theo' }),
      participation({ profile_id: 'p-olaf', response: 'no', version_responded: 2 }),
      participation({ profile_id: 'p-uwe', response: 'unclear', version_responded: 2 }),
    ] as unknown as Row[],
    match_volunteers: [],
    teams: [team as unknown as Row],
    team_leaders: [{ team_id: 't-1', profile_id: 'p-me' }],
    team_members: [
      { team_id: 't-1', profile_id: 'p-me', kind: 'regular', rank: null },
      { team_id: 't-1', profile_id: 'p-tina', kind: 'regular', rank: null },
      { team_id: 't-1', profile_id: 'p-theo', kind: 'substitute', rank: 1 },
    ],
    venues: [
      {
        id: 'v-1',
        name: 'Sporthalle Musterstadt',
        address: 'Turnstraße 5',
        postal_code: '12345',
        city: 'Musterstadt',
        active: true,
        training_only: false,
      },
    ],
    profiles: [
      profile,
      { id: 'p-tina', full_name: 'Tina Trainerin', qttr: 1710, deleted_at: null },
      { id: 'p-theo', full_name: 'Theo Trainer', qttr: 1530, deleted_at: null },
      { id: 'p-olaf', full_name: 'Olaf Organisator', qttr: 1450, deleted_at: null },
      { id: 'p-uwe', full_name: 'Uwe Unklar', qttr: 1390, deleted_at: null },
    ],
    v_absences: [],
  };
  state.rpcCalls = [];
  state.inserts = [];
  state.deletes = [];
  state.copied = [];

  Object.assign(navigator, {
    clipboard: {
      writeText: (text: string) => {
        state.copied.push(text);
        return Promise.resolve();
      },
    },
  });
});

// ------------------------------------------------------------------ Einteilung

describe('Einteilung der Spieler', () => {
  const absences = [{ profileId: 'p-theo', startDate: matchDay, endDate: matchDay }];

  it('ordnet jeden genau einem Abschnitt zu', () => {
    const sections = groupParticipations(
      [
        participation({ profile_id: 'a', response: 'yes', lineup_position: 1 }),
        participation({ profile_id: 'b' }),
        participation({ profile_id: 'p-theo' }),
        participation({ profile_id: 'd', response: 'yes', removed: true }),
        participation({ profile_id: 'e', response: 'no' }),
        participation({ profile_id: 'f', response: 'unclear' }),
      ],
      matchDay,
      absences,
    );

    expect(sections.lineup.map((entry) => entry.profile_id)).toEqual(['a']);
    expect(sections.open.map((entry) => entry.profile_id)).toEqual(['b']);
    expect(sections.absent.map((entry) => entry.profile_id)).toEqual(['p-theo']);
    expect(sections.removed.map((entry) => entry.profile_id)).toEqual(['d']);
    expect(sections.declined.map((entry) => entry.profile_id)).toEqual(['e']);
    expect(sections.unclear.map((entry) => entry.profile_id)).toEqual(['f']);
  });

  it('stellt „entfernt" über alles andere', () => {
    expect(
      statusOf(
        participation({ profile_id: 'a', response: 'yes', lineup_position: 1, removed: true }),
        matchDay,
        [],
      ),
    ).toBe('removed');
  });

  it('meldet abwesend nur, solange keine Antwort vorliegt', () => {
    expect(statusOf(participation({ profile_id: 'p-theo' }), matchDay, absences)).toBe('absent');
    expect(
      statusOf(participation({ profile_id: 'p-theo', response: 'yes', lineup_position: 1 }), matchDay, absences),
    ).toBe('lineup');
  });

  it('sortiert die Aufstellung nach Position', () => {
    const sections = groupParticipations(
      [
        participation({ profile_id: 'b', response: 'yes', lineup_position: 2 }),
        participation({ profile_id: 'a', response: 'yes', lineup_position: 1 }),
      ],
      matchDay,
      [],
    );

    expect(sections.lineup.map((entry) => entry.profile_id)).toEqual(['a', 'b']);
  });

  it('findet Zusagen zu einem anderen Spiel innerhalb von drei Stunden', () => {
    const here = [participation({ profile_id: 'a' }), participation({ profile_id: 'b' })];
    const all = [
      ...here,
      { ...participation({ profile_id: 'a', response: 'yes' }), match_id: 'm-2' } as Participation,
      { ...participation({ profile_id: 'b', response: 'yes' }), match_id: 'm-3' } as Participation,
    ];

    const conflicts = findSameDayConflicts(here, all, '2026-10-05T17:00:00Z', {
      'm-2': '2026-10-05T19:00:00Z',
      'm-3': '2026-10-05T23:00:00Z',
    }, 'm-1');

    expect(conflicts).toEqual(['a']);
  });

  it('hält die Erklärungstexte des TT-Planers wörtlich vor', () => {
    expect(ACTION_HELP.add).toBe(
      'Fügt den Spieler beim Spiel hinzu und informiert diesen per E-Mail darüber',
    );
    expect(ACTION_HELP.remove).toMatch(/vorerst beim Spiel/);
    expect(ACTION_HELP.reset).toBe('Setzt den Teilnahme Status des Spielers zurück');
  });
});

// ------------------------------------------------------------------ Meine Spiele

describe('MyGamesPage', () => {
  it('zeigt die Spiele, an denen ich beteiligt bin', async () => {
    renderWith(<MyGamesPage />);
    expect(await screen.findByText(/1\. Herren gegen TTC Nachbarstadt/)).toBeInTheDocument();
  });

  it('zeigt den Stand der Aufstellung', async () => {
    renderWith(<MyGamesPage />);
    expect(await screen.findByText('2 / 4 Spieler besetzt')).toBeInTheDocument();
  });

  it('warnt, wenn der Termin sich nach meiner Antwort geändert hat', async () => {
    renderWith(<MyGamesPage />);
    expect(
      await screen.findByText(/Der Termin hat sich geändert, seit du geantwortet hast/),
    ).toBeInTheDocument();
  });

  it('speichert eine Absage über die Datenbankfunktion', async () => {
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    await userEvent.click(screen.getByRole('button', { name: 'Absage' }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_set_match_response',
        args: { p_match_id: 'm-1', p_response: 'no', p_comment: '' },
      }),
    );
  });

  it('zeigt die eigene Zusage als gedrückten Knopf', async () => {
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    expect(screen.getByRole('button', { name: 'Zusage' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Absage' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('trägt mich als Fahrer ein', async () => {
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    await userEvent.click(screen.getByRole('button', { name: 'Ich kann fahren' }));

    await waitFor(() =>
      expect(state.inserts).toContainEqual({
        table: 'match_volunteers',
        values: { match_id: 'm-1', profile_id: 'p-me', kind: 'driver' },
      }),
    );
  });

  // Fehlerbild vom 23.09.2026: Beide Knöpfe standen an der Karte, taten aber nichts —
  // „Meine Spiele" hatte die Dialoge nie angeschlossen, nur „Spieltermine".
  it('öffnet als Mannschaftsführer „Spieler verwalten"', async () => {
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    await userEvent.click(screen.getByRole('button', { name: /Spieler verwalten/ }));

    expect(await screen.findByRole('dialog', { name: 'Spieler verwalten' })).toBeInTheDocument();
  });

  it('öffnet als Mannschaftsführer „Aufstellung teilen"', async () => {
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    await userEvent.click(screen.getByRole('button', { name: /Aufstellung teilen/ }));

    expect(await screen.findByRole('dialog', { name: 'Aufstellung teilen' })).toBeInTheDocument();
  });

  it('zeigt einem Administrator die Knöpfe auch ohne eigene Mannschaft', async () => {
    sessionState.role = 'admin';
    state.tables.team_leaders = [];
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    await userEvent.click(screen.getByRole('button', { name: /Spieler verwalten/ }));
    expect(await screen.findByRole('dialog', { name: 'Spieler verwalten' })).toBeInTheDocument();
  });

  it('zeigt einem Mitglied ohne Mannschaftsführung keine Knöpfe', async () => {
    sessionState.role = 'member';
    state.tables.team_leaders = [];
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    expect(screen.queryByRole('button', { name: /Spieler verwalten/ })).toBeNull();
  });

  it('filtert Heim- und Auswärtsspiele', async () => {
    renderWith(<MyGamesPage />);
    await screen.findByText(/1\. Herren gegen/);

    await userEvent.click(screen.getByRole('button', { name: 'Auswärts' }));

    expect(await screen.findByText('Keine offenen Spiele')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------ Spieler verwalten

describe('ManagePlayersDialog', () => {
  function renderDialog() {
    return renderWith(
      <ManagePlayersDialog
        open
        onOpenChange={() => {}}
        match={upcoming}
        team={team}
        members={
          [
            { id: 'p-me', full_name: 'Meik Mannschaft', qttr: 1680 },
            { id: 'p-tina', full_name: 'Tina Trainerin', qttr: 1710 },
            { id: 'p-theo', full_name: 'Theo Trainer', qttr: 1530 },
            { id: 'p-olaf', full_name: 'Olaf Organisator', qttr: 1450 },
            { id: 'p-uwe', full_name: 'Uwe Unklar', qttr: 1390 },
            { id: 'p-neu', full_name: 'Nina Neu', qttr: null },
          ] as never
        }
      />,
    );
  }

  it('gliedert die Spieler in die Abschnitte des TT-Planers', async () => {
    renderDialog();

    expect(await screen.findByText(/^Aufstellung \(2\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^Offene Spieler \(1\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^Spieler Absagen \(1\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^Spieler noch unklar \(1\)$/)).toBeInTheDocument();
  });

  it('zeigt den Fortschritt der Besetzung', async () => {
    renderDialog();
    expect(await screen.findByText('2 / 4 Spieler besetzt')).toBeInTheDocument();
  });

  it('nimmt einen Spieler mit der richtigen Aktion heraus', async () => {
    renderDialog();
    await screen.findByText(/^Aufstellung \(2\)$/);

    // Die sortierbare Liste der Aufstellung wird nachgeladen.
    await userEvent.click(
      await screen.findByRole('button', { name: 'Tina Trainerin vorerst entfernen' }),
    );

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_manage_player',
        args: { p_match_id: 'm-1', p_profile_id: 'p-tina', p_action: 'remove' },
      }),
    );
  });

  it('fügt einen offenen Spieler hinzu', async () => {
    renderDialog();
    await screen.findByText(/^Offene Spieler \(1\)$/);

    await userEvent.click(screen.getByRole('button', { name: 'Theo Trainer hinzufügen' }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_manage_player',
        args: { p_match_id: 'm-1', p_profile_id: 'p-theo', p_action: 'add' },
      }),
    );
  });

  it('setzt eine Absage zurück', async () => {
    renderDialog();
    await screen.findByText(/^Spieler Absagen \(1\)$/);

    await userEvent.click(
      screen.getByRole('button', { name: 'Status von Olaf Organisator zurücksetzen' }),
    );

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_manage_player',
        args: { p_match_id: 'm-1', p_profile_id: 'p-olaf', p_action: 'reset' },
      }),
    );
  });

  it('erklärt die Aktionen im Wortlaut des TT-Planers', async () => {
    renderDialog();
    expect(
      await screen.findByText(
        'Fügt den Spieler beim Spiel hinzu und informiert diesen per E-Mail darüber',
      ),
    ).toBeInTheDocument();
  });

  it('bietet Mitglieder außerhalb des Kaders zum Hinzufügen an', async () => {
    renderDialog();
    expect(
      await screen.findByText('Andere Spieler (ohne Mannschaftszuordnung)'),
    ).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------ Teilen

describe('ShareLineupDialog', () => {
  /** `full` = genug Zusagen; dann greift die vollständige Vorlage mit Halle und Fahrern. */
  function renderDialog(full = false) {
    return renderWith(
      <ShareLineupDialog
        open
        onOpenChange={() => {}}
        match={upcoming}
        team={team}
        venue={
          {
            id: 'v-1',
            name: 'Sporthalle Musterstadt',
            address: 'Turnstraße 5',
            postal_code: '12345',
            city: 'Musterstadt',
          } as never
        }
        participations={
          full
            ? [
                participation({ profile_id: 'p-me', response: 'yes', lineup_position: 1 }),
                participation({ profile_id: 'p-tina', response: 'yes', lineup_position: 2 }),
                participation({ profile_id: 'p-theo', response: 'yes', lineup_position: 3 }),
                participation({ profile_id: 'p-olaf', response: 'yes', lineup_position: 4 }),
              ]
            : [
                participation({ profile_id: 'p-me', response: 'yes', lineup_position: 1 }),
                participation({ profile_id: 'p-tina', response: 'yes', lineup_position: 2 }),
              ]
        }
        volunteers={[{ match_id: 'm-1', profile_id: 'p-me', kind: 'driver' } as never]}
        nameOf={(id) =>
          ({
            'p-me': 'Meik Mannschaft',
            'p-tina': 'Tina Trainerin',
            'p-theo': 'Theo Trainer',
            'p-olaf': 'Olaf Organisator',
          })[id] ?? 'Unbekannt'
        }
      />,
    );
  }

  it('nennt Gegner, Halle, Aufstellung und Fahrer, sobald genug zugesagt haben', async () => {
    renderDialog(true);

    const text = (await screen.findByLabelText('Aufstellungstext')).textContent ?? '';
    expect(text).toContain('TTC Nachbarstadt');
    expect(text).toContain('Sporthalle Musterstadt, Turnstraße 5, 12345 Musterstadt');
    expect(text).toContain('Aufstellung: Meik, Tina, Theo, Olaf');
    expect(text).toContain('Fahrer: Meik');
    expect(text).toContain('Bitte helle Trikots mitbringen.');
  });

  it('weist auf fehlende Spieler hin, wenn noch welche fehlen', async () => {
    renderDialog();

    const text = (await screen.findByLabelText('Aufstellungstext')).textContent ?? '';
    expect(text).toContain('fehlen uns noch 2 Spieler');
  });

  it('kopiert den Text in die Zwischenablage', async () => {
    renderDialog(true);
    await screen.findByLabelText('Aufstellungstext');

    await userEvent.click(screen.getByRole('button', { name: /In Zwischenablage kopieren/ }));

    await waitFor(() => expect(state.copied).toHaveLength(1));
    expect(state.copied[0]).toContain('TTC Nachbarstadt');
    expect(await screen.findByText('Kopiert')).toBeInTheDocument();
  });

  it('verschickt den Text an die Aufgestellten', async () => {
    renderDialog(true);
    await screen.findByLabelText('Aufstellungstext');

    await userEvent.click(
      screen.getByRole('button', { name: /Per E-Mail an die Aufstellung senden/ }),
    );

    await waitFor(() =>
      expect(state.rpcCalls.some((call) => call.name === 'rpc_share_lineup')).toBe(true),
    );

    const call = state.rpcCalls.find((entry) => entry.name === 'rpc_share_lineup')!;
    expect((call.args as { p_match_id: string; p_text: string }).p_match_id).toBe('m-1');
    expect((call.args as { p_text: string }).p_text).toContain('TTC Nachbarstadt');
  });
});

// ------------------------------------------------------------------ Offen für dich

// Fehlerbild vom 23.09.2026, zweiter Teil: Die Übersicht öffnet mit „Offen", und dort
// stand das eigene Spiel nur mit Zusage/Absage — ohne die Knöpfe des Mannschaftsführers.
describe('OpenItemsList', () => {
  beforeEach(() => {
    state.tables.v_open_participations = [
      {
        profile_id: 'p-me',
        kind: 'match',
        id: 'm-1',
        starts_at: '2026-10-08T17:30:00Z',
        title: '1. Herren gegen TTC Nachbarstadt',
      },
    ];
    state.tables.v_my_open_polls = [];
  });

  it('bietet dem Mannschaftsführer auch hier Spieler verwalten und Aufstellung teilen', async () => {
    renderWith(<OpenItemsList />);
    await screen.findByText('1. Herren gegen TTC Nachbarstadt');

    await userEvent.click(await screen.findByRole('button', { name: /Aufstellung teilen/ }));
    expect(await screen.findByRole('dialog', { name: 'Aufstellung teilen' })).toBeInTheDocument();
  });

  it('zeigt die Knöpfe nicht, wer die Mannschaft nicht führt', async () => {
    sessionState.role = 'member';
    state.tables.team_leaders = [];
    renderWith(<OpenItemsList />);
    await screen.findByText('1. Herren gegen TTC Nachbarstadt');

    expect(screen.queryByRole('button', { name: /Spieler verwalten/ })).toBeNull();
  });
});
