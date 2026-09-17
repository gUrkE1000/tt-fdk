import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AbsencesView from '../src/components/AbsencesView';
import { supabase } from '../src/lib/supabaseClient';

vi.mock('../src/lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('AbsencesView', () => {
  const mockUserId = 'user-123';
  const mockAbsences = [
    {
      id: 'abs-1',
      player_id: mockUserId,
      start_date: '2026-08-15',
      end_date: '2026-08-20',
      reason: 'Summer Holidays',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    vi.stubGlobal('alert', vi.fn());
  });

  it('renders loading state then loads and displays absences', async () => {
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockAbsences, error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AbsencesView userId={mockUserId} />);

    // Renders list after loading
    await waitFor(() => {
      expect(screen.getByText(/Mein Abwesenheits-Kalender/)).toBeTruthy();
      expect(screen.getByText('Eingetragene Abwesenheiten (1)')).toBeTruthy();
      expect(screen.getByText(/Summer Holidays/)).toBeTruthy();
    });
  });

  it('allows adding a new absence and reloads the list', async () => {
    const orderMock = vi.fn()
      .mockResolvedValueOnce({ data: [], error: null }) // first load: empty
      .mockResolvedValueOnce({ data: mockAbsences, error: null }); // second load: after insert

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: orderMock,
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AbsencesView userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Eingetragene Abwesenheiten (0)')).toBeTruthy();
    });

    // Fill the form
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const startInput = dateInputs[0];
    const endInput = dateInputs[1];
    const reasonInput = screen.getByPlaceholderText('z.B. Urlaub, Spätschicht, Krank');

    fireEvent.change(startInput, { target: { value: '2026-08-15' } });
    fireEvent.change(endInput, { target: { value: '2026-08-20' } });
    fireEvent.change(reasonInput, { target: { value: 'Summer Holidays' } });

    const submitBtn = screen.getByRole('button', { name: 'Eintragen' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('absences');
      expect(screen.getByText('Eingetragene Abwesenheiten (1)')).toBeTruthy();
    });
  });

  it('allows deleting an absence', async () => {
    const orderMock = vi.fn()
      .mockResolvedValueOnce({ data: mockAbsences, error: null }) // first load
      .mockResolvedValueOnce({ data: [], error: null }); // after delete

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: orderMock,
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as any);

    render(<AbsencesView userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('Eingetragene Abwesenheiten (1)')).toBeTruthy();
    });

    const deleteBtn = screen.getByTitle('Abwesenheit löschen');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(screen.getByText('Eingetragene Abwesenheiten (0)')).toBeTruthy();
    });
  });
});
