import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  calendarDaysUntil,
  countOpenResponses,
  matchCountdown,
  parseQuicklinks,
} from '../../src/features/dashboard/summary';
import { countdownLabel } from '../../src/features/dashboard/CountdownTile';
import type { MatchRow, Participation } from '../../src/features/matches/api';

// ---------------------------------------------------------------- Testdaten

const NOW = new Date('2026-10-01T12:00:00+02:00');

function match(overrides: Partial<MatchRow> & { id: string; dtstart: string }): MatchRow {
  return {
    team_id: 't-1',
    source: 'ics',
    external_uid: null,
    summary: '',
    opponent: 'TTC Nachbarstadt',
    league: '',
    description: '',
    location_text: '',
    venue_id: null,
    is_home: true,
    dtstart_external: overrides.dtstart,
    dtend_external: overrides.dtstart,
    dtstart_override: null,
    dtend_override: null,
    dtend: overrides.dtstart,
    required_players: 6,
    supervisor_id: null,
    comment: '',
    nuscore_code: null,
    nuscore_pin: null,
    matchday: null,
    version: 1,
    active: true,
    cancel_reason: null,
    lineup_locked: false,
    last_synced_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    confirmedCount: 0,
    ...overrides,
  } as MatchRow;
}

function part(overrides: Partial<Participation> & { match_id: string; profile_id: string }): Participation {
  return {
    response: 'none',
    version_responded: null,
    lineup_position: null,
    removed: false,
    comment: '',
    source: 'roster',
    updated_by: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  } as Participation;
}

// ---------------------------------------------------------------- reine Logik

describe('calendarDaysUntil', () => {
  it('zählt Kalendertage, nicht 24-Stunden-Blöcke', () => {
    // Heute Abend ist „heute", auch wenn es noch acht Stunden hin ist.
    expect(calendarDaysUntil('2026-10-01T20:00:00+02:00', NOW)).toBe(0);
    // Morgen früh ist „morgen", auch wenn es nur zehn Stunden sind.
    expect(calendarDaysUntil('2026-10-02T08:00:00+02:00', NOW)).toBe(1);
  });

  it('rechnet über einen Monatswechsel hinweg', () => {
    expect(calendarDaysUntil('2026-11-01T18:00:00+01:00', NOW)).toBe(31);
  });
});

describe('countdownLabel', () => {
  it('sagt heute, morgen und den Rest in Tagen', () => {
    expect(countdownLabel(0)).toBe('Heute');
    expect(countdownLabel(1)).toBe('Morgen');
    expect(countdownLabel(5)).toBe('In 5 Tagen');
    expect(countdownLabel(null)).toBe('Kein Spiel angesetzt');
  });
});

describe('matchCountdown', () => {
  const matches = [
    match({ id: 'm-1', dtstart: '2026-10-04T18:00:00+02:00' }),
    match({ id: 'm-2', dtstart: '2026-10-20T18:00:00+02:00' }),
    match({ id: 'm-3', dtstart: '2026-12-01T18:00:00+01:00' }),
    match({ id: 'm-past', dtstart: '2026-09-01T18:00:00+02:00' }),
  ];
  const mine = [
    part({ match_id: 'm-1', profile_id: 'p-1' }),
    part({ match_id: 'm-2', profile_id: 'p-1' }),
    part({ match_id: 'm-3', profile_id: 'p-1' }),
    part({ match_id: 'm-past', profile_id: 'p-1' }),
  ];

  it('findet das nächste eigene Spiel', () => {
    const result = matchCountdown(matches, mine, 'p-1', NOW);
    expect(result.next?.id).toBe('m-1');
    expect(result.days).toBe(3);
  });

  it('zählt nur die nächsten 30 Tage in die Badge', () => {
    const result = matchCountdown(matches, mine, 'p-1', NOW);
    expect(result.within30).toBe(2);
    expect(result.total).toBe(3);
  });

  it('übergeht vergangene Spiele', () => {
    const result = matchCountdown(matches, mine, 'p-1', NOW);
    expect(result.total).toBe(3);
  });

  it('übergeht abgesagte Spiele', () => {
    const cancelled = [match({ id: 'm-1', dtstart: '2026-10-04T18:00:00+02:00', active: false })];
    const result = matchCountdown(cancelled, mine, 'p-1', NOW);
    expect(result.next).toBeNull();
    expect(result.days).toBeNull();
  });

  it('zählt keine Spiele, aus deren Kader ich gestrichen wurde', () => {
    const removed = [part({ match_id: 'm-1', profile_id: 'p-1', removed: true })];
    expect(matchCountdown(matches, removed, 'p-1', NOW).total).toBe(0);
  });

  it('zählt keine fremden Spiele', () => {
    expect(matchCountdown(matches, mine, 'p-2', NOW).total).toBe(0);
  });

  it('bleibt ohne Anmeldung leer', () => {
    expect(matchCountdown(matches, mine, null, NOW)).toEqual({
      next: null,
      days: null,
      within30: 0,
      total: 0,
    });
  });
});

