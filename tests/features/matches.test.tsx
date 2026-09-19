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
  deleted: [] as unknown[],
  invocations: [] as { name: string; body: unknown }[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    not: () => chain,
    in: (_column: string, values: unknown) => {
      state.deleted.push(values);
      return Promise.resolve({ error: null });
    },
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
    delete: () => chain,
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: state.tables[table] ?? [], error: null }),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: (name: string, options: { body: unknown }) => {
        state.invocations.push({ name, body: options.body });
        return Promise.resolve({
          data: {
            status: 'success',
            teams: [
              {
                team: '1. Herren',
                status: 'success',
                inserted: 3,
                rescheduled: 1,
                updated: 0,
                deactivated: 0,
              },
            ],
          },
          error: null,
        });
      },
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

import GamesPage from '../../src/features/matches/GamesPage';
import { ToastProvider } from '../../src/components/ui';
import {
  EMPTY_MATCH_FILTERS,
  filterMatches,
  hasActiveMatchFilters,
  isFinished,
  type MatchFilters,
} from '../../src/features/matches/filters';
import { validateCalendarUrl } from '../../src/features/matches/schemas';
import type { MatchRow } from '../../src/features/matches/api';

function match(overrides: Partial<MatchRow> & { id: string }): MatchRow {
  return {
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
    dtstart_external: '2026-10-05T17:00:00Z',
    dtend_external: '2026-10-05T21:00:00Z',
    dtstart_override: null,
    dtend_override: null,
    dtstart: '2026-10-05T17:00:00Z',
    dtend: '2026-10-05T21:00:00Z',
    required_players: 4,
    supervisor_id: null,
    comment: '',
    nuscore_code: null,
    nuscore_pin: null,
    matchday: 5,
    version: 1,
    active: true,
    cancel_reason: null,
    lineup_locked: false,
    last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    confirmedCount: 0,
    ...overrides,
  } as MatchRow;
}

const homeMatch = match({ id: 'm-1', confirmedCount: 4 });
const awayMatch = match({
  id: 'm-2',
  team_id: 't-2',
  opponent: 'TSV Beispieldorf',
  league: 'Kreisliga',
  is_home: false,
  venue_id: null,
  dtstart: '2026-11-12T18:30:00Z',
  dtend: '2026-11-12T22:30:00Z',
  confirmedCount: 2,
  nuscore_code: 'ABC',
  nuscore_pin: '1234',
});
const movedMatch = match({
  id: 'm-3',
  opponent: 'SC Altstadt',
  dtstart: '2026-10-19T17:00:00Z',
  dtstart_override: '2026-10-19T17:00:00Z',
  confirmedCount: 1,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <GamesPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    matches: [homeMatch, awayMatch, movedMatch] as unknown as Row[],
    // Die Zusagen zählt die Abfrage selbst aus — deshalb hier echte Zeilen statt
    // eines vorgegebenen `confirmedCount`.
    match_participations: [
      { match_id: 'm-1', response: 'yes', removed: false },
      { match_id: 'm-1', response: 'yes', removed: false },
      { match_id: 'm-1', response: 'yes', removed: false },
      { match_id: 'm-1', response: 'yes', removed: false },
      { match_id: 'm-1', response: 'yes', removed: true },
      { match_id: 'm-2', response: 'yes', removed: false },
      { match_id: 'm-2', response: 'no', removed: false },
    ],
    teams: [
      { id: 't-1', name: '1. Herren', size: 4, ranking_type: 'men', color: '#000', active: true, sort_order: 1 },
      { id: 't-2', name: 'Damen', size: 4, ranking_type: 'women', color: '#000', active: true, sort_order: 2 },
    ],
    team_leaders: [],
    team_members: [],
    venues: [{ id: 'v-1', name: 'Sporthalle Musterstadt', active: true, training_only: false }],
    profiles: [],
  };
  state.inserts = [];
  state.updates = [];
  state.deleted = [];
  state.invocations = [];
});

// ------------------------------------------------------------------ Filterlogik

