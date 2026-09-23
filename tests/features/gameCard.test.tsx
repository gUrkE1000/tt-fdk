import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeBuilder() {
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    in: () => chain,
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: [], error: null }),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: () => makeBuilder(),
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
import type { MatchRow, Participation } from '../../src/features/matches/api';
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

const names: Record<string, string> = { 'p-a': 'Anna', 'p-b': 'Bernd', 'p-c': 'Carla' };

function renderCard(participations: Participation[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <GameCard
            match={match}
            team={undefined}
            venue={venue}
            participations={participations}
            volunteers={[]}
            nameOf={(id) => names[id] ?? ''}
            profileId="p-a"
          />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('GameCard', () => {
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
});
