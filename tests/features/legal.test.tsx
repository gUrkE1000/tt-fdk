import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = {
  info: {} as Record<string, unknown>,
};

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
    rpc: () => Promise.resolve({ data: [state.info], error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'https://verein.example.org',
}));

import LegalFooter from '../../src/app/layout/LegalFooter';

function renderFooter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LegalFooter />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.info = {
    club_name: 'TTC Musterstadt',
    club_short_name: 'TTC',
    privacy_url: 'https://ttc.example.org/datenschutz',
    imprint_url: 'https://ttc.example.org/impressum',
  };
});

describe('LegalFooter', () => {
  it('verlinkt Datenschutz und Impressum', async () => {
    renderFooter();

    const privacy = await screen.findByRole('link', { name: 'Datenschutz' });
    expect(privacy).toHaveAttribute('href', 'https://ttc.example.org/datenschutz');
    expect(privacy).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Impressum' })).toBeInTheDocument();
  });

  it('zeigt nur, was hinterlegt ist', async () => {
    state.info = { club_name: 'TTC', club_short_name: 'TTC', privacy_url: 'https://x.org/d' };
    renderFooter();

    expect(await screen.findByRole('link', { name: 'Datenschutz' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Impressum' })).toBeNull();
  });

  it('bietet keine toten Links an', async () => {
    // Solange nichts hinterlegt ist, ist eine leere Fußzeile ehrlicher als ein Link ins Nichts.
    state.info = { club_name: 'TTC', club_short_name: 'TTC', privacy_url: '  ', imprint_url: '' };
    const { container } = renderFooter();

    await waitFor(() => expect(container.querySelector('footer')).toBeNull());
  });
});
