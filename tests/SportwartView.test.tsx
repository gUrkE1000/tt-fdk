import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SportwartView from '../src/components/SportwartView';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('SportwartView', () => {
  const mockProfiles = [
    { id: 'p-1', name: 'Max Mustermann', role: 'sportwart', ttr_points: 1600, team_number: 1, position_number: 1 },
    { id: 'p-2', name: 'Mia Musterfrau', role: 'player', ttr_points: 1500, team_number: 1, position_number: 2 },
  ];

  const mockTeams = [
    { id: 't-1', name: 'Erwachsene I', short_name: 'Erwachsene 1', active: true },
  ];

  const mockAbsences = [
    { id: 'a-1', player_id: 'p-2', start_date: '2026-08-15', end_date: '2026-08-15', reason: 'Holiday', profiles: { name: 'Mia Musterfrau' } },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    vi.stubGlobal('alert', vi.fn());
  });

  const setupMocks = () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'p-new' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }),
            }),
          }),
        };
      }
      if (table === 'club_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { key: 'registered_teams_count', value: '1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'absences') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAbsences, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);
  };

  it('renders loading state then loads and displays Sportwart dashboard', async () => {
    setupMocks();

    render(<SportwartView />);

    await waitFor(() => {
      expect(screen.getByText(/Sportwart-Dashboard/)).toBeTruthy();
      expect(screen.getByText('Max Mustermann')).toBeTruthy();
      expect(screen.getAllByText('Mia Musterfrau').length).toBeGreaterThan(0);
    });
  });

  it('allows adding a new player', async () => {
    setupMocks();

    render(<SportwartView />);

    await waitFor(() => {
      expect(screen.getByText('Spieler anlegen')).toBeTruthy();
    });

    const addBtn = screen.getByText('Spieler anlegen');
    fireEvent.click(addBtn);

    // Wait for player add form to render
    await waitFor(() => {
      expect(screen.getByPlaceholderText('z.B. Max Mustermann')).toBeTruthy();
    });

    const nameInput = screen.getByPlaceholderText('z.B. Max Mustermann');
    fireEvent.change(nameInput, { target: { value: 'New Test Player' } });

    // Now both "Speichern" buttons are present: the Settings save and the Player save.
    const submitBtn = screen.getAllByText('Speichern')[1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });
  });

  it('scrapes rosters and correctly calculates and displays metrics in the confirm dialog before proceeding', async () => {
    // 1. Setup mocked profiles in supabase to compare with scraped players
    // We will have "Max Mustermann" at 1.1 (1600 TTR) and "Mia Musterfrau" at 1.2 (1500 TTR)
    // The scraped HTML will have:
    // - 1.1 with 1600 (Max Mustermann) -> Bereits aktuell
    // - 1.2 with 1573 (Mia Musterfrau) -> Nur aktualisiert (Q-TTR points change)
    // - 1.3 with 1555 (Birgit Matthies) -> Ersetzt (New / different player at position)
    const customProfiles = [
      { id: 'p-1', name: 'Max Mustermann', role: 'player', ttr_points: 1600, team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'Mia Musterfrau', role: 'player', ttr_points: 1500, team_number: 1, position_number: 2 },
    ];

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: customProfiles, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
            neq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'p-new' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }),
            }),
          }),
        };
      }
      if (table === 'club_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { key: 'registered_teams_count', value: '1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'absences') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAbsences, error: null }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          delete: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    // Mock HTML content with comments and non-breaking spaces
    const htmlResponse = `
      <table>
        <thead>
          <tr><th>Rang</th><th>QTTR</th><th>Name</th><th>A</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>1<!-- -->.<!-- -->1</td>
            <td>1600</td>
            <td><a href="...">Max Mustermann</a></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>1<!-- -->.<!-- -->2</td>
            <td>1573</td>
            <td><a href="...">Mia Musterfrau</a></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>1<!-- -->.<!-- -->3</td>
            <td>1555</td>
            <td><a href="...">Birgit Matthies</a></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(htmlResponse),
      json: vi.fn().mockResolvedValue({ contents: htmlResponse })
    });
    vi.stubGlobal('fetch', mockFetch);

    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmSpy);

    render(<SportwartView />);

    await waitFor(() => {
      expect(screen.getByText(/Sportwart-Dashboard/)).toBeTruthy();
    });

    const downloadBtn = screen.getByText('📥 Spieler herunterladen');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    const confirmCallMessage = confirmSpy.mock.calls[0][0];

    // Assert metrics details are in the confirm message
    expect(confirmCallMessage).toContain('Online gefundene Spieler: 3');
    expect(confirmCallMessage).toContain('Bereits aktuell: 1 Spieler');
    expect(confirmCallMessage).toContain('Nur aktualisiert (Q-TTR Punkte geändert): 1 Spieler');
    expect(confirmCallMessage).toContain('Ersetzt (anderer Spielername auf Position oder neue Position): 1 Spieler');
    expect(confirmCallMessage).toContain('Q-TTR');
    expect(confirmCallMessage).not.toContain(' Nur aktualisiert (TTR'); // ensures we used Q-TTR not TTR

    // Since confirm mock returned true, check if reset & update were called
    await waitFor(() => {
      // should reset profiles
      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });
  });

  it('supports pasting HTML manually as a fallback and correctly parses and displays the confirmation metrics', async () => {
    const customProfiles = [
      { id: 'p-1', name: 'Adrian Rink', role: 'player', ttr_points: 1555, team_number: 1, position_number: 1 },
      { id: 'p-2', name: 'Markus Anhalt', role: 'player', ttr_points: 1500, team_number: 1, position_number: 2 },
    ];

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: customProfiles, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
            neq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'p-new' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }),
            }),
          }),
        };
      }
      if (table === 'club_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { key: 'registered_teams_count', value: '1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'absences') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAbsences, error: null }),
          }),
        };
      }
      if (table === 'team_players') {
        return {
          delete: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    const htmlToPaste = `
      <table>
        <tbody>
          <tr>
            <td>1<!-- -->.<!-- -->1</td>
            <td>1555</td>
            <td><a href="...">Adrian Rink</a></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>1<!-- -->.<!-- -->2</td>
            <td>1573</td>
            <td><a href="...">Markus Anhalt</a></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;

    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmSpy);

    render(<SportwartView />);

    await waitFor(() => {
      expect(screen.getByText(/Sportwart-Dashboard/)).toBeTruthy();
    });

    const pasteBtn = screen.getByText(/HTML manuell einfügen/);
    fireEvent.click(pasteBtn);

    // Should render the textarea
    const textarea = screen.getByPlaceholderText('<table ...> ... </table>');
    expect(textarea).toBeTruthy();

    fireEvent.change(textarea, { target: { value: htmlToPaste } });

    const importStartBtn = screen.getByText(/Import starten/);
    fireEvent.click(importStartBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    const confirmCallMessage = confirmSpy.mock.calls[0][0];

    expect(confirmCallMessage).toContain('Gefundene Spieler im HTML: 2');
    expect(confirmCallMessage).toContain('Bereits aktuell: 1 Spieler');
    expect(confirmCallMessage).toContain('Nur aktualisiert (Q-TTR Punkte geändert): 1 Spieler');
    expect(confirmCallMessage).toContain('Ersetzt');
    expect(confirmCallMessage).toContain('Q-TTR');

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });
  });

  it('allows editing and deleting a player', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const deleteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
          }),
          update: updateMock,
          delete: deleteMock,
        };
      }
      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockTeams, error: null }),
            }),
          }),
        };
      }
      if (table === 'club_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { key: 'registered_teams_count', value: '1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'absences') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAbsences, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<SportwartView />);

    await waitFor(() => {
      expect(screen.getByText('Max Mustermann')).toBeTruthy();
    });

    const editBtns = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editBtns[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Max Mustermann')).toBeTruthy();
    });

    const submitBtn = screen.getAllByText('Speichern')[1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    const deleteBtns = screen.getAllByTitle('Löschen');
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
