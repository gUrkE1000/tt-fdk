import { describe, it, expect } from 'vitest';
import {
  EMPTY_PERIOD,
  formatRate,
  inPeriod,
  isAttendance,
  lastTwelveMonths,
  tallyByTraining,
  topAttendance,
  toCsv,
  type StatisticsRow,
} from '../../src/features/statistics/summary';

function row(overrides: Partial<StatisticsRow>): StatisticsRow {
  return {
    training_id: 't-1',
    training_name: 'Erwachsenentraining',
    profile_id: 'p-1',
    full_name: 'Spieler 01',
    session_date: '2026-09-01',
    status: 'yes',
    ...overrides,
  };
}

describe('isAttendance', () => {
  it('zählt „komme später" als Anwesenheit', () => {
    // Wer zwanzig Minuten später kommt, war da.
    expect(isAttendance('yes')).toBe(true);
    expect(isAttendance('late')).toBe(true);
  });

  it('zählt Absage und fehlende Meldung nicht', () => {
    expect(isAttendance('no')).toBe(false);
    expect(isAttendance('none')).toBe(false);
    expect(isAttendance(null)).toBe(false);
  });
});

describe('inPeriod', () => {
  it('schließt beide Grenzen ein', () => {
    const period = { from: '2026-09-01', to: '2026-09-30' };
    expect(inPeriod('2026-09-01', period)).toBe(true);
    expect(inPeriod('2026-09-30', period)).toBe(true);
    expect(inPeriod('2026-08-31', period)).toBe(false);
    expect(inPeriod('2026-10-01', period)).toBe(false);
  });

  it('lässt ohne Grenzen alles durch', () => {
    expect(inPeriod('2020-01-01', EMPTY_PERIOD)).toBe(true);
    expect(inPeriod(null, EMPTY_PERIOD)).toBe(false);
  });
});

describe('lastTwelveMonths', () => {
  it('spannt genau ein Jahr auf', () => {
    expect(lastTwelveMonths(new Date(2026, 8, 18))).toEqual({
      from: '2025-09-18',
      to: '2026-09-18',
    });
  });
});

describe('tallyByTraining', () => {
  const rows = [
    row({ session_date: '2026-09-01', status: 'yes' }),
    row({ session_date: '2026-09-08', status: 'late' }),
    row({ session_date: '2026-09-15', status: 'no' }),
    row({ session_date: '2026-09-22', status: 'none' }),
    row({ profile_id: 'p-2', full_name: 'Spieler 02', session_date: '2026-09-01', status: 'no' }),
  ];

  it('trennt da gewesen, abgesagt und nicht gemeldet', () => {
    const [tally] = tallyByTraining(rows);
    const member = tally.members.find((entry) => entry.profileId === 'p-1')!;

    expect(member.attended).toBe(2);
    expect(member.declined).toBe(1);
    expect(member.missing).toBe(1);
    expect(member.rate).toBe(0.5);
  });

  it('zählt Termine, nicht Zeilen', () => {
    // Sonst hätte ein Training mit zehn Mitgliedern zehnmal so viele „Termine".
    const [tally] = tallyByTraining(rows);
    expect(tally.sessions).toBe(4);
  });

  it('achtet auf den Zeitraum', () => {
    const [tally] = tallyByTraining(rows, { from: '2026-09-08', to: '2026-09-15' });
    const member = tally.members.find((entry) => entry.profileId === 'p-1')!;

    expect(member.sessions).toBe(2);
    expect(member.attended).toBe(1);
  });

  it('liefert ohne passende Zeilen gar nichts', () => {
    expect(tallyByTraining(rows, { from: '2030-01-01', to: '2030-12-31' })).toEqual([]);
  });
});

describe('topAttendance', () => {
  it('sortiert nach Anzahl, nicht nach Quote', () => {
    // Zwei von zwei darf nicht über fünfzig von sechzig stehen.
    const rows = [
      ...Array.from({ length: 50 }, (_, i) =>
        row({ profile_id: 'fleissig', full_name: 'Fleißig', session_date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, status: 'yes' }),
      ),
      ...Array.from({ length: 10 }, () =>
        row({ profile_id: 'fleissig', full_name: 'Fleißig', status: 'no' }),
      ),
      row({ profile_id: 'selten', full_name: 'Selten', status: 'yes' }),
      row({ profile_id: 'selten', full_name: 'Selten', status: 'yes' }),
    ];

    const top = topAttendance(rows);
    expect(top[0].name).toBe('Fleißig');
    expect(top[0].attended).toBe(50);
  });

  it('lässt weg, wer nie da war', () => {
    const top = topAttendance([row({ status: 'no' })]);
    expect(top).toEqual([]);
  });

  it('bricht bei zehn ab', () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      row({ profile_id: `p-${i}`, full_name: `Spieler ${i}`, status: 'yes' }),
    );
    expect(topAttendance(rows)).toHaveLength(10);
  });
});

describe('formatRate', () => {
  it('rundet auf ganze Prozent', () => {
    expect(formatRate(0.833)).toBe('83 %');
    expect(formatRate(1)).toBe('100 %');
  });

  it('erfindet keine Null, wo nichts zu rechnen war', () => {
    expect(formatRate(null)).toBe('—');
  });
});

describe('toCsv', () => {
  const [tally] = tallyByTraining([
    row({ session_date: '2026-09-01', status: 'yes' }),
    row({ session_date: '2026-09-08', status: 'no' }),
  ]);

  it('trennt mit Semikolon und beginnt mit einem BOM', () => {
    // Beides, damit Excel in einer deutschen Installation die Datei richtig öffnet.
    const csv = toCsv(tally);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Name;Teilnahmen;Absagen;Keine Rückmeldung;Termine;Quote');
  });

  it('schreibt eine Zeile je Mitglied', () => {
    expect(toCsv(tally)).toContain('"Spieler 01";1;1;0;2;"50 %"');
  });

  it('maskiert Anführungszeichen im Namen', () => {
    const [quoted] = tallyByTraining([row({ full_name: 'Anna "Ass" Admin' })]);
    expect(toCsv(quoted)).toContain('"Anna ""Ass"" Admin"');
  });
});
