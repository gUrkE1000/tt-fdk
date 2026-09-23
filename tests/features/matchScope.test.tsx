import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const calls: { table: string; method: string; args: unknown[] }[] = [];

function makeBuilder(table: string) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'range', 'gte']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({
      data:
        table === 'match_participations'
          ? [{ match_id: 'm-1', profile_id: 'p-1', response: 'yes', removed: false, matches: { dtstart: 'x' } }]
          : [],
      error: null,
      count: 1,
    });
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import {
  RECENT_MATCH_DAYS,
  recentSince,
  useAllParticipations,
  useMatches,
} from '../../src/features/matches/api';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  calls.length = 0;
});

describe('Zeitfenster der Spiele', () => {
  it('rechnet das Fenster vom heutigen Tag zurück', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    const since = new Date(recentSince(now));
    expect((now.getTime() - since.getTime()) / 86_400_000).toBe(RECENT_MATCH_DAYS);
  });

  it('filtert in der Datenbank, nicht erst im Browser', async () => {
    const { result } = renderHook(() => useMatches(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls).toContainEqual(
      expect.objectContaining({ table: 'matches', method: 'gte', args: ['dtstart', expect.any(String)] }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'match_participations',
        method: 'gte',
        args: ['matches.dtstart', expect.any(String)],
      }),
    );
  });

  it('lädt für „alle" die ganze Historie', async () => {
    const { result } = renderHook(() => useAllParticipations('all'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.some((call) => call.method === 'gte')).toBe(false);
    // Das eingebettete Spiel diente nur dem Filter und steht nicht in den Zeilen.
    expect(result.current.data?.[0]).not.toHaveProperty('matches');
  });
});
