import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GesamtUebersichtView from '../src/components/GesamtUebersichtView';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('GesamtUebersichtView', () => {
  const mockTeams = [
    { id: 't-1', name: 'Erwachsene I', short_name: 'Erwachsene 1', active: true },
    { id: 't-2', name: 'Erwachsene II', short_name: 'Erwachsene 2', active: true },
  ];

  const mockMatches = [
    {
      id: 'm-1',
      team_id: 't-1',
      summary: 'Erwachsene I vs TV Klaswipper',
      dtstart: '2026-08-12T18:00:00.000Z',
      dtend: '2026-08-12T21:00:00.000Z',
      is_home: true,
      active: true,
      version: 1,
    },
    {
      id: 'm-2',
      team_id: 't-2',
      summary: 'Erwachsene II vs TV Klaswipper II',
      dtstart: '2026-08-12T18:00:00.000Z',
      dtend: '2026-08-12T21:00:00.000Z',
      is_home: true,
      active: true,
      version: 1,
    },
  ];

  const mockTeamPlayers = [
    { team_id: 't-1', player_id: 'p-1', teams: { name: 'Erwachsene I' } },
  ];

  const mockAvailabilities = [
    { id: 'av-1', match_id: 'm-1', player_id: 'p-1', response: 'yes', version_responded: 1, profiles: { name: 'Max Mustermann' } },
    { id: 'av-2', match_id: 'm-2', player_id: 'p-1', response: 'yes', version_responded: 1, profiles: { name: 'Max Mustermann' } },
  ];

  const mockProfiles = [
    { id: 'p-1', name: 'Max Mustermann' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and renders matches, detecting overlapping conflicts correctly', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockTeams, error: null }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          select: vi.fn().mockResolvedValue({ data: mockTeamPlayers, error: null }),
        };
      }
      if (table === 'availabilities') {
        return {
          select: vi.fn().mockResolvedValue({ data: mockAvailabilities, error: null }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<GesamtUebersichtView />);

    await waitFor(() => {
      expect(screen.getByText(/Gesamtübersicht/)).toBeTruthy();
      // Verifies conflict alert is shown because Max is 'yes' on two overlapping matches
      expect(screen.getByText(/Möglicher Terminkonflikt/)).toBeTruthy();
      expect(screen.getAllByText('Max M').length).toBeGreaterThan(0);
    });

    // Expand match to see details
    const matchRow = screen.getByText('🏠 Heimspiel gegen TV Klaswipper');
    fireEvent.click(matchRow);

    await waitFor(() => {
      expect(screen.getByText('Stammzugehörigkeit (1)')).toBeTruthy();
    });
  });
});
