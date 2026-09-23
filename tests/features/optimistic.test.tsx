import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Der Server antwortet erst, wenn der Test es sagt.
let settle: (value: { data: unknown; error: unknown }) => void = () => {};

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    rpc: () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'order', 'range', 'gte', 'eq']) chain[method] = () => chain;
      chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null });
      return chain;
    },
  },
}));

import { useSetResponse } from '../../src/features/matches/api';
import { useSetEventParticipation } from '../../src/features/events/api';
import { queryKeys } from '../../src/lib/queryKeys';

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const participationKey = queryKeys.matches.participations('aktuell');
const openKey = queryKeys.open.mine('p-1');

beforeEach(() => {
  // staleTime Infinity: Nach dem Aufruf soll nichts neu laden und den Stand
  // überschreiben — geprüft wird nur, was die Mutation selbst tut.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(participationKey, [
    { match_id: 'm-1', profile_id: 'p-1', response: 'none', comment: '', version_responded: null },
  ]);
  client.setQueryData(queryKeys.matches.list('recent'), [{ id: 'm-1', version: 3 }]);
  client.setQueryData(openKey, [
    { kind: 'match', id: 'm-1', date: null, title: 'Spiel' },
    { kind: 'poll', id: 'x', date: null, title: 'Umfrage' },
  ]);
});

describe('Rückmeldung ohne Warten', () => {
  it('zeigt die Zusage sofort und nimmt das Spiel aus „Offen für dich"', async () => {
    const { result } = renderHook(() => useSetResponse(), { wrapper });

    act(() => {
      result.current.mutate({ matchId: 'm-1', response: 'yes', profileId: 'p-1' });
    });

    await waitFor(() =>
      expect(client.getQueryData<{ response: string }[]>(participationKey)?.[0].response).toBe('yes'),
    );
    // Mit der aktuellen Fassung, sonst stünde sofort „Termin hat sich geändert" da.
    expect(
      client.getQueryData<{ version_responded: number }[]>(participationKey)?.[0].version_responded,
    ).toBe(3);
    expect(client.getQueryData<{ id: string }[]>(openKey)?.map((item) => item.id)).toEqual(['x']);

    await act(async () => settle({ data: null, error: null }));
  });

  it('stellt den alten Stand wieder her, wenn der Server ablehnt', async () => {
    const { result } = renderHook(() => useSetResponse(), { wrapper });

    act(() => {
      result.current.mutate({ matchId: 'm-1', response: 'yes', profileId: 'p-1' });
    });
    await waitFor(() =>
      expect(client.getQueryData<{ response: string }[]>(participationKey)?.[0].response).toBe('yes'),
    );

    await act(async () => settle({ data: null, error: { message: 'Meldeschluss' } }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<{ response: string }[]>(participationKey)?.[0].response).toBe('none');
    expect(client.getQueryData<unknown[]>(openKey)).toHaveLength(2);
  });

  it('nimmt eine Zusage zum Vereinstermin zurück, wenn der Termin voll ist', async () => {
    client.setQueryData(queryKeys.events.participants(), []);
    const { result } = renderHook(() => useSetEventParticipation(), { wrapper });

    act(() => {
      result.current.mutate({ eventId: 'e-1', status: 'yes', self: 'p-1' });
    });
    await waitFor(() =>
      expect(client.getQueryData<unknown[]>(queryKeys.events.participants())).toHaveLength(1),
    );

    // Kein Fehler, sondern eine Ablehnung als Statuswert.
    await act(async () => settle({ data: { status: 'full' }, error: null }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<unknown[]>(queryKeys.events.participants())).toEqual([]);
  });
});
