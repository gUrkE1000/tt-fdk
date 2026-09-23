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
  inserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; value: unknown }[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
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

const profile = { id: 'p-anna', full_name: 'Anna Admin', role: 'admin', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({ session: null, profile, role: 'admin', loading: false, previousLoginAt: null }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import TrainingsPage from '../../src/features/trainings/TrainingsPage';
import CancellationsPage from '../../src/features/trainings/CancellationsPage';
import { ToastProvider } from '../../src/components/ui';
import {
  EMPTY_CANCELLATION,
  EMPTY_TRAINING,
  cancellationSchema,
  formatSchedule,
  resolveAssignment,
  toTimeInput,
  trainingSchema,
  weekdayLabel,
} from '../../src/features/trainings/schemas';

const training = {
  id: 'tr-1',
  name: 'Erwachsenentraining',
  type: 'adults',
  weekday: 2,
  time_start: '19:00:00',
  time_end: '21:00:00',
  venue_id: 'v-1',
  rhythm: 'weekly',
  start_date: '2026-09-01',
  reminder_hours: 5,
  details: '',
  max_participants: null,
  is_open: false,
  trainer_invites_only: false,
  is_incognito: false,
  requires_key_owner: false,
  skip_public_holidays: true,
  skip_school_holidays: false,
  hide_in_calendar: false,
  auto_cancel_no_trainers: false,
  statistics_visibility: 'admins',
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const openTraining = {
  ...training,
  id: 'tr-2',
  name: 'Offenes Training',
  weekday: 6,
  time_start: '10:00:00',
  time_end: '12:00:00',
  rhythm: 'biweekly',
  is_open: true,
};

function renderPage(ui: React.ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    trainings: [training, openTraining],
    training_trainers: [{ training_id: 'tr-1', profile_id: 'p-tina' }],
    training_members: [
      { training_id: 'tr-1', profile_id: 'p-01' },
      { training_id: 'tr-1', profile_id: 'p-02' },
    ],
    training_statistics_groups: [],
    training_cancellations: [
      {
        id: 'c-1',
        training_id: 'tr-1',
        venue_id: null,
        from_date: '2026-10-20',
        to_date: '2026-10-24',
        reason: 'Herbstferien',
        notify_email: true,
        created_by: 'p-anna',
        created_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'c-2',
        training_id: null,
        venue_id: 'v-1',
        from_date: '2026-11-08',
        to_date: '2026-11-08',
        reason: 'Wahllokal',
        notify_email: false,
        created_by: 'p-anna',
        created_at: '2026-09-01T00:00:00Z',
      },
    ],
    profiles: [
      { id: 'p-tina', full_name: 'Tina Trainerin', qttr: 1710, deleted_at: null },
      { id: 'p-01', full_name: 'Spieler 01', qttr: 1217, deleted_at: null },
      { id: 'p-02', full_name: 'Spieler 02', qttr: 1234, deleted_at: null },
      { id: 'p-03', full_name: 'Spieler 03', qttr: 1251, deleted_at: null },
    ],
    venues: [{ id: 'v-1', name: 'Sporthalle Musterstadt', active: true }],
    groups: [{ id: 'g-1', name: 'Jugend' }],
    group_members: [{ group_id: 'g-1', profile_id: 'p-03' }],
    teams: [{ id: 'te-1', name: '1. Herren', sort_order: 1 }],
    team_leaders: [],
    team_members: [
      { team_id: 'te-1', profile_id: 'p-01', kind: 'regular', rank: null },
      { team_id: 'te-1', profile_id: 'p-03', kind: 'substitute', rank: 1 },
    ],
  };
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
});

// ------------------------------------------------------------------ reine Logik

describe('Trainings-Schema', () => {
  it('verlangt einen Namen', () => {
    expect(trainingSchema.safeParse({ ...EMPTY_TRAINING, name: '  ' }).success).toBe(false);
  });

  it('verlangt ein Startdatum, weil sonst der Rhythmus nicht feststeht', () => {
    const result = trainingSchema.safeParse({ ...EMPTY_TRAINING, name: 'Training' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Startdatum/);
    }
  });

  it('weist ein Ende vor dem Beginn zurück', () => {
    const result = trainingSchema.safeParse({
      ...EMPTY_TRAINING,
      name: 'Training',
      startDate: '2026-09-01',
      timeStart: '19:00',
      timeEnd: '18:00',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Ende liegt vor dem Beginn/);
    }
  });

  it('lässt ein offenes Ende zu', () => {
    expect(
      trainingSchema.safeParse({
        ...EMPTY_TRAINING,
        name: 'Training',
        startDate: '2026-09-01',
        timeEnd: '',
      }).success,
    ).toBe(true);
  });

  it('verlangt Gruppen, wenn die Statistik auf Gruppen eingeschränkt ist', () => {
    const result = trainingSchema.safeParse({
      ...EMPTY_TRAINING,
      name: 'Training',
      startDate: '2026-09-01',
      statisticsVisibility: 'groups',
      statisticsGroupIds: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/mindestens eine Gruppe/);
    }
  });
});

describe('Ausfall-Schema', () => {
  it('verlangt ein Datum', () => {
    expect(
      cancellationSchema.safeParse({ ...EMPTY_CANCELLATION, trainingId: 'tr-1' }).success,
    ).toBe(false);
  });

  it('verlangt beim Hallenausfall einen Ort', () => {
    const result = cancellationSchema.safeParse({
      ...EMPTY_CANCELLATION,
      target: 'venue',
      fromDate: '2026-11-08',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Ort auswählen/);
    }
  });

  it('weist ein Ende vor dem Anfang zurück', () => {
    const result = cancellationSchema.safeParse({
      ...EMPTY_CANCELLATION,
      trainingId: 'tr-1',
      fromDate: '2026-11-08',
      toDate: '2026-11-01',
    });
    expect(result.success).toBe(false);
  });

  it('nimmt einen einzelnen Tag ohne Ende an', () => {
    expect(
      cancellationSchema.safeParse({
        ...EMPTY_CANCELLATION,
        trainingId: 'tr-1',
        fromDate: '2026-11-08',
      }).success,
    ).toBe(true);
  });
});

describe('Anzeige der Trainingszeit', () => {
  it('schreibt Wochentag und Zeitspanne aus', () => {
    expect(formatSchedule(training)).toBe('Dienstag, 19:00–21:00 Uhr');
  });

  it('nennt bei offenem Ende nur den Beginn', () => {
    expect(formatSchedule({ ...training, time_end: null })).toBe('Dienstag, 19:00 Uhr');
  });

  it('kürzt die Sekunden aus der Datenbankzeit', () => {
    expect(toTimeInput('19:00:00')).toBe('19:00');
    expect(toTimeInput(null)).toBe('');
  });

  it('benennt alle sieben Wochentage', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(weekdayLabel)).toEqual([
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
      'Sonntag',
    ]);
  });
});

