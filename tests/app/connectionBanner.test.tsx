import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import ConnectionBanner from '../../src/app/layout/ConnectionBanner';

function Failing() {
  useQuery({
    queryKey: ['kaputt'],
    queryFn: () => Promise.reject(new Error('Netz weg')),
    retry: false,
  });
  return null;
}

function renderBanner(children?: React.ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ConnectionBanner />
      {children}
    </QueryClientProvider>,
  );
}

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});

describe('ConnectionBanner', () => {
  it('bleibt unsichtbar, solange alles läuft', () => {
    renderBanner();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Offline/)).toBeNull();
  });

  it('meldet gescheiterte Abfragen mit einem Knopf zum Wiederholen', async () => {
    renderBanner(<Failing />);
    expect(await screen.findByText('Einige Daten ließen sich nicht laden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Erneut versuchen/ })).toBeInTheDocument();
  });

  it('sagt, wenn das Gerät offline ist', () => {
    renderBanner();
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/Offline — du siehst den zuletzt geladenen Stand/)).toBeInTheDocument();
  });
});
