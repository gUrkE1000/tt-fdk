import { describe, it, expect } from 'vitest';
import {
  BUNDESLAENDER,
  addDays,
  easterSunday,
  nextMigrationTimestamp,
  parsePublicHolidaysApi,
  parseSchoolHolidays,
  publicHolidays,
  repentanceDay,
  sortRows,
  toSql,
  type HolidayRow,
} from '../../scripts/holidays.ts';

describe('easterSunday', () => {
  // Nachgeschlagene Daten, keine aus derselben Formel abgeleiteten.
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2038, '2038-04-25'],
  ])('rechnet Ostern %i auf %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe('repentanceDay', () => {
  it.each([
    [2026, '2026-11-18'],
    [2027, '2027-11-17'],
    [2028, '2028-11-22'],
  ])('legt den Buß- und Bettag %i auf %s', (year, expected) => {
    expect(repentanceDay(year)).toBe(expected);
  });

  it('fällt immer auf einen Mittwoch', () => {
    for (let year = 2026; year <= 2040; year += 1) {
      expect(new Date(`${repentanceDay(year)}T00:00:00Z`).getUTCDay()).toBe(3);
    }
  });
});

describe('addDays', () => {
  it('rechnet über Monatsgrenzen', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('rechnet über den 29. Februar', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('publicHolidays', () => {
  const rows = publicHolidays(2026);
  const nw = rows.filter((row) => row.bundesland === 'NW');
  const nameOn = (state: string, name: string) =>
    rows.find((row) => row.bundesland === state && row.name === name)?.startDate ?? null;

  it('liefert jedes Bundesland', () => {
    expect(new Set(rows.map((row) => row.bundesland)).size).toBe(BUNDESLAENDER.length);
  });

  it('gibt Nordrhein-Westfalen seine elf Feiertage', () => {
    expect(nw).toHaveLength(11);
  });

  it('setzt die beweglichen Feiertage relativ zu Ostern', () => {
    expect(nameOn('NW', 'Karfreitag')).toBe('2026-04-03');
    expect(nameOn('NW', 'Ostermontag')).toBe('2026-04-06');
    expect(nameOn('NW', 'Christi Himmelfahrt')).toBe('2026-05-14');
    expect(nameOn('NW', 'Pfingstmontag')).toBe('2026-05-25');
    expect(nameOn('NW', 'Fronleichnam')).toBe('2026-06-04');
  });

  it('kennt die Feiertage einzelner Länder', () => {
    expect(nameOn('SN', 'Buß- und Bettag')).toBe('2026-11-18');
    expect(nameOn('NW', 'Buß- und Bettag')).toBeNull();
    expect(nameOn('BY', 'Heilige Drei Könige')).toBe('2026-01-06');
    expect(nameOn('NW', 'Heilige Drei Könige')).toBeNull();
    expect(nameOn('BB', 'Ostersonntag')).toBe('2026-04-05');
    expect(nameOn('NW', 'Ostersonntag')).toBeNull();
  });

  it('gibt den bundesweiten Feiertagen alle sechzehn Länder', () => {
    const einheit = rows.filter((row) => row.name === 'Tag der Deutschen Einheit');
    expect(einheit).toHaveLength(16);
    expect(einheit.every((row) => row.startDate === '2026-10-03')).toBe(true);
  });

  it('beschreibt jeden Feiertag als einen Tag', () => {
    expect(rows.every((row) => row.startDate === row.endDate)).toBe(true);
    expect(rows.every((row) => row.kind === 'public')).toBe(true);
  });
});

describe('parsePublicHolidaysApi', () => {
  const payload = {
    NATIONAL: {
      Neujahr: { datum: '2026-01-01', hinweis: '' },
      Karfreitag: { datum: '2026-04-03', hinweis: '' },
    },
    NW: {
      Fronleichnam: { datum: '2026-06-04', hinweis: '' },
    },
    BY: {
      'Mariä Himmelfahrt': { datum: '2026-08-15', hinweis: 'nur in einzelnen Gemeinden' },
    },
  };

  it('verteilt die bundesweiten auf alle Länder', () => {
    const rows = parsePublicHolidaysApi(payload);
    expect(rows.filter((row) => row.name === 'Neujahr')).toHaveLength(16);
  });

  it('lässt die landesweiten bei ihrem Land', () => {
    const rows = parsePublicHolidaysApi(payload);
    const fronleichnam = rows.filter((row) => row.name === 'Fronleichnam');
    expect(fronleichnam).toHaveLength(1);
    expect(fronleichnam[0].bundesland).toBe('NW');
  });

  it('übergeht unbekannte Schlüssel statt daran zu scheitern', () => {
    const rows = parsePublicHolidaysApi({ ...payload, XX: { Irgendwas: { datum: '2026-05-05' } } });
    expect(rows.some((row) => row.bundesland === 'XX')).toBe(false);
  });

  it('übergeht Einträge ohne brauchbares Datum', () => {
    const rows = parsePublicHolidaysApi({ NW: { Kaputt: { hinweis: 'ohne Datum' } } });
    expect(rows).toEqual([]);
  });

  it('bleibt ruhig, wenn gar nichts kommt', () => {
    expect(parsePublicHolidaysApi(null)).toEqual([]);
    expect(parsePublicHolidaysApi('kein Objekt')).toEqual([]);
  });
});

describe('parseSchoolHolidays', () => {
  const payload = [
    {
      start: '2026-04-07T00:00',
      end: '2026-04-18T00:00',
      year: 2026,
      stateCode: 'NW',
      name: 'osterferien',
      slug: 'osterferien-2026-NW',
    },
    {
      start: '2026-10-12T00:00',
      end: '2026-10-24T00:00',
      year: 2026,
      stateCode: 'nw',
      name: 'herbstferien',
      slug: 'herbstferien-2026-NW',
    },
  ];

  it('macht aus dem Zeitstempel ein Datum', () => {
    const rows = parseSchoolHolidays(payload);
    expect(rows[0].startDate).toBe('2026-04-07');
    expect(rows[0].endDate).toBe('2026-04-18');
  });

  it('schreibt die Namen einheitlich groß', () => {
    const rows = parseSchoolHolidays(payload);
    expect(rows.map((row) => row.name).sort()).toEqual(['Herbstferien', 'Osterferien']);
  });

  it('schreibt auch das Bundesland einheitlich', () => {
    expect(parseSchoolHolidays(payload).every((row) => row.bundesland === 'NW')).toBe(true);
  });

  it('nimmt das Land aus dem Aufruf, wenn es fehlt', () => {
    const rows = parseSchoolHolidays(
      [{ start: '2026-04-07', end: '2026-04-18', name: 'osterferien' }],
      'HE',
    );
    expect(rows[0].bundesland).toBe('HE');
  });

  it('übergeht Zeiträume, die rückwärts laufen', () => {
    const rows = parseSchoolHolidays([
      { start: '2026-04-18', end: '2026-04-07', name: 'osterferien', stateCode: 'NW' },
    ]);
    expect(rows).toEqual([]);
  });

  it('bleibt ruhig, wenn gar nichts kommt', () => {
    expect(parseSchoolHolidays(null)).toEqual([]);
    expect(parseSchoolHolidays({ fehler: 'kaputt' })).toEqual([]);
  });
});

describe('sortRows', () => {
  const row = (overrides: Partial<HolidayRow>): HolidayRow => ({
    bundesland: 'NW',
    kind: 'public',
    name: 'Neujahr',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    ...overrides,
  });

  it('wirft Doppelte weg', () => {
    expect(sortRows([row({}), row({})])).toHaveLength(1);
  });

  it('sortiert nach Land, Art und Datum', () => {
    const sorted = sortRows([
      row({ bundesland: 'NW', startDate: '2026-12-25', name: '1. Weihnachtstag' }),
      row({ bundesland: 'BW' }),
      row({ bundesland: 'NW' }),
    ]);
    expect(sorted.map((entry) => `${entry.bundesland} ${entry.startDate}`)).toEqual([
      'BW 2026-01-01',
      'NW 2026-01-01',
      'NW 2026-12-25',
    ]);
  });
});

describe('toSql', () => {
  const rows: HolidayRow[] = [
    {
      bundesland: 'NW',
      kind: 'public',
      name: 'Neujahr',
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    },
  ];

  it('schreibt ein wiederholbares INSERT', () => {
    const sql = toSql(rows);
    expect(sql).toContain('INSERT INTO public.holidays');
    expect(sql).toContain("('NW', 'public', 'Neujahr', '2026-01-01', '2026-01-01')");
    expect(sql).toContain('ON CONFLICT (bundesland, kind, name, start_date) DO NOTHING;');
  });

  it('maskiert Hochkommas im Namen', () => {
    const sql = toSql([{ ...rows[0], name: "O'zapft is" }]);
    expect(sql).toContain("'O''zapft is'");
  });

  it('nimmt Hinweise in den Kopf auf', () => {
    expect(toSql(rows, { notes: ['Ohne Schulferien.'] })).toContain('-- Ohne Schulferien.');
  });

  it('kommt auch ohne Zeilen zurecht', () => {
    const sql = toSql([]);
    expect(sql).toContain('-- Keine Daten.');
    expect(sql).not.toContain('INSERT INTO');
  });
});

describe('nextMigrationTimestamp', () => {
  const now = new Date('2026-09-17T21:30:00Z');

  it('sortiert hinter die jüngste bestehende Migration', () => {
    const stamp = nextMigrationTimestamp(
      ['20261001000000_schema_v2.sql', '20261014000000_trainings.sql'],
      now,
    );
    expect(stamp).toBe('20261014000001');
  });

  it('nimmt die Uhrzeit, wenn die schon weiter ist', () => {
    expect(nextMigrationTimestamp(['20200101000000_alt.sql'], now)).toBe('20260917213000');
  });

  it('kommt mit einem leeren Ordner zurecht', () => {
    expect(nextMigrationTimestamp([], now)).toBe('20260917213000');
  });

  it('übergeht Dateien ohne Zeitstempel', () => {
    expect(nextMigrationTimestamp(['README.md'], now)).toBe('20260917213000');
  });
});