describe('resolveAssignment', () => {
  const source = {
    teams: { 'te-1': ['p-01', 'p-03'] },
    groups: { 'g-1': ['p-03', 'p-04'] },
  };

  it('legt Mannschaften, Gruppen und Einzelne zu den bisherigen dazu', () => {
    const result = resolveAssignment({
      source,
      teamIds: ['te-1'],
      groupIds: [],
      memberIds: ['p-09'],
      current: ['p-02'],
      replace: false,
    });
    expect(result.sort()).toEqual(['p-01', 'p-02', 'p-03', 'p-09']);
  });

  it('ersetzt die bisherige Zuordnung auf Wunsch', () => {
    const result = resolveAssignment({
      source,
      teamIds: ['te-1'],
      groupIds: [],
      memberIds: [],
      current: ['p-02'],
      replace: true,
    });
    expect(result.sort()).toEqual(['p-01', 'p-03']);
  });

  it('nimmt jeden nur einmal, auch wenn er in Mannschaft und Gruppe steht', () => {
    const result = resolveAssignment({
      source,
      teamIds: ['te-1'],
      groupIds: ['g-1'],
      memberIds: ['p-03'],
      current: [],
      replace: true,
    });
    expect(result.sort()).toEqual(['p-01', 'p-03', 'p-04']);
  });

  it('kommt mit einer unbekannten Mannschaft zurecht', () => {
    expect(
      resolveAssignment({
        source,
        teamIds: ['te-99'],
        groupIds: [],
        memberIds: [],
        current: [],
        replace: true,
      }),
    ).toEqual([]);
  });
});

// ------------------------------------------------------------------ Planungstabelle

