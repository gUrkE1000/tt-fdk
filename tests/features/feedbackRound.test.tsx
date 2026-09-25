import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
  Rückmeldungsrunde vom 25.09.2026: Spielkarte (Hallensperre, vorerst entfernt,
  Beteiligung, „Ich fahre direkt"), Standardort, eigene Trainingstermine beim
  Systemtraining, Passwort-Auge, „Konto erstellen" und Schlüsseldienst am Termin.
*/

function makeBuilder() {
  const chain = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    in: () => chain,
    gte: () => chain,
    range: () => chain,
    then: (resolve: (value: { data: unknown[]; error: null; count: number }) => unknown) =>
      resolve({ data: [], error: null, count: 0 }),
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
import { findVenueBlock } from '../../src/features/matches/venueBlock';
import { defaultVenueId } from '../../src/features/venues/defaultVenue';
import { isMySession, formatSchedule, isoWeekdayOf } from '../../src/features/trainings/schemas';
import { PasswordInput, ToastProvider } from '../../src/components/ui';
import { RegisterCodeForm } from '../../src/features/auth/LoginPage';
import KeyBearerRow from '../../src/features/trainings/KeyBearerRow';
import type { MatchRow, Participation, Volunteer } from '../../src/features/matches/api';
import type { TeamWithRoster } from '../../src/features/teams/api';
import type { SessionKeys } from '../../src/features/keys/api';
import type { TrainingSession, TrainingWithPeople } from '../../src/features/trainings/api';

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();

const baseMatch = {
  id: 'm-1',
  team_id: 't-1',
  opponent: 'TTC Nachbarstadt',
  league: 'Bezirksliga',
  location_text: '',
  venue_id: null,
  is_home: true,
  dtstart: future,
  dtend: future,
  required_players: 4,
  comment: '',
  nuscore_code: null,
  nuscore_pin: null,
  version: 1,
  active: true,
} as unknown as MatchRow;

const team = {
  id: 't-1',
  name: '1. Herren',
  color: '#1D4ED8',
  leaderIds: [],
  regularIds: ['p-a'],
  substituteIds: [],
  hide_drivers_catering: false,
} as unknown as TeamWithRoster;

const part = (profileId: string, response: string, extra: Partial<Participation> = {}) =>
  ({
    match_id: 'm-1',
    profile_id: profileId,
    response,
    version_responded: response === 'none' ? null : 1,
    lineup_position: null,
    removed: false,
    comment: '',
    ...extra,
  }) as unknown as Participation;

function wrap(ui: React.ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function renderCard(props: Partial<React.ComponentProps<typeof GameCard>> = {}) {
  return wrap(
    <GameCard
      match={baseMatch}
      team={team}
      venue={undefined}
      participations={[]}
      volunteers={[] as Volunteer[]}
      nameOf={(id) => ({ 'p-a': 'Anna', 'p-b': 'Bernd' })[id] ?? ''}
      profileId="p-a"
      {...props}
    />,
  );
}

// ------------------------------------------------------------------ Spielkarte

describe('GameCard nach der Rückmeldungsrunde', () => {
  it('warnt unübersehbar, wenn die Halle am Heimspieltag gesperrt ist', () => {
    renderCard({
      venueBlock: { reason: 'Wasserschaden', from_date: '2026-10-03', to_date: '2026-10-03' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Die Halle ist am 03.10.2026 gesperrt (Wasserschaden). Dieses Heimspiel muss verlegt werden.',
    );
    expect(screen.getByText('Halle gesperrt')).toBeInTheDocument();
  });

  it('sagt einem vorerst entfernten Spieler, dass er nicht aufgestellt ist', () => {
    renderCard({ participations: [part('p-a', 'yes', { removed: true })] });
    expect(
      screen.getByText(/hat dich vorerst aus der Aufstellung genommen/),
    ).toBeInTheDocument();
  });

  it('zählt Entfernte für sich, statt sie verschwinden zu lassen', () => {
    renderCard({
      participations: [part('p-a', 'yes'), part('p-b', 'yes', { removed: true })],
    });
    expect(
      screen.getByText(/Rückmeldungen: 1 zu · 0 unsicher · 0 ab · 0 offen · 1 vorerst entfernt/),
    ).toBeInTheDocument();
  });

  it('bietet Fremden weder „Ich hätte Zeit" noch den Fahrdienst an', () => {
    renderCard({ team: { ...team, regularIds: [] } as TeamWithRoster });
    expect(screen.queryByRole('button', { name: /Ich hätte Zeit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ich kann fahren/ })).toBeNull();
  });

  it('bietet „Ich fahre direkt" nur bei Auswärtsspielen an — ohne Verpflegung', () => {
    const { unmount } = renderCard({ participations: [part('p-a', 'yes')] });
    expect(screen.getByRole('button', { name: /Ich kann fahren/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ich fahre direkt/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /bringe etwas mit/ })).toBeNull();
    unmount();

    renderCard({
      match: { ...baseMatch, is_home: false } as MatchRow,
      participations: [part('p-a', 'yes')],
    });
    expect(screen.getByRole('button', { name: /Ich fahre direkt/ })).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------ Hallensperre

describe('findVenueBlock', () => {
  const block = { venue_id: 'v-1', from_date: '2026-10-03', to_date: '2026-10-04' };
  const match = { ...baseMatch, dtstart: '2026-10-03T17:00:00Z' };

  it('trifft ein Heimspiel ohne eigenen Ort über den Standardort', () => {
    expect(findVenueBlock(match, [block], 'v-1')).toBe(block);
  });

  it('trifft kein Auswärtsspiel und kein Spiel in einer anderen Halle', () => {
    expect(findVenueBlock({ ...match, is_home: false }, [block], 'v-1')).toBeNull();
    expect(findVenueBlock({ ...match, venue_id: 'v-2' }, [block], 'v-1')).toBeNull();
  });

  it('rechnet den Spieltag in deutscher Zeit', () => {
    // 5. Oktober, 0:30 Uhr in Berlin = 4. Oktober, 22:30 UTC
    expect(findVenueBlock({ ...match, dtstart: '2026-10-04T22:30:00Z' }, [block], 'v-1')).toBeNull();
  });
});

describe('defaultVenueId', () => {
  const venues = [
    { id: 'v-1', active: true },
    { id: 'v-2', active: false },
  ];

  it('nimmt den gewählten Standardort, sonst die einzige aktive Halle', () => {
    expect(defaultVenueId('v-2', venues)).toBe('v-2');
    expect(defaultVenueId('', venues)).toBe('v-1');
    expect(defaultVenueId('', [...venues, { id: 'v-3', active: true }])).toBeNull();
  });
});

// ------------------------------------------------------------------ Training

describe('isMySession', () => {
  const open = { id: 'tr-1', is_open: true, is_system: false, memberIds: [], trainerIds: [] };
  const system = { id: 'tr-2', is_open: false, is_system: true, memberIds: ['p-a'], trainerIds: ['p-t'] };

  it('beim Systemtraining zählt die Zuteilung zum Termin, nicht das Training', () => {
    const session = { id: 's-1', training_id: 'tr-2' };
    expect(isMySession(session, system, 'p-a', new Set())).toBe(false);
    expect(isMySession(session, system, 'p-a', new Set(['s-1']))).toBe(true);
    expect(isMySession(session, system, 'p-t', new Set())).toBe(true);
  });

  it('ein offenes Training gehört allen', () => {
    expect(isMySession({ id: 's-2', training_id: 'tr-1' }, open, 'p-x', new Set())).toBe(true);
  });
});

describe('Einmalig', () => {
  it('nennt das Datum statt des Wochentags', () => {
    expect(
      formatSchedule({
        weekday: 6,
        time_start: '10:00:00',
        time_end: '12:00:00',
        rhythm: 'once',
        start_date: '2026-10-17',
      }),
    ).toBe('am 17.10.2026, 10:00–12:00 Uhr');
    expect(isoWeekdayOf('2026-10-17')).toBe(6);
  });
});

// ------------------------------------------------------------------ Anmeldung

describe('PasswordInput', () => {
  it('zeigt das Passwort auf Wunsch im Klartext', async () => {
    wrap(<PasswordInput aria-label="Passwort" defaultValue="geheim" />);
    const field = screen.getByLabelText('Passwort');
    expect(field).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Passwort anzeigen' }));
    expect(field).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Passwort verbergen' }));
    expect(field).toHaveAttribute('type', 'password');
  });
});

describe('Konto erstellen', () => {
  it('führt mit dem Vereinscode zur Registrierung', async () => {
    wrap(
      <Routes>
        <Route path="/login" element={<RegisterCodeForm />} />
        <Route path="/register/:code" element={<p>Registrierung geöffnet</p>} />
      </Routes>,
      '/login',
    );

    const button = screen.getByRole('button', { name: /Weiter zur Registrierung/ });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Vereinscode'), 'TTV2026');
    await userEvent.click(button);
    expect(await screen.findByText('Registrierung geöffnet')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------ Schlüsseldienst

describe('Schlüsseldienst am Trainingstermin', () => {
  const session = {
    id: 's-1',
    training_id: 'tr-1',
    starts_at: future,
    ends_at: future,
    cancelled: false,
  } as unknown as TrainingSession;
  const training = { id: 'tr-1', venue_id: 'v-1', trainerIds: [] } as unknown as TrainingWithPeople;
  const keys = (extra: Partial<SessionKeys>) =>
    ({
      session_id: 's-1',
      has_key_holder: false,
      holder_name: null,
      has_bearer: false,
      bearer_id: null,
      bearer_name: null,
      duty_id: null,
      duty_name: null,
      ...extra,
    }) as SessionKeys;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nennt den Schlüsseldienst des Tages statt „noch niemand"', () => {
    wrap(
      <KeyBearerRow
        session={session}
        training={training}
        keys={keys({ duty_id: 'p-k', duty_name: 'Karl Klein' })}
        profileId="p-a"
      />,
    );
    expect(screen.getByText('Schlüsseldienst: Karl Klein')).toBeInTheDocument();
    expect(screen.queryByText(/Noch niemand bringt den Schlüssel/)).toBeNull();
  });

  it('sagt es dem Schlüsseldienst selbst', () => {
    wrap(
      <KeyBearerRow
        session={session}
        training={training}
        keys={keys({ duty_id: 'p-a', duty_name: 'Anna' })}
        profileId="p-a"
      />,
    );
    expect(screen.getByText('Du hast an diesem Tag Schlüsseldienst.')).toBeInTheDocument();
  });
});
