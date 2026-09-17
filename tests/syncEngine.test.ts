import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncTeamCalendar } from '../src/lib/syncEngine';
import { SupabaseClient } from '@supabase/supabase-js';

describe('syncTeamCalendar Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockImplementation((query?: string) => {
            if (table === 'teams') {
              return {
                eq: vi.fn().mockImplementation((col: string, val: any) => {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: val,
                        name: 'Erwachsene III',
                        short_name: 'Erwachsene 3',
                        webcal_url: 'webcal://example.com/calendar.ics',
                      },
                      error: null,
                    }),
                  };
                }),
              };
            }
            if (table === 'matches') {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'm-existing-1',
                      team_id: 'team-3',
                      external_uid: 'uid-existing-1',
                      summary: 'Erwachsene III vs TV Klaswipper III',
                      dtstart: '2026-09-12T16:00:00.000Z',
                      dtend: '2026-09-12T19:00:00.000Z',
                      is_home: true,
                      version: 1,
                      active: true,
                    },
                    {
                      id: 'm-existing-2',
                      team_id: 'team-3',
                      external_uid: 'uid-to-deactivate',
                      summary: 'Some cancelled opponent vs Erwachsene III',
                      dtstart: '2026-09-26T16:00:00.000Z',
                      dtend: '2026-09-26T19:00:00.000Z',
                      is_home: false,
                      version: 1,
                      active: true,
                    }
                  ],
                  error: null,
                }),
              };
            }
            return { error: null, data: [] };
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockImplementation(() => {
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }),
    } as unknown as SupabaseClient;
  });

  it('should successfully sync calendar, adding, rescheduling and deactivating matches', async () => {
    const mockIcsText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:uid-existing-1
DTSTART;TZID=Europe/Berlin:20260913T180000
DTEND;TZID=Europe/Berlin:20260913T210000
SUMMARY:Erwachsene III vs TV Klaswipper III
LOCATION:Heiligenhaus
DESCRIPTION:Spieltag: 1
END:VEVENT
BEGIN:VEVENT
UID:uid-new
DTSTART;TZID=Europe/Berlin:20260919T180000
DTEND;TZID=Europe/Berlin:20260919T210000
SUMMARY:VfL Engelskirchen vs Erwachsene III
LOCATION:Engelskirchen
DESCRIPTION:Spieltag: 2
END:VEVENT
END:VCALENDAR`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(mockIcsText),
    });
    vi.stubGlobal('fetch', mockFetch);

    const syncRes = await syncTeamCalendar(mockSupabase, 'team-3');

    expect(syncRes.status).toBe('success');
    expect(syncRes.added).toBe(1);
    expect(syncRes.rescheduled).toBe(1);
    expect(syncRes.deactivated).toBe(1);
    expect(syncRes.updated).toBe(0);
  });

  it('handles error when team is not found or webcal URL is missing', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    }));

    const res = await syncTeamCalendar(mockSupabase, 'invalid-team');
    expect(res.status).toBe('failed');
    expect(res.message).toContain('Team not found');
  });

  it('updates match details when other details change without date/time change', async () => {
    const mockIcsText = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:uid-existing-1
DTSTART;TZID=Europe/Berlin:20260912T180000
DTEND;TZID=Europe/Berlin:20260912T210000
SUMMARY:Erwachsene III vs TV Klaswipper III (Updated Title)
LOCATION:Heiligenhaus New Gym
DESCRIPTION:Spieltag: 1
END:VEVENT
END:VCALENDAR`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(mockIcsText),
    }));

    const syncRes = await syncTeamCalendar(mockSupabase, 'team-3');

    expect(syncRes.status).toBe('success');
    expect(syncRes.updated).toBe(1);
  });

  it('handles AllOrigins /get base64 encoded response fallback', async () => {
    const rawIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:uid-existing-1
DTSTART;TZID=Europe/Berlin:20260912T180000
DTEND;TZID=Europe/Berlin:20260912T210000
SUMMARY:Erwachsene III vs TV Klaswipper III
LOCATION:Heiligenhaus
DESCRIPTION:Spieltag: 1
END:VEVENT
END:VCALENDAR`;
    const base64Ics = typeof btoa !== 'undefined' ? btoa(rawIcs) : globalThis.btoa(rawIcs);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('api.allorigins.win/raw')) {
        return { ok: false, status: 500 };
      }
      if (url.includes('api.allorigins.win/get')) {
        return {
          ok: true,
          json: async () => ({ contents: `data:text/calendar;base64,${base64Ics}` }),
        };
      }
      return { ok: false };
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await syncTeamCalendar(mockSupabase, 'team-3');
    expect(res.status).toBe('success');
  });

  it('falls back to Codetabs proxy and then direct fetch if AllOrigins fails', async () => {
    const rawIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:uid-existing-1
DTSTART;TZID=Europe/Berlin:20260912T180000
DTEND;TZID=Europe/Berlin:20260912T210000
SUMMARY:Erwachsene III vs TV Klaswipper III
LOCATION:Heiligenhaus
DESCRIPTION:Spieltag: 1
END:VEVENT
END:VCALENDAR`;

    const mockFetchCodetabs = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('api.allorigins.win')) {
        throw new Error('AllOrigins down');
      }
      if (url.includes('api.codetabs.com')) {
        return {
          ok: true,
          text: async () => rawIcs,
        };
      }
      return { ok: false };
    });
    vi.stubGlobal('fetch', mockFetchCodetabs);

    const res = await syncTeamCalendar(mockSupabase, 'team-3');
    expect(res.status).toBe('success');
  });

  it('returns failed status when all fetch methods fail or webcal_url is empty', async () => {
    // 1. Missing webcal_url
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'team-no-url', name: 'No URL Team', webcal_url: '' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    });

    const resNoUrl = await syncTeamCalendar(mockSupabase, 'team-no-url');
    expect(resNoUrl.status).toBe('failed');
    expect(resNoUrl.message).toContain('Webcal URL is missing');

    // 2. All fetch methods fail
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'team-3', name: 'Erwachsene III', webcal_url: 'webcal://example.com/cal.ics' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

    const resFetchFail = await syncTeamCalendar(mockSupabase, 'team-3');
    expect(resFetchFail.status).toBe('failed');
    expect(resFetchFail.message).toContain('Alle Verbindungsmethoden zum Kalender-Download sind fehlgeschlagen');
  });
});
