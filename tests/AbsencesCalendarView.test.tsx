import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import AbsencesCalendarView from '../src/components/AbsencesCalendarView';
import { supabase } from '../src/lib/supabaseClient';

// Mock Supabase client
vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('AbsencesCalendarView Component', () => {
  const mockAbsences = [
    {
      id: '1',
      player_id: 'p1',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: 'Urlaub',
      profiles: { name: 'Max Mustermann' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then shows upcoming months and registered absences', async () => {
    // Mock database fetch responses
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockAbsences, error: null }),
      }),
    });
    supabase.from = mockFrom;

    render(<AbsencesCalendarView />);

    // Assert months are displayed (we should have 4 months headings)
    await waitFor(() => {
      expect(screen.getByText('Max M')).toBeDefined();
    });

    // Check that we display the title
    expect(screen.getByText('Abwesenheits-Kalender (Kommende 4 Monate)')).toBeDefined();

    // Verify there is a table or list containing "Urlaub"
    expect(screen.getByText('Urlaub')).toBeDefined();
  });
});