describe('filterMatches', () => {
  const all = [homeMatch, awayMatch, movedMatch];
  const rankingTypes = { 't-1': 'men' as const, 't-2': 'women' as const };

  function withFilters(overrides: Partial<MatchFilters>): MatchFilters {
    return { ...EMPTY_MATCH_FILTERS, ...overrides };
  }

  it('gibt ohne Filter alles zurück', () => {
    expect(filterMatches(all, EMPTY_MATCH_FILTERS, rankingTypes)).toHaveLength(3);
  });

  it('sucht über Gegner, Liga und Halle', () => {
    expect(filterMatches(all, withFilters({ search: 'beispieldorf' }), rankingTypes)).toEqual([
      awayMatch,
    ]);
    expect(filterMatches(all, withFilters({ search: 'kreisliga' }), rankingTypes)).toEqual([
      awayMatch,
    ]);
  });

  it('filtert nach Mannschaft', () => {
    expect(filterMatches(all, withFilters({ teamId: 't-2' }), rankingTypes)).toEqual([awayMatch]);
  });

  it('schließt die Grenzen des Zeitraums ein', () => {
    expect(
      filterMatches(all, withFilters({ from: '2026-10-05', to: '2026-10-05' }), rankingTypes),
    ).toEqual([homeMatch]);
  });

  it('filtert nach Rangtyp über die Mannschaft', () => {
    expect(filterMatches(all, withFilters({ rankingType: 'women' }), rankingTypes)).toEqual([
      awayMatch,
    ]);
  });

  it('filtert nach Spielort', () => {
    expect(filterMatches(all, withFilters({ venueId: 'v-1' }), rankingTypes)).toHaveLength(2);
  });

  it('unterscheidet vollständige von unvollständigen Aufstellungen', () => {
    expect(filterMatches(all, withFilters({ roster: 'complete' }), rankingTypes)).toEqual([
      homeMatch,
    ]);
    expect(filterMatches(all, withFilters({ roster: 'incomplete' }), rankingTypes)).toHaveLength(2);
  });

  it('findet verlegte Termine', () => {
    expect(filterMatches(all, withFilters({ rescheduled: 'only' }), rankingTypes)).toEqual([
      movedMatch,
    ]);
  });

  it('findet Termine ohne Code oder PIN', () => {
    const result = filterMatches(all, withFilters({ missingCode: 'only' }), rankingTypes);
    expect(result).toHaveLength(2);
    expect(result).not.toContain(awayMatch);
  });

  it('kombiniert Filter mit UND', () => {
    expect(
      filterMatches(all, withFilters({ teamId: 't-1', rescheduled: 'only' }), rankingTypes),
    ).toEqual([movedMatch]);
  });

  it('erkennt, ob überhaupt gefiltert wird', () => {
    expect(hasActiveMatchFilters(EMPTY_MATCH_FILTERS)).toBe(false);
    expect(hasActiveMatchFilters(withFilters({ from: '2026-10-01' }))).toBe(true);
  });

  it('trennt beendete von offenen Terminen am Spielende', () => {
    const now = new Date('2026-10-06T00:00:00Z');
    expect(isFinished(homeMatch, now)).toBe(true);
    expect(isFinished(awayMatch, now)).toBe(false);
  });
});

// ------------------------------------------------------------------ Kalenderadresse

describe('validateCalendarUrl', () => {
  it('nimmt eine vollständige myTischtennis-Adresse an', () => {
    expect(
      validateCalendarUrl('https://www.mytischtennis.de/community/exportICSCalendar?teamIds=12345'),
    ).toBeNull();
  });

  it('nimmt auch webcal an', () => {
    expect(
      validateCalendarUrl('webcal://www.mytischtennis.de/community/exportICSCalendar?teamIds=1'),
    ).toBeNull();
  });

  it('verlangt überhaupt eine Eingabe', () => {
    expect(validateCalendarUrl('   ')).toMatch(/Bitte die Kalender-Adresse/);
  });

  it('weist eine Adresse ohne Schema ab', () => {
    expect(validateCalendarUrl('www.mytischtennis.de/exportICSCalendar?teamIds=1')).toMatch(
      /https:\/\/ oder webcal/,
    );
  });

  it('erkennt eine fremde Adresse', () => {
    expect(validateCalendarUrl('https://example.org/kalender.ics')).toMatch(/exportICSCalendar/);
  });

  it('warnt vor dem Gesamtspielplan ohne Mannschaftsangabe', () => {
    expect(
      validateCalendarUrl('https://www.mytischtennis.de/community/exportICSCalendar?clubId=7'),
    ).toMatch(/nicht den Gesamtspielplan/);
  });
});

// ------------------------------------------------------------------ Oberfläche

