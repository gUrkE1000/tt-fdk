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
  upserts: [] as { table: string; values: unknown }[],
  deletes: [] as { table: string; values: unknown[] }[],
};

function makeBuilder(table: string) {
  const touched: unknown[] = [];
  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    gte: () => chain,
    lte: () => chain,
    eq: (_column: string, value: unknown) => {
      touched.push(value);
      return chain;
    },
    upsert: (values: unknown) => {
      state.upserts.push({ table, values });
      return Promise.resolve({ error: null });
    },
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
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

import AutoAttendanceTab from '../../src/features/profile/AutoAttendanceTab';
import { ToastProvider } from '../../src/components/ui';
import {
  AUTO_ATTENDANCE_HINT,
  autoAttendanceStatus,
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
};

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <AutoAttendanceTab profileId="p-01" />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    trainings: [
      training,
      { ...training, id: 'tr-2', name: 'Fremdes Training' },
      { ...training, id: 'tr-3', name: 'Offenes Training', is_open: true },
      { ...training, id: 'tr-4', name: 'Stillgelegtes Training', active: false },
    ],
    training_trainers: [],
    training_members: [{ training_id: 'tr-1', profile_id: 'p-01' }],
    training_statistics_groups: [],
    training_auto_attendance: [
      { profile_id: 'p-01', training_id: 'tr-1', until_date: '2099-12-31', late: false },
      { profile_id: 'p-01', training_id: 'tr-3', until_date: '2020-01-01', late: true },
    ],
  };
  state.upserts = [];
  state.deletes = [];
});

describe('autoAttendanceStatus', () => {
  it('nennt eine Zusage aktiv, solange das Datum nicht vorbei ist', () => {
    expect(autoAttendanceStatus('2026-12-31', '2026-09-18')).toBe('active');
    expect(autoAttendanceStatus('2026-09-18', '2026-09-18')).toBe('active');
  });

  it('nennt sie abgelaufen, sobald es vorbei ist', () => {
    expect(autoAttendanceStatus('2026-09-17', '2026-09-18')).toBe('expired');
  });
});

describe('AutoAttendanceTab', () => {
  it('zeigt den Hinweistext des TT-Planers wörtlich', async () => {
    renderTab();
    expect(await screen.findByText(AUTO_ATTENDANCE_HINT)).toBeInTheDocument();
  });

  it('listet die eigenen Zusagen mit Status', async () => {
    renderTab();

    expect(await screen.findAllByText('Erwachsenentraining')).not.toHaveLength(0);
    expect(screen.getAllByText('aktiv').length).toBeGreaterThan(0);
    expect(screen.getAllByText('abgelaufen').length).toBeGreaterThan(0);
  });

  it('kennzeichnet eine Zusage mit „Komme später“', async () => {
    renderTab();
    expect(await screen.findAllByText('komme später')).not.toHaveLength(0);
  });

  it('bietet nur Trainings an, zu denen man kommen darf', async () => {
    renderTab();
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(
      screen.getByRole('button', { name: /Automatische Zusage aktivieren/ }),
    );

    const select = await screen.findByLabelText(/^Training/);
    const labels = [...select.querySelectorAll('option')].map((option) => option.textContent);

    expect(labels.some((label) => label?.includes('Erwachsenentraining'))).toBe(true);
    expect(labels.some((label) => label?.includes('Offenes Training'))).toBe(true);
    expect(labels.some((label) => label?.includes('Fremdes Training'))).toBe(false);
    expect(labels.some((label) => label?.includes('Stillgelegtes Training'))).toBe(false);
  });

  it('verlangt Training und Datum', async () => {
    renderTab();
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(
      screen.getByRole('button', { name: /Automatische Zusage aktivieren/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte ein Training auswählen')).toBeInTheDocument();
    expect(state.upserts).toHaveLength(0);
  });

  it('speichert eine neue Zusage', async () => {
    renderTab();
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(
      screen.getByRole('button', { name: /Automatische Zusage aktivieren/ }),
    );

    await userEvent.selectOptions(await screen.findByLabelText(/^Training/), 'tr-1');
    await userEvent.type(screen.getByLabelText(/Automatisch zusagen bis/), '2026-12-31');
    await userEvent.click(screen.getByRole('checkbox', { name: /Komme später/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(state.upserts).toContainEqual({
        table: 'training_auto_attendance',
        values: {
          profile_id: 'p-01',
          training_id: 'tr-1',
          until_date: '2026-12-31',
          late: true,
        },
      }),
    );
  });

  it('beendet eine Zusage', async () => {
    renderTab();
    await screen.findAllByText('Erwachsenentraining');

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Automatische Zusage für Erwachsenentraining beenden',
      })[0],
    );

    await waitFor(() =>
      expect(state.deletes.some((entry) => entry.table === 'training_auto_attendance')).toBe(true),
    );
  });
});
