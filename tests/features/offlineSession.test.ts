import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/supabaseClient', () => ({
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
}));

import {
  isNetworkFailure,
  sessionStorageKey,
  storedSession,
} from '../../src/features/auth/offlineSession';

beforeEach(() => {
  window.localStorage.clear();
});

describe('Anmeldung ohne Netz', () => {
  it('kennt den Schlüssel, unter dem supabase-js die Sitzung ablegt', () => {
    expect(sessionStorageKey()).toBe('sb-abcdefgh-auth-token');
    expect(sessionStorageKey('http://localhost:54321')).toBe('sb-localhost-auth-token');
  });

  it('liest die gespeicherte Sitzung auch mit abgelaufenem Token', () => {
    window.localStorage.setItem(
      'sb-abcdefgh-auth-token',
      JSON.stringify({ access_token: 'x', refresh_token: 'r', expires_at: 1, user: { id: 'u-1' } }),
    );
    expect(storedSession()?.user.id).toBe('u-1');
  });

  it('nimmt keine halbe oder kaputte Sitzung', () => {
    expect(storedSession()).toBeNull();
    window.localStorage.setItem('sb-abcdefgh-auth-token', '{kaputt');
    expect(storedSession()).toBeNull();
    window.localStorage.setItem('sb-abcdefgh-auth-token', JSON.stringify({ user: { id: 'u-1' } }));
    expect(storedSession()).toBeNull();
  });

  it('unterscheidet fehlendes Netz von einer Ablehnung durch den Server', () => {
    expect(isNetworkFailure(null, false)).toBe(true);
    expect(isNetworkFailure({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, true)).toBe(true);
    expect(isNetworkFailure(new Error('Der Server hat beim Prüfen der Anmeldung nicht geantwortet.'), true)).toBe(true);
    // Abgemeldet oder gesperrt: kein Netzproblem — dann gilt die alte Sitzung nicht.
    expect(isNetworkFailure({ name: 'AuthApiError', message: 'Invalid Refresh Token', status: 400 }, true)).toBe(false);
    expect(isNetworkFailure(null, true)).toBe(false);
  });
});
