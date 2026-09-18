import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'https://verein.example.org',
  FUNCTIONS_URL: 'https://verein.example.org/functions/v1',
}));

import MobileAppPage from '../../src/features/notifications/MobileAppPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <MobileAppPage />
    </MemoryRouter>,
  );
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.unstubAllGlobals();
});

describe('MobileAppPage', () => {
  it('nennt die Adresse zum Abtippen, ohne Protokoll', async () => {
    renderPage();
    expect(await screen.findByText('verein.example.org')).toBeInTheDocument();
  });

  it('führt durch die Installation auf dem iPhone', async () => {
    renderPage();

    expect(await screen.findByText('Installation für iOS')).toBeInTheDocument();
    expect(screen.getByText(/Zum Home-Bildschirm/)).toBeInTheDocument();
    expect(screen.getByText(/Teilen-Symbol/)).toBeInTheDocument();
    expect(screen.getByText(/Glocken-Symbol/)).toBeInTheDocument();
  });

  it('führt durch die Installation auf Android', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('tab', { name: 'Android' }));

    expect(await screen.findByText('Installation für Android')).toBeInTheDocument();
    expect(screen.getByText(/App installieren/)).toBeInTheDocument();
  });

  it('sagt, dass Mitteilungen auf dem iPhone die Installation voraussetzen', async () => {
    renderPage();
    expect(
      await screen.findByText(/Im Safari-Fenster bleibt die Glocke wirkungslos/),
    ).toBeInTheDocument();
  });

  it('erkennt, wenn die Seite bereits als App läuft', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia;
    renderPage();

    expect(
      await screen.findByText(/läuft gerade als App/),
    ).toBeInTheDocument();
  });
});
