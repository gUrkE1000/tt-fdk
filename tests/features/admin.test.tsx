import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { summaryText, syncTotals } from '../../src/features/admin/syncSummary';
import { isStale, STALE_HOURS } from '../../src/features/admin/CronStatusPanel';
import {
  operationsSchema,
  previewQuicklinks,
  toOperationsValues,
} from '../../src/features/admin/schemas';

// ---------------------------------------------------------------- reine Logik

describe('syncTotals', () => {
  const summary = {
    teams: [
      { team: '1. Herren', inserted: 2, rescheduled: 0, updated: 1, deactivated: 0 },
      { team: '2. Herren', inserted: 1, rescheduled: 1, updated: 0, deactivated: 1 },
    ],
  };

  it('zählt über alle Mannschaften zusammen', () => {
    expect(syncTotals(summary)).toEqual({
      inserted: 3,
      rescheduled: 1,
      updated: 1,
      deactivated: 1,
      teams: 2,
      messages: [],
    });
  });

  it('sammelt Warnungen ein', () => {
    const withWarning = { teams: [{ team: '1. Herren', message: 'Kalender nicht erreichbar' }] };
    expect(syncTotals(withWarning).messages).toEqual(['Kalender nicht erreichbar']);
  });

  it('kommt mit einem Lauf zurecht, der gar nicht angefangen hat', () => {
    expect(syncTotals({ error: 'teams_unavailable' }).messages).toEqual(['teams_unavailable']);
  });

  it('kommt mit fremdem JSON zurecht', () => {
    expect(syncTotals(null).teams).toBe(0);
    expect(syncTotals('kaputt').teams).toBe(0);
    expect(syncTotals({ teams: 'keine Liste' }).teams).toBe(0);
  });
});

describe('summaryText', () => {
  it('nennt nur, was passiert ist', () => {
    expect(
      summaryText({ teams: [{ inserted: 3, rescheduled: 0, updated: 0, deactivated: 1 }] }),
    ).toBe('3 neu · 1 abgesagt');
  });

  it('sagt es auch, wenn nichts passiert ist', () => {
    // Kein Ergebnis ist ein Ergebnis: Der Lauf war da, es gab nur nichts zu tun.
    expect(summaryText({ teams: [{ inserted: 0 }] })).toBe('keine Änderungen');
  });

  it('bleibt bei einem leeren Lauf beim Gedankenstrich', () => {
    expect(summaryText({})).toBe('—');
  });
});

describe('isStale', () => {
  const now = new Date('2026-10-05T12:00:00Z');

  it('nennt einen Job ohne Lauf überfällig', () => {
    expect(isStale(null, now)).toBe(true);
  });

  it('lässt einen Lauf von heute Nacht durchgehen', () => {
    expect(isStale('2026-10-05T03:00:00Z', now)).toBe(false);
  });

  it(`schlägt nach ${STALE_HOURS} Stunden an`, () => {
    expect(isStale('2026-10-04T09:00:00Z', now)).toBe(true);
  });
});

