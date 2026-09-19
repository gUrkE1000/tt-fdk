import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: { auth: {}, from: vi.fn(), rpc: vi.fn() },
  APP_URL: 'http://localhost:5173',
  SUPABASE_URL: 'https://projekt.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
}));

import { validateRegistrationCode } from '../../src/features/auth/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publicRpc', () => {
  it('nennt den Schritt, wenn die Anfrage nie zurueckkommt', async () => {
    vi.useFakeTimers();
    globalThis.fetch = (() => new Promise(() => {})) as unknown as typeof fetch;

    const pending = validateRegistrationCode('ABC');
    const caught = expect(pending).rejects.toThrow(/bei „validate_registration_code:fetch"/);
    await vi.advanceTimersByTimeAsync(14_000);
    await caught;

    vi.useRealTimers();
  });

  it('nennt den Schritt, wenn der Rumpf der Antwort nie ankommt', async () => {
    vi.useFakeTimers();
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    })) as unknown as typeof fetch;

    const pending = validateRegistrationCode('ABC');
    const caught = expect(pending).rejects.toThrow(/bei „validate_registration_code:http-200"/);
    await vi.advanceTimersByTimeAsync(14_000);
    await caught;

    vi.useRealTimers();
  });

  it('gibt das Ergebnis weiter, wenn alles glattgeht', async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => true,
    })) as unknown as typeof fetch;

    await expect(validateRegistrationCode('ABC')).resolves.toBe(true);
  });
});
