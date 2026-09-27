import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

const state = {
  tables: {} as Record<string, Row[]>,
  denied: new Set<string>(),
  filters: [] as { table: string; column: string; value: unknown }[],
};

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    rpc: (name: string) =>
      Promise.resolve(
        name === 'rpc_my_profile'
          ? { data: [{ id: 'me', first_name: 'Lea', email: 'lea@example.org' }], error: null }
          : { data: null, error: { message: 'unbekannt' } },
      ),
    from: (table: string) => {
      let column = '';
      let value: unknown;
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: (c: string, v: unknown) => {
          column = c;
          value = v;
          state.filters.push({ table, column: c, value: v });
          return chain;
        },
        range: () =>
          Promise.resolve(
            state.denied.has(table)
              ? { data: null, error: { message: 'permission denied' }, count: null }
              : (() => {
                  const rows = (state.tables[table] ?? []).filter((row) => row[column] === value);
                  return { data: rows, error: null, count: rows.length };
                })(),
          ),
      };
      return chain;
    },
  },
}));

import { buildDataExport, exportFileName, stripSecrets } from '../../src/features/profile/dataExport';

beforeEach(() => {
  state.filters = [];
  state.denied = new Set();
  state.tables = {
    v_absences: [
      { id: 'a1', profile_id: 'me', comment_private: 'Urlaub' },
      { id: 'a2', profile_id: 'other', comment_private: 'fremd' },
    ],
    notifications: [
      {
        id: 'n1',
        profile_id: 'me',
        body_text: 'Bist du dabei? https://verein.example.org/r/0f8b5c1e-1d2a-4c3b-9a8e-7f6d5c4b3a21',
        payload: { token: 'ANTWORT-TOKEN-XYZ', link: 'https://verein.example.org/r/0f8b5c1e-1d2a-4c3b-9a8e-7f6d5c4b3a21' },
      },
    ],
    push_subscriptions: [{ id: 'p1', profile_id: 'me', endpoint: 'https://fcm.googleapis.com/x', p256dh: 'k', auth: 's' }],
    calendar_tokens: [{ profile_id: 'me', token: 'kalender-geheim', include_trainings: true }],
    v_session_keys: [{ session_id: 's1', bearer_id: 'me' }],
  };
});

describe('buildDataExport', () => {
  it('sammelt Profil und die eigenen Zeilen jeder Tabelle', async () => {
    const data = await buildDataExport('me', new Date('2026-09-27T10:00:00Z'));

    expect(data.erstellt_am).toBe('2026-09-27T10:00:00.000Z');
    expect(data.profil).toEqual([{ id: 'me', first_name: 'Lea', email: 'lea@example.org' }]);
    expect(data.abwesenheiten).toEqual([{ id: 'a1', profile_id: 'me', comment_private: 'Urlaub' }]);
    expect(data.hallenschluessel).toEqual([{ session_id: 's1', bearer_id: 'me' }]);
    expect(data.nicht_lesbar).toEqual([]);
    // Nie eine fremde Kennung als Filter.
    expect(state.filters.every((filter) => filter.value === 'me')).toBe(true);
  });

  it('lässt Zugangsgeheimnisse weg', async () => {
    const data = await buildDataExport('me');
    const text = JSON.stringify(data);

    expect(text).not.toContain('kalender-geheim');
    expect(text).not.toContain('ANTWORT-TOKEN-XYZ');
    expect(text).not.toContain('0f8b5c1e');
    expect(data.push_geraete).toEqual([
      { id: 'p1', profile_id: 'me', endpoint: 'https://fcm.googleapis.com/x' },
    ]);
  });

  it('nennt, was sich nicht lesen ließ, statt es still auszulassen', async () => {
    state.denied.add('notifications');
    const data = await buildDataExport('me');
    expect(data.nicht_lesbar).toEqual(['benachrichtigungen']);
    expect(data.benachrichtigungen).toBeUndefined();
  });
});

describe('stripSecrets', () => {
  it('arbeitet verschachtelt', () => {
    expect(stripSecrets({ a: [{ token: 'x', b: 1 }], auth: 'y' })).toEqual({ a: [{ b: 1 }] });
  });
});

describe('exportFileName', () => {
  it('trägt das Datum in deutscher Zeit', () => {
    expect(exportFileName(new Date('2026-09-27T23:30:00Z'))).toBe(
      'vereinsplaner-meine-daten-2026-09-28.json',
    );
  });
});