describe('operationsSchema', () => {
  const valid = toOperationsValues({});

  it('kennt brauchbare Voreinstellungen', () => {
    expect(valid.open_reminder_days).toBe('14');
    expect(valid.open_reminder_time).toBe('18:00');
    expect(valid.event_reminder_hours).toBe('24');
    expect(operationsSchema.safeParse(valid).success).toBe(true);
  });

  it('lehnt eine Uhrzeit ab, die keine ist', () => {
    const result = operationsSchema.safeParse({ ...valid, open_reminder_time: '25:00' });
    expect(result.success).toBe(false);
  });

  it('lehnt einen Vorlauf ab, der keine Zahl ist', () => {
    expect(operationsSchema.safeParse({ ...valid, open_reminder_days: 'bald' }).success).toBe(
      false,
    );
    expect(operationsSchema.safeParse({ ...valid, open_reminder_days: '0' }).success).toBe(false);
  });

  it('lässt eine leere Absenderadresse zu, eine falsche nicht', () => {
    expect(
      operationsSchema.safeParse({ ...valid, notification_sender_email: '' }).success,
    ).toBe(true);
    expect(
      operationsSchema.safeParse({ ...valid, notification_sender_email: 'kein-at-zeichen' })
        .success,
    ).toBe(false);
  });

  it('lässt eine leere Antwortadresse zu, eine falsche nicht', () => {
    // Leer ist der Normalfall bis jemand sie einträgt — dann verhält es sich wie bisher
    // und Antworten gehen an den Absender.
    expect(operationsSchema.safeParse({ ...valid, notification_reply_to: '' }).success).toBe(true);
    expect(
      operationsSchema.safeParse({ ...valid, notification_reply_to: 'vorstand@verein.example.org' })
        .success,
    ).toBe(true);
    expect(
      operationsSchema.safeParse({ ...valid, notification_reply_to: 'kein-at-zeichen' }).success,
    ).toBe(false);
  });

  it('trennt Absender- und Antwortadresse', () => {
    // Zwei Felder, weil sie zwei verschiedene Anforderungen haben: Der Absender muss auf
    // der verifizierten Domain liegen, die Antwortadresse braucht ein echtes Postfach.
    const result = operationsSchema.safeParse({
      ...valid,
      notification_sender_email: 'planer@mail.verein.example.org',
      notification_reply_to: 'vorstand@ganz-woanders.example.org',
    });
    expect(result.success).toBe(true);
  });

  it('lehnt kaputtes JSON bei den Quicklinks ab', () => {
    expect(operationsSchema.safeParse({ ...valid, quicklinks_json: '{' }).success).toBe(false);
    expect(operationsSchema.safeParse({ ...valid, quicklinks_json: '{}' }).success).toBe(false);
    expect(operationsSchema.safeParse({ ...valid, quicklinks_json: '[]' }).success).toBe(true);
  });
});

describe('previewQuicklinks', () => {
  it('zeigt, was durchkommt', () => {
    const raw = JSON.stringify([{ label: 'Tabelle', url: 'https://example.org' }]);
    expect(previewQuicklinks(raw)).toEqual({
      accepted: [{ label: 'Tabelle', url: 'https://example.org' }],
      dropped: 0,
    });
  });

  it('zählt, was stillschweigend wegfiele', () => {
    // Ohne diese Zahl bliebe unerklärlich, warum ein eingetragener Link nicht erscheint.
    const raw = JSON.stringify([
      { label: 'Gut', url: 'https://example.org' },
      { label: 'Böse', url: 'javascript:alert(1)' },
      { label: '', url: 'https://example.org' },
    ]);
    expect(previewQuicklinks(raw)).toEqual({
      accepted: [{ label: 'Gut', url: 'https://example.org' }],
      dropped: 2,
    });
  });

  it('bleibt bei kaputtem JSON ruhig', () => {
    expect(previewQuicklinks('{')).toEqual({ accepted: [], dropped: 0 });
  });
});

