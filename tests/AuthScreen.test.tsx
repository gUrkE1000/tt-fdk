import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthScreen from '../src/components/AuthScreen';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
      },
    },
  };
});

describe('AuthScreen', () => {
  const mockProfiles = [
    { id: '1', name: 'Max Mustermann', ttr_points: 1600 },
    { id: '2', name: 'Mia Musterfrau', ttr_points: 1500 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders tab bar and loads dropdown list of profiles', async () => {
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AuthScreen onSelectPlayer={() => {}} />);

    // Renders loading first
    expect(screen.getByText('Lade Spieler...')).toBeDefined();

    // Renders profiles list next
    await waitFor(() => {
      expect(screen.getByText('TTV Spielplaner')).toBeDefined();
      expect(screen.getByText('Max M (1600 TTR)')).toBeDefined();
    });
  });

  it('allows switching tabs between passwordless, password, and register', async () => {
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AuthScreen onSelectPlayer={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Direkt-Auswahl')).toBeDefined();
    });

    const passTab = screen.getByText('Mit Passwort');
    fireEvent.click(passTab);

    expect(screen.getByPlaceholderText('name@verein.de')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••')).toBeDefined();
  });

  it('automatically logs in a user upon registration if a session is returned (email confirmation disabled)', async () => {
    const mockOnSelectPlayer = vi.fn();
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockSession = { access_token: 'token-abc', user: mockUser };
    const mockProfile = { id: 'user-123', name: 'Auto Login User', role: 'player' };

    const selectMockObj = {
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockImplementation((col, val) => {
        return {
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        };
      }),
    };

    // Mock initial profiles load (returns empty list or some profiles)
    const fromMock = vi.fn().mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue(selectMockObj),
        };
      }
      return {};
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    // Mock signUp returning user and session
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    } as any);

    render(<AuthScreen onSelectPlayer={mockOnSelectPlayer} />);

    await waitFor(() => {
      expect(screen.getByText('Registrieren')).toBeDefined();
    });

    // Go to registration tab
    fireEvent.click(screen.getByText('Registrieren'));

    // Fill in registration form
    fireEvent.change(screen.getByPlaceholderText('z.B. Max Mustermann'), { target: { value: 'Auto Login User' } });
    fireEvent.change(screen.getByPlaceholderText('name@verein.de'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'securepassword123' } });

    // Submit form
    const regButtons = screen.getAllByRole('button', { name: 'Registrieren' });
    fireEvent.click(regButtons[regButtons.length - 1]);

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'securepassword123',
        options: {
          data: { name: 'Auto Login User' },
        },
      });
      expect(mockOnSelectPlayer).toHaveBeenCalledWith(mockProfile);
      expect(localStorage.getItem('ttv_login_method')).toBe('password');
      expect(localStorage.getItem('ttv_selected_player_id')).toBe('user-123');
    });
  });

  it('shows an alert and redirects to the password tab upon registration if no session is returned (fallback)', async () => {
    const mockOnSelectPlayer = vi.fn();
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    // Mock window.alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const selectMockObj = {
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockImplementation((col, val) => {
        return {
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        };
      }),
    };

    // Mock initial profiles load
    const fromMock = vi.fn().mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue(selectMockObj),
        };
      }
      return {};
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    // Mock signUp returning user but no session
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null,
    } as any);

    render(<AuthScreen onSelectPlayer={mockOnSelectPlayer} />);

    await waitFor(() => {
      expect(screen.getByText('Registrieren')).toBeDefined();
    });

    // Go to registration tab
    fireEvent.click(screen.getByText('Registrieren'));

    // Fill in registration form
    fireEvent.change(screen.getByPlaceholderText('z.B. Max Mustermann'), { target: { value: 'Fallback User' } });
    fireEvent.change(screen.getByPlaceholderText('name@verein.de'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'securepassword123' } });

    // Submit form
    const regButtonsFallback = screen.getAllByRole('button', { name: 'Registrieren' });
    fireEvent.click(regButtonsFallback[regButtonsFallback.length - 1]);

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'securepassword123',
        options: {
          data: { name: 'Fallback User' },
        },
      });
      expect(alertMock).toHaveBeenCalledWith('Registrierung erfolgreich! Bitte melde dich jetzt an.');
      expect(mockOnSelectPlayer).not.toHaveBeenCalled();
    });

    alertMock.mockRestore();
  });

  it('correctly retrieves and logs in the associated profile upon registration with matching name', async () => {
    const mockOnSelectPlayer = vi.fn();
    const mockUser = { id: 'user-789', email: 'pre_existing@example.com' };
    const mockSession = { access_token: 'token-xyz', user: mockUser };

    // This is the pre-existing unassociated profile created by the Sportwart.
    // The trigger links it by updating its ID to the new user's ID 'user-789'.
    const mockLinkedProfile = { id: 'user-789', name: 'Mia Musterfrau', role: 'player', ttr_points: 1500 };

    const selectMockObj = {
      order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      eq: vi.fn().mockImplementation((col, val) => {
        return {
          single: vi.fn().mockResolvedValue({ data: mockLinkedProfile, error: null }),
        };
      }),
    };

    const fromMock = vi.fn().mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue(selectMockObj),
        };
      }
      return {};
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    } as any);

    render(<AuthScreen onSelectPlayer={mockOnSelectPlayer} />);

    await waitFor(() => {
      expect(screen.getByText('Registrieren')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Registrieren'));

    // Register with matching name 'Mia Musterfrau'
    fireEvent.change(screen.getByPlaceholderText('z.B. Max Mustermann'), { target: { value: 'Mia Musterfrau' } });
    fireEvent.change(screen.getByPlaceholderText('name@verein.de'), { target: { value: 'pre_existing@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'mypassword123' } });

    const regButtons = screen.getAllByRole('button', { name: 'Registrieren' });
    fireEvent.click(regButtons[regButtons.length - 1]);

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'pre_existing@example.com',
        password: 'mypassword123',
        options: {
          data: { name: 'Mia Musterfrau' },
        },
      });
      expect(mockOnSelectPlayer).toHaveBeenCalledWith(mockLinkedProfile);
      expect(localStorage.getItem('ttv_login_method')).toBe('password');
      expect(localStorage.getItem('ttv_selected_player_id')).toBe('user-789');
    });
  });
});
