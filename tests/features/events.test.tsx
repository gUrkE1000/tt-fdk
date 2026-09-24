import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  rpcCalls: [] as { name: string; args: unknown }[],
  rpcResult: { status: 'ok' } as Record<string, unknown>,
  inserts: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; values: unknown[] }[],
};

function makeBuilder(table: string) {
  const touched: unknown[] = [];
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    is: () => chain,
    eq: (_column: string, value: unknown) => {
      touched.push(value);
      return chain;
    },
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return {
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => {
      state.deletes.push({ table, values: touched });
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
      return Promise.resolve({ data: state.rpcResult, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

const profile = { id: 'p-01', full_name: 'Spieler 01', role: 'organizer', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile,
    role: 'organizer',
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import EventsPage from '../../src/features/events/EventsPage';
import EventPage from '../../src/features/events/EventPage';
import { ToastProvider } from '../../src/components/ui';
import {
  EMPTY_EVENT,
  EMPTY_EVENT_FILTERS,
  eventSchema,
  filterEvents,
  isFinishedEvent,
  isRegistrationOpen,
} from '../../src/features/events/schemas';

const future = new Date(Date.now() + 20 * 86_400_000).toISOString();
const past = new Date(Date.now() - 20 * 86_400_000).toISOString();

const upcoming = {
  id: 'e-1',
  name: 'Clubmeisterschaft',
  full_day: false,
  starts_at: future,
  ends_at: null,
  participate_until: null,
  max_participants: 4,
  address: 'Turnstraße 5',
  description_html: '<p>Meldung ab <strong>9:30 Uhr</strong>.</p>',
  hide_in_my_club: false,
  exclude_calendar: false,
  created_by: 'p-olaf',
  reminder_sent_at: null,
  created_at: past,
  updated_at: past,
};

const finished = { ...upcoming, id: 'e-2', name: 'Jahreshauptversammlung', starts_at: past };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <EventsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    club_events: [upcoming, finished],
    v_event_participants: [
      {
        event_id: 'e-1',
        profile_id: 'p-02',
        full_name: 'Spieler 02',
        status: 'yes',
        guests: 1,
        updated_at: past,
      },
    ],
  };
  state.rpcCalls = [];
  state.rpcResult = { status: 'ok' };
  state.inserts = [];
  state.deletes = [];
});

// ------------------------------------------------------------------ reine Logik

describe('Termin-Schema', () => {
  it('verlangt einen Namen und ein Datum', () => {
    const result = eventSchema.safeParse(EMPTY_EVENT);
    expect(result.success).toBe(false);
  });

  it('verlangt eine Uhrzeit, wenn der Termin nicht ganztägig ist', () => {
    const result = eventSchema.safeParse({
      ...EMPTY_EVENT,
      name: 'Fest',
      startDate: '2026-10-10',
      startTime: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/ganztägig/);
    }
  });

  it('lässt einen ganztägigen Termin ohne Uhrzeit zu', () => {
    expect(
      eventSchema.safeParse({
        ...EMPTY_EVENT,
        name: 'Fest',
        startDate: '2026-10-10',
        startTime: '',
        fullDay: true,
      }).success,
    ).toBe(true);
  });

  it('weist ein Ende vor dem Anfang zurück', () => {
    const result = eventSchema.safeParse({
      ...EMPTY_EVENT,
      name: 'Fest',
      startDate: '2026-10-10',
      endDate: '2026-10-01',
    });
    expect(result.success).toBe(false);
  });

  it('weist eine Anmeldefrist nach dem Termin zurück', () => {
    const result = eventSchema.safeParse({
      ...EMPTY_EVENT,
      name: 'Fest',
      startDate: '2026-10-10',
      participateUntil: '2026-10-20',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Anmeldefrist liegt nach/);
    }
  });
});

describe('filterEvents', () => {
  const rows = [upcoming, finished];

  it('sucht in Name und Ort', () => {
    expect(filterEvents(rows, { ...EMPTY_EVENT_FILTERS, search: 'club' })).toHaveLength(1);
    expect(filterEvents(rows, { ...EMPTY_EVENT_FILTERS, search: 'turnstraße' })).toHaveLength(2);
    expect(filterEvents(rows, { ...EMPTY_EVENT_FILTERS, search: 'nichts' })).toHaveLength(0);
  });

  it('grenzt den Zeitraum einschließlich ein', () => {
    const day = upcoming.starts_at.slice(0, 10);
    expect(filterEvents(rows, { ...EMPTY_EVENT_FILTERS, from: day, to: day })).toHaveLength(1);
  });

  it('lässt ohne Filter alles durch', () => {
    expect(filterEvents(rows, EMPTY_EVENT_FILTERS)).toHaveLength(2);
  });
});

describe('isFinishedEvent', () => {
  it('nimmt das Ende, wenn es eins gibt', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(
      isFinishedEvent({ starts_at: '2026-10-10T09:00:00Z', ends_at: '2026-10-10T18:00:00Z' }, now),
    ).toBe(false);
  });

  it('nimmt sonst den Beginn', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(isFinishedEvent({ starts_at: '2026-10-10T09:00:00Z', ends_at: null }, now)).toBe(true);
  });
});

describe('isRegistrationOpen', () => {
  const now = new Date('2026-10-01T12:00:00Z');

  it('ist offen ohne Frist', () => {
    expect(
      isRegistrationOpen({ starts_at: '2026-10-10T18:00:00Z', participate_until: null }, now),
    ).toBe(true);
  });

  it('schließt am Tag nach der Frist', () => {
    expect(
      isRegistrationOpen(
        { starts_at: '2026-10-10T18:00:00Z', participate_until: '2026-10-01' },
        now,
      ),
    ).toBe(true);
    expect(
      isRegistrationOpen(
        { starts_at: '2026-10-10T18:00:00Z', participate_until: '2026-09-30' },
        now,
      ),
    ).toBe(false);
  });

  it('schließt mit dem Beginn', () => {
    expect(
      isRegistrationOpen({ starts_at: '2026-09-30T18:00:00Z', participate_until: null }, now),
    ).toBe(false);
  });
});

// ------------------------------------------------------------------ Seite

describe('EventsPage', () => {
  it('trennt offene und beendete Termine', async () => {
    renderPage();

    expect(await screen.findByRole('tab', { name: 'Offene Termine (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Beendete Termine (1)' })).toBeInTheDocument();
  });

  it('zeigt die Details als Text, nicht als Markup', async () => {
    renderPage();

    expect(await screen.findByText('Clubmeisterschaft')).toBeInTheDocument();
    expect(screen.getByText('9:30 Uhr')).toBeInTheDocument();
  });

  it('zählt Teilnehmer samt Gästen gegen die Grenze', async () => {
    renderPage();
    expect(await screen.findByText('2 / 4 Teilnehmer')).toBeInTheDocument();
  });

  it('speichert eine Zusage über die Datenbankfunktion', async () => {
    renderPage();
    await screen.findByText('Clubmeisterschaft');

    await userEvent.click(screen.getByRole('button', { name: 'Zusage' }));

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_set_event_participation',
        args: { p_event_id: 'e-1', p_status: 'yes', p_guests: 0 },
      }),
    );
  });

  it('sagt es, wenn der Termin voll ist', async () => {
    state.rpcResult = { status: 'full' };
    renderPage();
    await screen.findByText('Clubmeisterschaft');

    await userEvent.click(screen.getByRole('button', { name: 'Zusage' }));

    expect(await screen.findByText('Der Termin ist voll.')).toBeInTheDocument();
  });

  it('sagt es, wenn die Anmeldefrist vorbei ist', async () => {
    state.rpcResult = { status: 'closed' };
    renderPage();
    await screen.findByText('Clubmeisterschaft');

    await userEvent.click(screen.getByRole('button', { name: 'Zusage' }));

    expect(await screen.findByText('Die Anmeldefrist ist vorbei.')).toBeInTheDocument();
  });

  it('warnt vor dem Löschen, dass die Rückmeldungen mitgehen', async () => {
    renderPage();
    await screen.findByText('Clubmeisterschaft');

    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]);

    expect(await screen.findByText(/alle Zu- und Absagen dazu/)).toBeInTheDocument();
    expect(state.deletes).toHaveLength(0);
  });

  it('filtert die Liste nach der Suche', async () => {
    renderPage();
    await screen.findByText('Clubmeisterschaft');

    await userEvent.type(screen.getByPlaceholderText('Name oder Ort'), 'jahres');

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Offene Termine (0)' })).toBeInTheDocument(),
    );
  });
});

// ------------------------------------------------------------------ Seite eines Termins

describe('EventPage', () => {
  function renderEvent(id: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/event/${id}`]}>
            <Routes>
              <Route path="/event/:eventId" element={<EventPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('zeigt genau diesen Vereinstermin mit Zu- und Absage', async () => {
    renderEvent('e-1');
    expect(await screen.findByRole('heading', { name: upcoming.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zusage/ })).toBeInTheDocument();
  });

  it('sagt es, wenn es den Termin nicht gibt', async () => {
    renderEvent('weg');
    expect(
      await screen.findByText('Diesen Vereinstermin gibt es nicht (mehr)'),
    ).toBeInTheDocument();
  });
});