describe('GamesPage', () => {
  it('trennt offene von beendeten Terminen', async () => {
    renderPage();

    expect(await screen.findByRole('tab', { name: /Offene Termine/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Beendete Termine/ })).toBeInTheDocument();
  });

  it('zeigt Gegner, Liga und den Stand der Aufstellung', async () => {
    renderPage();

    expect(await screen.findAllByText('TTC Nachbarstadt')).not.toHaveLength(0);
    expect(screen.getAllByText(/Bezirksliga · Sporthalle Musterstadt/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('4 / 4').length).toBeGreaterThan(0);
  });

  it('zählt einen herausgenommenen Spieler nicht als Zusage', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    // Fünf Zusagen, eine davon herausgenommen — es bleiben vier.
    expect(screen.getAllByText('4 / 4').length).toBeGreaterThan(0);
  });

  it('kennzeichnet einen verlegten Termin', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    expect(screen.getAllByText(/verlegt, ursprünglich/).length).toBeGreaterThan(0);
  });

  it('filtert nach Mannschaft', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    await userEvent.selectOptions(screen.getByLabelText('Mannschaft'), 't-2');

    await waitFor(() => expect(screen.queryByText('TTC Nachbarstadt')).toBeNull());
  });

  it('blendet die Zusatzfilter erst auf Wunsch ein', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    expect(screen.queryByLabelText('Spielerstand')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Filter hinzufügen/ }));
    expect(screen.getByLabelText('Spielerstand')).toBeInTheDocument();
  });

  it('löscht mehrere Termine nach Rückfrage', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    await userEvent.click(
      screen.getAllByRole('checkbox', { name: /TTC Nachbarstadt auswählen/ })[0],
    );
    expect(screen.getByText('1 ausgewählt')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Löschen/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(state.deleted).toEqual([['m-1']]));
  });

  it('prüft die Kalenderadresse, bevor der Import läuft', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    await userEvent.click(screen.getByRole('button', { name: /Spiele importieren/ }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.selectOptions(within(dialog).getByLabelText(/^Mannschaft/), 't-1');
    await userEvent.type(
      within(dialog).getByLabelText(/Kalender-Adresse/),
      'https://example.org/kalender.ics',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import starten' }));

    expect(await screen.findByText(/exportICSCalendar/)).toBeInTheDocument();
    expect(state.invocations).toHaveLength(0);
  });

  it('speichert die Adresse und stößt den Abgleich an', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    await userEvent.click(screen.getByRole('button', { name: /Spiele importieren/ }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.selectOptions(within(dialog).getByLabelText(/^Mannschaft/), 't-1');
    await userEvent.type(
      within(dialog).getByLabelText(/Kalender-Adresse/),
      'https://www.mytischtennis.de/community/exportICSCalendar?teamIds=12345',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import starten' }));

    await waitFor(() => expect(state.invocations).toHaveLength(1));
    expect(state.updates[0]).toMatchObject({
      table: 'teams',
      values: { webcal_url: 'https://www.mytischtennis.de/community/exportICSCalendar?teamIds=12345' },
    });
    expect(state.invocations[0]).toEqual({ name: 'sync-calendars', body: { teamId: 't-1' } });

    // Nach einem sauberen Lauf stehen die Zahlen in der Meldung und der Dialog ist zu.
    expect(await screen.findByText(/3 neu, 1 verlegt/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('verlangt im Anlegen-Dialog eine Mannschaft und ein Datum', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    await userEvent.click(screen.getByRole('button', { name: /Spiel anlegen/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte eine Mannschaft wählen')).toBeInTheDocument();
    expect(screen.getByText('Bitte ein Datum wählen')).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });

  it('legt einen Spieltermin von Hand an', async () => {
    renderPage();
    await screen.findAllByText('TTC Nachbarstadt');

    await userEvent.click(screen.getByRole('button', { name: /Spiel anlegen/ }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.selectOptions(within(dialog).getByLabelText(/^Mannschaft/), 't-1');
    await userEvent.type(within(dialog).getByLabelText(/^Datum/), '2026-12-05');
    await userEvent.type(within(dialog).getByLabelText('Gegner'), 'SV Musterdorf');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.inserts).toHaveLength(1));
    expect(state.inserts[0]).toMatchObject({
      table: 'matches',
      values: { team_id: 't-1', opponent: 'SV Musterdorf', source: 'manual', required_players: 4 },
    });
  });
});
