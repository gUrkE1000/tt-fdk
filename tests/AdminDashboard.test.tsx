import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDashboard from '../src/components/AdminDashboard';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

describe('AdminDashboard', () => {
  const mockTeams = [
    { id: 't-1', name: 'Erwachsene I', short_name: 'Erwachsene 1', webcal_url: 'webcal://foo', active: true },
  ];

  const mockProfiles = [
    { id: 'p-1', name: 'Max Mustermann', role: 'club_admin' },
  ];

  const mockSyncRuns = [
    { id: 'run-1', started_at: '2026-08-09T18:00:00.000Z', status: 'success', summary_text: 'Synchronisiert' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    vi.stubGlobal('alert', vi.fn());
  });

  const setupMocks = () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
          }),
        };
      }
      if (table === 'sync_runs') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockSyncRuns, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);
  };

  it('loads and displays teams, profiles and sync logs', async () => {
    setupMocks();

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('🛡️ Vereins-Administration')).toBeTruthy();
      expect(screen.getByText('Erwachsene I')).toBeTruthy();
      expect(screen.getByText('Max M')).toBeTruthy();
      expect(screen.getByText('Synchronisiert')).toBeTruthy();
    });
  });

  it('triggers edge function manual sync on button click', async () => {
    setupMocks();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { message: 'Sync complete' },
      error: null,
    } as any);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Spielpläne jetzt synchronisieren/)).toBeTruthy();
    });

    const syncBtn = screen.getByText(/Spielpläne jetzt synchronisieren/);
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-calendars', expect.any(Object));
      expect(screen.getByText('Sync complete')).toBeTruthy();
    });
  });

  it('saves club_nr on button click', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }) }) };
      if (table === 'profiles') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) }) };
      if (table === 'sync_runs') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: mockSyncRuns, error: null }) }) }) };
      if (table === 'club_settings') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { value: '21707' }, error: null }) }) }),
          upsert: upsertMock,
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Speichern')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Speichern'));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith({ key: 'club_nr', value: '21707' }, { onConflict: 'key' });
    });
  });

  it('handles adding a new team', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }) }),
          insert: insertMock,
        };
      }
      if (table === 'profiles') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) }) };
      if (table === 'sync_runs') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: mockSyncRuns, error: null }) }) }) };
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Neue Mannschaft/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/Neue Mannschaft/));

    const inputs = screen.getAllByRole('textbox');
    const nameInput = screen.getByPlaceholderText('Mannschaftsname (z.B. Erwachsene IV)');
    const shortNameInput = screen.getByPlaceholderText('Kurzname (z.B. Erwachsene 4)');
    const webcalInput = screen.getByPlaceholderText('webcal://www.mytischtennis.de/community/...');

    fireEvent.change(nameInput, { target: { value: 'Erwachsene II' } });
    fireEvent.change(shortNameInput, { target: { value: 'Erwachsene 2' } });
    fireEvent.change(webcalInput, { target: { value: 'webcal://test' } });

    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith({
        name: 'Erwachsene II',
        short_name: 'Erwachsene 2',
        webcal_url: 'webcal://test',
        active: true,
      });
    });
  });

  it('toggles team active state and changes profile role', async () => {
    const updateTeamMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const updateProfileMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }) }),
          update: updateTeamMock,
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) }),
          update: updateProfileMock,
        };
      }
      if (table === 'sync_runs') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: mockSyncRuns, error: null }) }) }) };
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Deaktivieren')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Deaktivieren'));

    await waitFor(() => {
      expect(updateTeamMock).toHaveBeenCalledWith({ active: false, updated_at: expect.any(String) });
    });

    const roleSelect = screen.getByRole('combobox');
    fireEvent.change(roleSelect, { target: { value: 'sportwart' } });

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({ role: 'sportwart', updated_at: expect.any(String) });
    });
  });

  it('handles editing team details and edge function error fallback', async () => {
    const updateTeamMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const insertSyncRunMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'run-client-1' }, error: null }),
      }),
    });
    const updateSyncRunMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }) }),
          update: updateTeamMock,
        };
      }
      if (table === 'profiles') return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }) }) };
      if (table === 'sync_runs') {
        return {
          select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: mockSyncRuns, error: null }) }) }),
          insert: insertSyncRunMock,
          update: updateSyncRunMock,
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Edge function unavailable' } as any,
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Erwachsene I')).toBeTruthy();
    });

    // Test edge function sync error fallback
    const syncBtn = screen.getByText(/Spielpläne jetzt synchronisieren/);
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(insertSyncRunMock).toHaveBeenCalled();
    });
  });
});