// ---------------------------------------------------------------- Oberfläche

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  rpcCalls: [] as { name: string; args: unknown }[],
  upserts: [] as Row[][],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    limit: () => chain,
    eq: () => chain,
    in: () => chain,
    upsert: (rows: Row[]) => {
      state.upserts.push(rows);
      return Promise.resolve({ error: null });
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
      return Promise.resolve({ data: true, error: null });
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'https://verein.example.org',
  FUNCTIONS_URL: 'https://verein.example.org/functions/v1',
}));

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: { id: 'p-1', full_name: 'Anna Admin', status: 'active' },
    role: 'admin',
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AdminPage from '../../src/features/admin/AdminPage';
import { ToastProvider } from '../../src/components/ui';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.rpcCalls = [];
  state.upserts = [];
  state.tables = {
    club_settings: [
      { key: 'open_reminder_days', value: '7' },
      { key: 'open_reminder_time', value: '19:00' },
      { key: 'event_reminder_hours', value: '48' },
      { key: 'notification_sender_email', value: 'planer@verein.example.org' },
      { key: 'app_url', value: 'https://verein.example.org' },
      {
        key: 'quicklinks_json',
        value: JSON.stringify([{ label: 'Tabelle', url: 'https://example.org' }]),
      },
    ],
    notifications: [
      {
        id: 'n-1',
        profile_id: 'p-2',
        channel: 'email',
        type: 'match_reminder',
        subject: 'Erinnerung',
        body_text: 'Text',
        status: 'failed',
        error: 'HTTP 403',
        attempts: 3,
        created_at: '2026-10-01T10:00:00Z',
        scheduled_for: '2026-10-01T10:00:00Z',
        sent_at: null,
        payload: {},
      },
    ],
    sync_runs: [
      {
        id: 's-1',
        started_at: '2026-10-01T03:00:00Z',
        completed_at: '2026-10-01T03:01:00Z',
        status: 'success',
        summary: { teams: [{ team: '1. Herren', inserted: 2 }] },
      },
    ],
    v_cron_status: [
      {
        jobid: 1,
        jobname: 'sync-calendars-nightly',
        schedule: '0 3 * * *',
        active: true,
        last_start: new Date().toISOString(),
        last_end: new Date().toISOString(),
        last_status: 'succeeded',
        last_message: '',
      },
    ],
  };
});

describe('AdminPage', () => {
  it('zeigt die gespeicherten Betriebseinstellungen', async () => {
    renderPage();

    await waitFor(() =>
      expect((screen.getByLabelText(/Offene Rückmeldungen/) as HTMLInputElement).value).toBe('7'),
    );
    expect((screen.getByLabelText(/Vorlauf in Stunden/) as HTMLInputElement).value).toBe('48');
  });

  it('zeigt eine Vorschau der Quicklinks', async () => {
    renderPage();
    expect(await screen.findByText('Tabelle')).toBeInTheDocument();
  });

  it('speichert die Einstellungen', async () => {
    renderPage();
    await waitFor(() =>
      expect((screen.getByLabelText(/Offene Rückmeldungen/) as HTMLInputElement).value).toBe('7'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.upserts).toHaveLength(1));
    expect(state.upserts[0]).toContainEqual({ key: 'open_reminder_days', value: '7' });
  });

  it('lässt einen Vorlauf nicht durch, der keine Zahl ist', async () => {
    renderPage();
    const field = await screen.findByLabelText(/Offene Rückmeldungen/);

    await userEvent.clear(field);
    await userEvent.type(field, 'bald');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/zwischen 1 und 90 Tagen/)).toBeInTheDocument();
    expect(state.upserts).toHaveLength(0);
  });

  it('listet fehlgeschlagene Nachrichten und kann sie wiederholen', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Benachrichtigungen' }));

    expect(await screen.findAllByText('HTTP 403')).not.toHaveLength(0);

    const buttons = await screen.findAllByRole('button', { name: /Nochmal versuchen/ });
    await userEvent.click(buttons[0]);

    await waitFor(() =>
      expect(state.rpcCalls).toContainEqual({
        name: 'rpc_retry_notification',
        args: { p_id: 'n-1' },
      }),
    );
  });

  it('zeigt den letzten Kalenderabgleich', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Kalenderabgleich' }));

    expect(await screen.findAllByText('2 neu')).not.toHaveLength(0);
    expect(await screen.findAllByText('erfolgreich')).not.toHaveLength(0);
  });

  it('zeigt die Cron-Jobs mit ihrem letzten Lauf', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Jobs' }));

    expect(await screen.findAllByText('sync-calendars-nightly')).not.toHaveLength(0);
    expect(await screen.findAllByText('läuft')).not.toHaveLength(0);
  });
});