describe('TrainingsPage, Tab „Planung“', () => {
  async function openPlanning() {
    renderPage(<TrainingsPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Planung' }));
  }

  it('listet jedes Training mit Zeitpunkt und Rhythmus', async () => {
    await openPlanning();

    expect(await screen.findAllByText('Erwachsenentraining')).not.toHaveLength(0);
    expect(screen.getAllByText('Dienstag, 19:00–21:00 Uhr').length).toBeGreaterThan(0);
    expect(screen.getAllByText('zweiwöchentlich').length).toBeGreaterThan(0);
  });

  it('kennzeichnet ein offenes Training', async () => {
    await openPlanning();
    expect(await screen.findAllByText('offenes Training')).not.toHaveLength(0);
  });

  it('zeigt die Zahl der zugeordneten Mitglieder, bei offenen Trainings stattdessen einen Hinweis', async () => {
    await openPlanning();

    await screen.findAllByText('Erwachsenentraining');
    expect(screen.getAllByText('offen für alle').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tina Trainerin').length).toBeGreaterThan(0);
  });

  it('legt ein Training über den Aktiv-Schalter still', async () => {
    await openPlanning();
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(
      screen.getAllByRole('checkbox', { name: 'Erwachsenentraining aktiv' })[0],
    );

    await waitFor(() =>
      expect(state.updates).toContainEqual({ table: 'trainings', values: { active: false } }),
    );
  });

  it('warnt vor dem Löschen, dass die Rückmeldungen mitgehen', async () => {
    await openPlanning();
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Erwachsenentraining löschen' })[0],
    );

    expect(await screen.findByText(/alle seine Termine und die Rückmeldungen/)).toBeInTheDocument();
    expect(state.deletes).toHaveLength(0);
  });

  it('löscht erst nach der Bestätigung', async () => {
    await openPlanning();
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Erwachsenentraining löschen' })[0],
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Löschen' }));

    await waitFor(() =>
      expect(state.deletes).toContainEqual({ table: 'trainings', value: 'tr-1' }),
    );
  });
});

// ------------------------------------------------------------------ Trainingsdialog

describe('Trainingsdialog', () => {
  async function openDialog() {
    renderPage(<TrainingsPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Planung' }));
    await screen.findAllByText('Erwachsenentraining');
    await userEvent.click(screen.getByRole('button', { name: /Training anlegen/ }));
  }

  it('füllt das Startdatum vor, damit der Rhythmus einen Anker hat', async () => {
    await openDialog();

    const field = await screen.findByLabelText(/Startdatum/);
    expect((field as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('schlägt fünf Stunden Erinnerungsvorlauf vor, wie im TT-Planer', async () => {
    await openDialog();
    await userEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }));

    const field = await screen.findByLabelText(/Wie viele Stunden vor Beginn/);
    expect((field as HTMLInputElement).value).toBe('5');
  });

  it('verbirgt die Statistik-Sichtbarkeit beim Anlegen', async () => {
    await openDialog();
    await userEvent.click(screen.getByRole('tab', { name: 'Einstellungen' }));

    expect(screen.queryByLabelText(/Statistikbereich/)).toBeNull();
  });

  it('speichert ein neues Training mit seinen Schaltern', async () => {
    await openDialog();

    await userEvent.type(screen.getByLabelText(/Name des Trainings/), 'Jugendtraining');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.inserts.some((row) => row.table === 'trainings')).toBe(true));

    const values = state.inserts.find((row) => row.table === 'trainings')!.values as Record<
      string,
      unknown
    >;
    expect(values.name).toBe('Jugendtraining');
    expect(values.reminder_hours).toBe(5);
    expect(values.skip_public_holidays).toBe(true);
    expect(values.time_end).toBeNull();
  });
});

// ------------------------------------------------------------------ Ausfälle

describe('CancellationsPage', () => {
  it('listet Ausfälle je Training und für ganze Hallen', async () => {
    renderPage(<CancellationsPage />, '/trainings/cancellations');

    expect(await screen.findAllByText('Herbstferien')).not.toHaveLength(0);
    expect(screen.getAllByText('Wahllokal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ganze Halle').length).toBeGreaterThan(0);
  });

  it('markiert einen Ausfall, über den per E-Mail informiert wurde', async () => {
    renderPage(<CancellationsPage />, '/trainings/cancellations');
    expect(await screen.findAllByText('per E-Mail gemeldet')).not.toHaveLength(0);
  });

  it('nimmt einen Ausfall erst nach Rückfrage zurück', async () => {
    renderPage(<CancellationsPage />, '/trainings/cancellations');
    await screen.findAllByText('Herbstferien');

    await userEvent.click(screen.getAllByRole('button', { name: /zurücknehmen/ })[0]);

    expect(
      await screen.findByText(/Termine, die ein Trainer von Hand abgesagt hat, bleiben abgesagt/),
    ).toBeInTheDocument();
    expect(state.deletes).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Zurücknehmen' }));

    await waitFor(() =>
      expect(state.deletes).toContainEqual({ table: 'training_cancellations', value: 'c-1' }),
    );
  });
});
