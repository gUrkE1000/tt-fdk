import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
  Der Kalender selbst (Seite „Kalender" und Reiter „Kalender" der Übersicht) bietet
  das Abo an — nicht nur „Meine Termine". FullCalendar wird durch eine Attrappe
  ersetzt: Getestet wird der Knopf, nicht die Bibliothek.
*/

vi.mock('@fullcalendar/react', () => ({ default: () => <div data-testid="fullcalendar" /> }));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }));
vi.mock('@fullcalendar/list', () => ({ default: {} }));
vi.mock('@fullcalendar/core/locales/de', () => ({ default: {} }));

function makeBuilder() {
  const chain = {
    select: () => chain,
    order: () => chain,
    range: () => chain,
    then: (resolve: (value: { data: unknown[]; error: null; count: number }) => unknown) =>
      resolve({ data: [], error: null, count: 0 }),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: () => makeBuilder(),
    rpc: (name: string) =>
      Promise.resolve(
        name === 'rpc_my_calendar_subscription'
          ? { data: { token: '99999999-8888-7777-6666-555555555555', include_trainings: false }, error: null }
          : { data: null, error: null },
      ),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'https://verein.example.org',
  FUNCTIONS_URL: 'https://api.example.org/functions/v1',
}));

import PlanningTab from '../../src/features/calendar/PlanningTab';
import { ToastProvider } from '../../src/components/ui';

describe('Kalender', () => {
  it('bietet das Kalender-Abo direkt im Kalender an', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MemoryRouter>
            <PlanningTab />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Kalender abonnieren/ }));

    const field = (await screen.findByLabelText('Kalender-Link')) as HTMLInputElement;
    await waitFor(() =>
      expect(field.value).toBe(
        'https://api.example.org/functions/v1/calendar-feed?token=99999999-8888-7777-6666-555555555555',
      ),
    );
    expect(screen.getByText('Samsung Kalender')).toBeInTheDocument();
  });
});
