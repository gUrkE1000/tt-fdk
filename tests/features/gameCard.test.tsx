import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Eine offene Terminumfrage zu m-1 — für die Frage, wer darüber abstimmen darf.
const tables: Record<string, unknown[]> = {
  reschedule_polls: [
    {
      id: 'poll-1',
      match_id: 'm-1',
      status: 'open',
      options: ['2026-12-01T18:00:00Z'],
      created_at: '2026-09-01T00:00:00Z',
    },
  ],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    in: () => chain,
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: tables[table] ?? [], error: null }),
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
}));

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: { id: 'p-a', full_name: 'Anna', role: 'member', status: 'active' },
    role: 'member',
    loading: false,
    previousLoginAt: null,
  }),
}));

import GameCard from '../../src/features/matches/GameCard';
import { ToastProvider } from '../../src/components/ui';
import type { MatchRow, Participation, Volunteer } from '../../src/features/matches/api';
import type { Venue } from '../../src/features/venues/api';

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const futureEnd = new Date(Date.now() + 5 * 86_400_000 + 4 * 3_600_000).toISOString();

const match = {
  id: 'm-1',
  team_id: 't-1',
  opponent: 'TTC Nachbarstadt',
  league: 'Bezirksliga',
  location_text: '',
  venue_id: 'v-1',
  is_home: true,
  dtstart: future,
  dtend: futureEnd,
  required_players: 4,
  comment: '',
  nuscore_code: 'ABC123',
  nuscore_pin: '4711',
  version: 1,
  active: true,
} as unknown as MatchRow;

const venue = {
  id: 'v-1',
  name: 'Sporthalle',
  address: 'Turnstraße 5',
  postal_code: '12345',
  city: 'Musterstadt',
} as unknown as Venue;

const part = (profileId: string, response: string): Participation =>
  ({
    match_id: 'm-1',
    profile_id: profileId,
    response,
    version_responded: response === 'none' ? null : 1,
    lineup_position: null,
    removed: false,
    comment: '',
  }) as unknown as Participation;

const names: Record<string, string> = {
  'p-a': 'Anna',
  'p-b': 'Bernd',
  'p-c': 'Carla',
  'p-d': 'Adam Pichler',
  'p-e': 'Anna-Lena Schmidt-Wittgenstein',
};

const inLineup = (profileId: string, position: number): Participation =>
  ({ ...part(profileId, 'yes'), lineup_position: position }) as Participation;

const volunteer = (profileId: string, kind: 'driver' | 'direct'): Volunteer =>
  ({ match_id: 'm-1', profile_id: profileId, kind }) as unknown as Volunteer;

function renderCard(
  participations: Participation[],
  canManage = false,
  volunteers: Volunteer[] = [],
  isHome = true,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <GameCard
            match={{ ...match, is_home: isHome }}
            team={undefined}
            venue={venue}
            participations={participations}
            volunteers={volunteers}
            nameOf={(id) => names[id] ?? ''}
            profileId="p-a"
            canManage={canManage}
          />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('GameCard', () => {
  it('bietet das Fahren an, wer angefragt ist', () => {
    renderCard([part('p-a', 'yes')]);
    expect(screen.getByRole('button', { name: 'Ich kann fahren' })).toBeInTheDocument();
  });

  it('nicht aber dem Verwalter eines Spiels, das nicht seins ist', () => {
    renderCard([part('p-b', 'yes')], true);
    expect(screen.queryByRole('button', { name: 'Ich kann fahren' })).not.toBeInTheDocument();
  });

  it('lässt Angefragte über eine Verlegung abstimmen', async () => {
    renderCard([part('p-a', 'yes')]);
    expect(await screen.findByText(/Wann kannst du\?/)).toBeInTheDocument();
  });

  it('den Verwalter eines fremden Spiels nicht', async () => {
    renderCard([part('p-b', 'yes')], true);
    // Die Umfrage ist geladen, sobald die Karte steht; ein Tick reicht für react-query.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/Wann kannst du\?/)).not.toBeInTheDocument();
  });

  it('zeigt, wer zu-, ab- oder noch nicht geantwortet hat', async () => {
    renderCard([part('p-a', 'yes'), part('p-b', 'no'), part('p-c', 'none')]);

    await userEvent.click(screen.getByText(/Rückmeldungen: 1 zu · 0 unsicher · 1 ab · 1 offen/));

    expect(screen.getByText('Bernd')).toBeInTheDocument();
    expect(screen.getByText('Carla')).toBeInTheDocument();
  });

  it('zeigt Code und PIN für nuScore, wer am Spiel beteiligt ist', () => {
    renderCard([part('p-a', 'yes')]);
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('4711')).toBeInTheDocument();
  });

  it('verbirgt Code und PIN vor Unbeteiligten', () => {
    renderCard([part('p-b', 'yes')]);
    expect(screen.queryByText('ABC123')).toBeNull();
  });

  it('bietet eine Route zur Halle an', () => {
    renderCard([]);
    expect(screen.getByRole('link', { name: /Route/ })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/search/?api=1&query=Turnstra'),
    );
  });

  it('zeigt die Aufstellung mit Vorname und Nachnamen-Initiale', () => {
    renderCard([part('p-a', 'yes'), inLineup('p-d', 1), inLineup('p-e', 2)]);
    const lineup = screen.getByRole('list', { name: 'Aufstellung' });
    expect(lineup).toHaveTextContent('Adam P.');
    expect(lineup).toHaveTextContent('Anna-Lena S.');
    expect(screen.getByText('Adam P.')).toHaveAttribute('title', 'Adam Pichler');
  });

  it('nennt, wer fährt und wer direkt zur Halle fährt', () => {
    renderCard(
      [part('p-a', 'yes')],
      false,
      [volunteer('p-d', 'driver'), volunteer('p-e', 'driver'), volunteer('p-b', 'direct')],
      false,
    );
    expect(screen.getByText(/Fahrer:/).parentElement).toHaveTextContent(
      'Fahrer: Adam P., Anna-Lena S.',
    );
    expect(screen.getByText(/Direkt zur Halle:/).parentElement).toHaveTextContent(
      'Direkt zur Halle: Bernd',
    );
  });

  it('zählt Fahrer ohne bekannten Namen mit, statt sie zu verschweigen', () => {
    renderCard([part('p-a', 'yes')], false, [
      volunteer('p-d', 'driver'),
      volunteer('p-unbekannt', 'driver'),
    ]);
    expect(screen.getByText(/Fahrer:/).parentElement).toHaveTextContent(
      'Fahrer: Adam P., 1 weitere',
    );
  });
});