describe('countOpenResponses', () => {
  const matches = [
    match({ id: 'm-1', team_id: 't-1', dtstart: '2026-10-04T18:00:00+02:00', version: 2 }),
    match({ id: 'm-2', team_id: 't-2', dtstart: '2026-10-05T18:00:00+02:00' }),
    match({ id: 'm-past', team_id: 't-1', dtstart: '2026-09-01T18:00:00+02:00' }),
  ];

  const participations = [
    // ohne Antwort
    part({ match_id: 'm-1', profile_id: 'p-1' }),
    // hat geantwortet, aber auf die alte Fassung
    part({ match_id: 'm-1', profile_id: 'p-2', response: 'yes', version_responded: 1 }),
    // hat auf die aktuelle Fassung geantwortet
    part({ match_id: 'm-1', profile_id: 'p-3', response: 'no', version_responded: 2 }),
    // gestrichen — von dem will niemand mehr etwas hören
    part({ match_id: 'm-1', profile_id: 'p-4', removed: true }),
    // anderes Spiel, andere Mannschaft
    part({ match_id: 'm-2', profile_id: 'p-5' }),
    // vergangenes Spiel
    part({ match_id: 'm-past', profile_id: 'p-6' }),
  ];

  it('zählt fehlende und veraltete Rückmeldungen', () => {
    expect(countOpenResponses(matches, participations, null, NOW)).toEqual({
      players: 3,
      matches: 2,
    });
  });

  it('grenzt den Mannschaftsführer auf seine Mannschaften ein', () => {
    expect(countOpenResponses(matches, participations, new Set(['t-1']), NOW)).toEqual({
      players: 2,
      matches: 1,
    });
  });

  it('lässt vergangene Spiele draußen', () => {
    expect(countOpenResponses(matches, participations, new Set(['t-1']), NOW).matches).toBe(1);
  });

  it('meldet null, wenn alle geantwortet haben', () => {
    const answered = [
      part({ match_id: 'm-2', profile_id: 'p-5', response: 'yes', version_responded: 1 }),
    ];
    expect(countOpenResponses(matches, answered, new Set(['t-2']), NOW)).toEqual({
      players: 0,
      matches: 0,
    });
  });
});

describe('parseQuicklinks', () => {
  it('liest Beschriftung und Adresse', () => {
    expect(parseQuicklinks('[{"label":"Tabelle","url":"https://example.org/t"}]')).toEqual([
      { label: 'Tabelle', url: 'https://example.org/t' },
    ]);
  });

  it('verschluckt kaputtes JSON, statt die Startseite mitzureißen', () => {
    expect(parseQuicklinks('[{label: Tabelle}')).toEqual([]);
    expect(parseQuicklinks('')).toEqual([]);
    expect(parseQuicklinks(null)).toEqual([]);
    expect(parseQuicklinks('{"label":"x"}')).toEqual([]);
  });

  it('lässt nur http und https durch', () => {
    const raw = JSON.stringify([
      { label: 'Böse', url: 'javascript:alert(1)' },
      { label: 'Auch böse', url: 'data:text/html,<script>' },
      { label: 'Gut', url: 'http://example.org' },
    ]);
    expect(parseQuicklinks(raw)).toEqual([{ label: 'Gut', url: 'http://example.org' }]);
  });

  it('überspringt unvollständige Einträge', () => {
    const raw = JSON.stringify([{ label: '', url: 'https://example.org' }, { url: 'https://x.org' }, 42]);
    expect(parseQuicklinks(raw)).toEqual([]);
  });
});

// ---------------------------------------------------------------- Seite

interface Row {
  [key: string]: unknown;
}

const state = { tables: {} as Record<string, Row[]>, role: 'member' as string };

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    eq: () => chain,
    is: () => chain,
    gte: () => chain,
    lte: () => chain,
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: state.tables[table] ?? [], error: null }),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
  FUNCTIONS_URL: 'http://localhost:54321/functions/v1',
}));

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: { id: 'p-1', first_name: 'Anna', full_name: 'Anna Beispiel', status: 'active' },
    role: state.role,
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DashboardPage from '../../src/features/dashboard/DashboardPage';
import { ToastProvider } from '../../src/components/ui';

