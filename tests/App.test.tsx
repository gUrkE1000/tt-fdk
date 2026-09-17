import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        signOut: vi.fn(),
      },
    },
  };
});

describe('App Component', () => {
  const mockProfile = { id: 'p-1', name: 'Max Mustermann', role: 'sportwart', team_number: 1 };
  const mockTeams = [
    { id: 't-1', name: 'Erwachsene I', short_name: 'Erwachsene 1', active: true },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    const createMockChain = (dataValue: any): any => {
      const chain: any = {
        select: vi.fn().mockImplementation(() => chain),
        update: vi.fn().mockImplementation(() => chain),
        eq: vi.fn().mockImplementation(() => chain),
        in: vi.fn().mockImplementation(() => chain),
        order: vi.fn().mockImplementation(() => chain),
        limit: vi.fn().mockImplementation(() => chain),
        single: vi.fn().mockImplementation(() => {
          const singleVal = Array.isArray(dataValue) ? dataValue[0] : dataValue;
          return createMockChain(singleVal);
        }),
        then: vi.fn().mockImplementation((resolve) => {
          resolve({ data: dataValue, error: null });
          return Promise.resolve({ data: dataValue, error: null });
        }),
      };
      return chain;
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createMockChain([mockProfile]);
      }
      if (table === 'teams') {
        return createMockChain(mockTeams);
      }
      return createMockChain([]);
    });

    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);
  });

  it('renders PasswordGate if club password is not verified', async () => {
    render(<App />);
    expect(screen.getByText(/Diese Anwendung ist passwortgeschützt/)).toBeTruthy();
  });

  it('forces user role to player if login method is passwordless', async () => {
    localStorage.setItem('club_password', 'valid-pw');
    localStorage.setItem('ttv_selected_player_id', 'p-1');
    localStorage.setItem('ttv_login_method', 'passwordless');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('TTV Spielplaner')).toBeTruthy();
      expect(screen.getByText('Max Mustermann')).toBeTruthy();
      // Role is downgraded to 'Spieler'
      expect(screen.getByText('Spieler')).toBeTruthy();
    });
  });

  it('preserves database role if login method is password', async () => {
    localStorage.setItem('club_password', 'valid-pw');
    localStorage.setItem('ttv_selected_player_id', 'p-1');
    localStorage.setItem('ttv_login_method', 'password');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('TTV Spielplaner')).toBeTruthy();
      expect(screen.getByText('Max Mustermann')).toBeTruthy();
      // Role is preserved as 'Sportwart'
      expect(screen.getByText('Sportwart')).toBeTruthy();
    });
  });

  it('only shows reset password gate button for club admin', async () => {
    localStorage.setItem('club_password', 'valid-pw');
    localStorage.setItem('ttv_selected_player_id', 'p-1');
    localStorage.setItem('ttv_login_method', 'passwordless'); // player role

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('TTV Spielplaner')).toBeTruthy();
      expect(screen.queryByText('Sicherheit: Passwort-Gate zurücksetzen')).toBeNull();
    });
  });

  it('allows tab navigation and user logout', async () => {
    localStorage.setItem('club_password', 'valid-pw');
    localStorage.setItem('ttv_selected_player_id', 'p-1');
    localStorage.setItem('ttv_login_method', 'password');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('TTV Spielplaner')).toBeTruthy();
    });

    // Switch tab to 'overview' (Gesamtübersicht)
    const overviewTabBtn = screen.getByText(/Gesamtübersicht/);
    overviewTabBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/Gesamtübersicht/)).toBeTruthy();
    });

    // Test logout button
    const logoutBtn = screen.getByTitle('Abmelden');
    logoutBtn.click();

    await waitFor(() => {
      expect(screen.getByText('Anmeldung für Vereinsmitglieder')).toBeTruthy();
    });
  });
});
