import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordGate from '../src/components/PasswordGate';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      rpc: vi.fn(),
    },
  };
});

describe('PasswordGate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Reset window.location
    vi.stubGlobal('location', {
      search: '',
    });
  });

  it('renders correctly', () => {
    render(<PasswordGate onVerified={() => {}} />);
    expect(screen.getByPlaceholderText('Passwort eingeben')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Einloggen' })).toBeDefined();
  });

  it('shows error on invalid password submitted', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as any);

    render(<PasswordGate onVerified={() => {}} />);

    const input = screen.getByPlaceholderText('Passwort eingeben');
    const button = screen.getByRole('button', { name: 'Einloggen' });

    fireEvent.change(input, { target: { value: 'wrong-password' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('verify_club_password', {
        password: 'wrong-password',
      });
      expect(screen.getByText('Ungültiges Vereinspasswort. Bitte versuche es erneut.')).toBeDefined();
    });
  });

  it('verifies correctly and calls onVerified when password is correct', async () => {
    const onVerifiedMock = vi.fn();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);

    render(<PasswordGate onVerified={onVerifiedMock} />);

    const input = screen.getByPlaceholderText('Passwort eingeben');
    const button = screen.getByRole('button', { name: 'Einloggen' });

    fireEvent.change(input, { target: { value: 'correct-password' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('verify_club_password', {
        password: 'correct-password',
      });
      expect(localStorage.getItem('club_password')).toBe('correct-password');
      expect(onVerifiedMock).toHaveBeenCalledWith('correct-password');
    });
  });

  it('auto-checks password from URL query parameter if present', async () => {
    const onVerifiedMock = vi.fn();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);

    // Mock search parameters
    vi.stubGlobal('location', {
      search: '?pw=url-password',
    });

    render(<PasswordGate onVerified={onVerifiedMock} />);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('verify_club_password', {
        password: 'url-password',
      });
      expect(localStorage.getItem('club_password')).toBe('url-password');
      expect(onVerifiedMock).toHaveBeenCalledWith('url-password');
    });
  });

  it('auto-checks password from localStorage if present', async () => {
    const onVerifiedMock = vi.fn();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);

    localStorage.setItem('club_password', 'stored-password');

    render(<PasswordGate onVerified={onVerifiedMock} />);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('verify_club_password', {
        password: 'stored-password',
      });
      expect(onVerifiedMock).toHaveBeenCalledWith('stored-password');
    });
  });
});