const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString();
const inFortyDays = new Date(Date.now() + 40 * 86_400_000).toISOString();
const tomorrow = new Date(Date.now() + 86_400_000);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.role = 'member';
  state.tables = {
    profiles: [{ id: 'p-1', full_name: 'Anna Beispiel' }],
    venues: [{ id: 'v-1', name: 'Sporthalle Musterstadt' }],
    teams: [{ id: 't-1', name: '2. Herren', sort_order: 1 }],
    team_leaders: [],
    team_members: [{ team_id: 't-1', profile_id: 'p-1', kind: 'regular', rank: 1 }],
    matches: [
      {
        id: 'm-1',
        team_id: 't-1',
        opponent: 'TTC Nachbarstadt',
        dtstart: inThreeDays,
        dtend: inThreeDays,
        venue_id: 'v-1',
        is_home: true,
        active: true,
        version: 1,
        required_players: 6,
      },
      {
        id: 'm-2',
        team_id: 't-1',
        opponent: 'TTC Fernstadt',
        dtstart: inFortyDays,
        dtend: inFortyDays,
        venue_id: 'v-1',
        is_home: false,
        active: true,
        version: 1,
        required_players: 6,
      },
    ],
    match_participations: [
      { match_id: 'm-1', profile_id: 'p-1', response: 'none', removed: false },
      { match_id: 'm-2', profile_id: 'p-1', response: 'none', removed: false },
    ],
    trainings: [
      {
        id: 'tr-1',
        name: 'Erwachsenentraining',
        active: true,
        is_open: false,
        trainer_invites_only: false,
        weekday: 2,
        time_start: '19:00',
        rhythm: 'weekly',
      },
      {
        id: 'tr-2',
        name: 'Offenes Training',
        active: true,
        is_open: true,
        trainer_invites_only: false,
        weekday: 4,
        time_start: '18:00',
        rhythm: 'weekly',
      },
    ],
    training_trainers: [],
    training_members: [{ training_id: 'tr-1', profile_id: 'p-1' }],
    training_statistics_groups: [],
    training_sessions: [
      {
        id: 's-1',
        training_id: 'tr-1',
        session_date: tomorrow.toISOString().slice(0, 10),
        starts_at: tomorrow.toISOString(),
        ends_at: tomorrow.toISOString(),
        cancelled: false,
      },
      {
        id: 's-2',
        training_id: 'tr-2',
        session_date: tomorrow.toISOString().slice(0, 10),
        starts_at: tomorrow.toISOString(),
        ends_at: tomorrow.toISOString(),
        cancelled: false,
      },
    ],
    v_session_participants: [],
    v_session_counts: [],
    club_settings: [
      {
        key: 'quicklinks_json',
        value: JSON.stringify([{ label: 'Tabelle & Spielplan', url: 'https://example.org/tabelle' }]),
      },
    ],
  };
});

describe('DashboardPage', () => {
  it('begrüßt mit dem Vornamen', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Hallo Anna' })).toBeInTheDocument();
  });

  it('zählt den nächsten Spieltermin herunter', async () => {
    renderPage();
    expect(await screen.findByText('In 3 Tagen')).toBeInTheDocument();
    expect(screen.getByText('2. Herren gegen TTC Nachbarstadt')).toBeInTheDocument();
    expect(screen.getByText('Sporthalle Musterstadt')).toBeInTheDocument();
  });

  it('nennt die Zahl der Spiele in den nächsten 30 Tagen', async () => {
    renderPage();
    expect(await screen.findByText('1 Spiel in den nächsten 30 Tagen')).toBeInTheDocument();
  });

  it('zeigt die Reiter mit ihren Zahlen', async () => {
    renderPage();
    // Ein eigenes Training plus das offene, zu dem jeder eingeladen ist.
    expect(await screen.findByRole('tab', { name: 'Trainings (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Spiele (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Offene Trainings (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kalender' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Schlüssel' })).toBeInTheDocument();
  });

  it('verlinkt die Quicklinks nach außen', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: /Tabelle & Spielplan/ });
    expect(link).toHaveAttribute('href', 'https://example.org/tabelle');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('zeigt einem Mitglied keine offenen Rückmeldungen', async () => {
    renderPage();
    await screen.findByText('In 3 Tagen');
    expect(screen.queryByText('Offene Rückmeldungen')).toBeNull();
  });

  it('zeigt dem Administrator die offenen Rückmeldungen', async () => {
    state.role = 'admin';
    renderPage();
    expect(await screen.findByText('Offene Rückmeldungen')).toBeInTheDocument();
    expect(await screen.findByText('Spieler bei 2 Spielen')).toBeInTheDocument();
  });
});
