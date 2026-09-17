import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeamMatrixView from '../src/components/TeamMatrixView';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('TeamMatrixView', () => {
  const mockTeamId = 'team-123';

  const mockMatches = [
    { id: 'm-1', team_id: mockTeamId, summary: 'Match 1', dtstart: '2026-08-12T18:00:00.000Z', is_home: true, active: true, version: 1 },
  ];

  const mockTeamPlayers = [
    { id: 'tp-1', team_id: mockTeamId, player_id: 'p-1', profiles: { id: 'p-1', name: 'Max Mustermann' } },
  ];

  const mockAvailabilities = [
    { id: 'av-1', match_id: 'm-1', player_id: 'p-1', response: 'yes', comment: 'On fire', version_responded: 1 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders matrix table with players and their match availabilities', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: mockTeamId, name: 'Erwachsene I' }], error: null }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
            }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTeamPlayers, error: null }),
          }),
        };
      }
      if (table === 'availabilities') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockAvailabilities, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<TeamMatrixView teamId={mockTeamId} isManagerOrAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText('Max M')).toBeTruthy();
      expect(screen.getByText('✅')).toBeTruthy(); // Max is yes
      expect(screen.getByText('Summe (✅)')).toBeTruthy();
      expect(screen.queryByText('WhatsApp')).toBeNull();
    });
  });

  it('renders WhatsApp row when isManagerOrAdmin is true (for team_manager, sportwart, and club_admin)', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: mockTeamId, name: 'Erwachsene I' }], error: null }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
            }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTeamPlayers, error: null }),
          }),
        };
      }
      if (table === 'availabilities') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockAvailabilities, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ id: 'p-1', name: 'Max Mustermann' }], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<TeamMatrixView teamId={mockTeamId} isManagerOrAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeTruthy();
      expect(screen.getByTitle('WhatsApp-Text in Zwischenablage kopieren')).toBeTruthy();
    });
  });

  it('renders WhatsApp row for manager/admin and copies generated message on click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: mockTeamId, name: 'Erwachsene I' }], error: null }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
            }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTeamPlayers, error: null }),
          }),
        };
      }
      if (table === 'availabilities') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockAvailabilities, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ id: 'p-1', name: 'Max Mustermann' }], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<TeamMatrixView teamId={mockTeamId} isManagerOrAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeTruthy();
    });

    const copyBtn = screen.getByTitle('WhatsApp-Text in Zwischenablage kopieren');
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      const copiedContent = writeTextMock.mock.calls[0][0];
      expect(copiedContent).toContain('Heimspiel');
      expect(copiedContent).toContain('Max');
    });
  });

  it('updates availability without prompting for comment when manager/admin changes dropdown', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');

    const updateMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: mockTeamId, name: 'Erwachsene I' }], error: null }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
            }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTeamPlayers, error: null }),
          }),
        };
      }
      if (table === 'availabilities') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockAvailabilities, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: updateMock,
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<TeamMatrixView teamId={mockTeamId} isManagerOrAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('Max M')).toBeTruthy();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'no' } });

    await waitFor(() => {
      expect(promptSpy).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalled();
    });
  });

  it('allows manager/admin to open manage players view and add/remove players', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const allProfilesMock = [
      { id: 'p-1', name: 'Max Mustermann', role: 'player' },
      { id: 'p-2', name: 'Erika Musterfrau', role: 'player' },
    ];

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: mockTeamId, name: 'Erwachsene I' }], error: null }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
            }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTeamPlayers, error: null }),
          }),
          insert: insertMock,
          delete: deleteMock,
        };
      }
      if (table === 'availabilities') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockAvailabilities, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: allProfilesMock, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<TeamMatrixView teamId={mockTeamId} isManagerOrAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('Spieler verwalten')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Spieler verwalten'));

    await waitFor(() => {
      expect(screen.getByText('Erika M (player)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Hinzufügen/ }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith({ team_id: mockTeamId, player_id: 'p-2' });
    });

    const removeBtn = screen.getByTitle('Spieler entfernen');
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
