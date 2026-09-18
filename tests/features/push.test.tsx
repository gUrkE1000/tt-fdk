import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

interface UpsertCall {
  table: string;
  values: Record<string, unknown>;
}

const state = {
  upserts: [] as UpsertCall[],
  deletes: [] as { table: string; column: string; value: unknown }[],
  upsertError: null as { message: string } | null,
};

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (values: Record<string, unknown>) => {
        state.upserts.push({ table, values });
        return Promise.resolve({ error: state.upsertError });
      },
      delete: () => ({
        eq: (column: string, value: unknown) => {
          state.deletes.push({ table, column, value });
          return Promise.resolve({ error: null });
        },
      }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'https://verein.example.org',
  FUNCTIONS_URL: 'https://verein.example.org/functions/v1',
}));

const profile = { id: 'p-1', full_name: 'Anna Beispiel', role: 'member', status: 'active' };

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({ session: null, profile, role: 'member', loading: false, previousLoginAt: null }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import {
  disablePush,
  enablePush,
  readPushState,
  storeSubscription,
  urlBase64ToUint8Array,
} from '../../src/features/notifications/push';
import BellButton from '../../src/features/notifications/BellButton';
import { ToastProvider } from '../../src/components/ui';

// ---------------------------------------------------------------- Umgebung

function subscription(endpoint = 'https://push.example.org/abc') {
  return {
    endpoint,
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({ endpoint, keys: { p256dh: 'schluessel', auth: 'geheim' } }),
  } as unknown as PushSubscription;
}

interface EnvOptions {
  permission?: NotificationPermission;
  existing?: PushSubscription | null;
  requested?: NotificationPermission;
}

function setupBrowser({
  permission = 'default',
  existing = null,
  requested = 'granted',
}: EnvOptions = {}) {
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(existing),
    subscribe: vi.fn().mockResolvedValue(subscription()),
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({ pushManager }),
      register: vi.fn(),
      addEventListener: vi.fn(),
    },
  });

  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn().mockResolvedValue(requested),
  });

  return pushManager;
}

beforeEach(() => {
  state.upserts = [];
  state.deletes = [];
  state.upsertError = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

// ---------------------------------------------------------------- Umrechnung

describe('urlBase64ToUint8Array', () => {
  it('rechnet URL-sicheres Base64 in Bytes um', () => {
    // „Hi!" als Base64 ist „SGkh".
    expect([...urlBase64ToUint8Array('SGkh')]).toEqual([72, 105, 33]);
  });

  it('ergänzt fehlende Füllzeichen', () => {
    expect([...urlBase64ToUint8Array('SGk')]).toEqual([72, 105]);
  });

  it('übersetzt - und _ zurück', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });
});

// ---------------------------------------------------------------- Zustand

describe('readPushState', () => {
  it('meldet ohne Unterstützung „unsupported"', async () => {
    expect(await readPushState()).toBe('unsupported');
  });

  it('meldet eine abgelehnte Erlaubnis als „denied"', async () => {
    setupBrowser({ permission: 'denied' });
    expect(await readPushState()).toBe('denied');
  });

  it('meldet vor der Frage „available"', async () => {
    setupBrowser({ permission: 'default' });
    expect(await readPushState()).toBe('available');
  });

  it('meldet eine erteilte Erlaubnis ohne Anmeldung als „available"', async () => {
    // Website-Daten gelöscht: Die Erlaubnis steht noch, die Anmeldung ist weg.
    setupBrowser({ permission: 'granted', existing: null });
    expect(await readPushState()).toBe('available');
  });

  it('meldet erst mit Anmeldung „enabled"', async () => {
    setupBrowser({ permission: 'granted', existing: subscription() });
    expect(await readPushState()).toBe('enabled');
  });
});

describe('enablePush', () => {
  it('fragt, meldet an und hinterlegt den Endpunkt', async () => {
    const pushManager = setupBrowser({ permission: 'default', requested: 'granted' });

    expect(await enablePush('p-1')).toBe('enabled');
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].table).toBe('push_subscriptions');
    expect(state.upserts[0].values).toMatchObject({
      profile_id: 'p-1',
      endpoint: 'https://push.example.org/abc',
      p256dh: 'schluessel',
      auth: 'geheim',
    });
  });

  it('meldet sich nicht zweimal an', async () => {
    const pushManager = setupBrowser({ permission: 'granted', existing: subscription() });

    expect(await enablePush('p-1')).toBe('enabled');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    // Der vorhandene Endpunkt wird trotzdem hinterlegt — er könnte einem anderen
    // Konto gehört haben.
    expect(state.upserts).toHaveLength(1);
  });

  it('meldet eine Ablehnung zurück', async () => {
    setupBrowser({ permission: 'default', requested: 'denied' });

    expect(await enablePush('p-1')).toBe('denied');
    expect(state.upserts).toHaveLength(0);
  });
});

describe('disablePush', () => {
  it('löscht den Endpunkt und meldet sich ab', async () => {
    const existing = subscription();
    setupBrowser({ permission: 'granted', existing });

    expect(await disablePush()).toBe('available');
    expect(state.deletes).toEqual([
      { table: 'push_subscriptions', column: 'endpoint', value: 'https://push.example.org/abc' },
    ]);
    expect(existing.unsubscribe).toHaveBeenCalled();
  });
});

describe('storeSubscription', () => {
  it('lehnt eine unvollständige Anmeldung ab', async () => {
    const broken = {
      endpoint: 'https://push.example.org/x',
      toJSON: () => ({ endpoint: 'https://push.example.org/x', keys: {} }),
    } as unknown as PushSubscription;

    await expect(storeSubscription('p-1', broken)).rejects.toThrow(/unvollständig/);
  });
});

// ---------------------------------------------------------------- Glocke

function renderBell() {
  return render(
    <ToastProvider>
      <BellButton />
    </ToastProvider>,
  );
}

describe('BellButton', () => {
  it('bleibt unsichtbar, wo es kein Push gibt', async () => {
    const { container } = renderBell();
    await waitFor(() => expect(container.querySelector('button')).toBeNull());
  });

  it('zeigt „aktivieren" mit der Kennung aus dem TT-Planer', async () => {
    setupBrowser({ permission: 'default' });
    renderBell();

    const button = await screen.findByRole('button', { name: 'Mitteilungen aktivieren' });
    expect(button).toHaveAttribute('id', 'enableNotificationsButton');
  });

  it('zeigt nach dem Aktivieren „aktiv"', async () => {
    setupBrowser({ permission: 'default', requested: 'granted' });
    renderBell();

    await userEvent.click(await screen.findByRole('button', { name: 'Mitteilungen aktivieren' }));

    const button = await screen.findByRole('button', { name: 'Mitteilungen aktiv' });
    expect(button).toHaveAttribute('id', 'enabledNotificationsButton');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('zeigt eine Sperre als „inaktiv" und erklärt sie', async () => {
    setupBrowser({ permission: 'denied' });
    renderBell();

    const button = await screen.findByRole('button', { name: 'Mitteilungen inaktiv' });
    expect(button).toHaveAttribute('id', 'deniedNotificationsButton');

    await userEvent.click(button);
    expect(await screen.findByText(/Einstellungen des Browsers/)).toBeInTheDocument();
  });
});
