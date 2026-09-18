import { describe, it, expect } from 'vitest';
import {
  compareLineupCandidates,
  orderLineupCandidates,
  type LineupCandidate,
} from '../../supabase/functions/_shared/lineupOrder';

/** Ein Kandidat, bei dem alles gleich ist außer dem, was der Test setzt. */
function candidate(overrides: Partial<LineupCandidate> & { profileId: string }): LineupCandidate {
  return {
    response: 'none',
    isRegular: true,
    teamNumber: 1,
    positionNumber: 1,
    name: overrides.profileId,
    ...overrides,
  };
}

const ids = (list: LineupCandidate[]) => list.map((entry) => entry.profileId);

describe('orderLineupCandidates — die Rückmeldung entscheidet zuerst', () => {
  it('sortiert ja, keine Antwort, unsicher, nein', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'unsicher', response: 'unclear' }),
      candidate({ profileId: 'nein', response: 'no' }),
      candidate({ profileId: 'offen', response: 'none' }),
      candidate({ profileId: 'ja', response: 'yes' }),
    ]);

    expect(ids(order)).toEqual(['ja', 'offen', 'unsicher', 'nein']);
  });

  it('stellt eine Zusage vor einen besser platzierten Absager', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'nein-1.1', response: 'no', positionNumber: 1 }),
      candidate({ profileId: 'ja-1.4', response: 'yes', positionNumber: 4 }),
    ]);

    expect(ids(order)).toEqual(['ja-1.4', 'nein-1.1']);
  });

  it('stellt „keine Antwort" vor „unsicher", auch bei besserer Position', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'unsicher-1.1', response: 'unclear', positionNumber: 1 }),
      candidate({ profileId: 'offen-1.9', response: 'none', positionNumber: 9 }),
    ]);

    expect(ids(order)).toEqual(['offen-1.9', 'unsicher-1.1']);
  });
});

describe('orderLineupCandidates — danach Stamm vor Ersatz', () => {
  it('stellt bei gleicher Rückmeldung den Stammspieler vor', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'ersatz', response: 'yes', isRegular: false, positionNumber: 1 }),
      candidate({ profileId: 'stamm', response: 'yes', isRegular: true, positionNumber: 4 }),
    ]);

    expect(ids(order)).toEqual(['stamm', 'ersatz']);
  });

  it('greift nicht über die Rückmeldung hinweg', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'stamm-nein', response: 'no', isRegular: true }),
      candidate({ profileId: 'ersatz-ja', response: 'yes', isRegular: false }),
    ]);

    expect(ids(order)).toEqual(['ersatz-ja', 'stamm-nein']);
  });
});

describe('orderLineupCandidates — danach die Vereinsrangfolge', () => {
  it('sortiert nach Mannschaftsnummer, dann nach Position', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: '2.1', response: 'yes', teamNumber: 2, positionNumber: 1 }),
      candidate({ profileId: '1.3', response: 'yes', teamNumber: 1, positionNumber: 3 }),
      candidate({ profileId: '1.1', response: 'yes', teamNumber: 1, positionNumber: 1 }),
    ]);

    expect(ids(order)).toEqual(['1.1', '1.3', '2.1']);
  });

  it('stellt Spieler ohne Rang hinter alle mit Rang', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'ohne', response: 'yes', teamNumber: null, positionNumber: null }),
      candidate({ profileId: 'mit-9.9', response: 'yes', teamNumber: 9, positionNumber: 9 }),
    ]);

    expect(ids(order)).toEqual(['mit-9.9', 'ohne']);
  });

  it('stellt eine fehlende Position hinter jede vorhandene derselben Mannschaft', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'ohne-position', response: 'yes', teamNumber: 1, positionNumber: null }),
      candidate({ profileId: '1.6', response: 'yes', teamNumber: 1, positionNumber: 6 }),
    ]);

    expect(ids(order)).toEqual(['1.6', 'ohne-position']);
  });
});

describe('orderLineupCandidates — zuletzt der Name', () => {
  it('sortiert Gleichstand alphabetisch', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'b', response: 'yes', teamNumber: null, positionNumber: null, name: 'Bernd' }),
      candidate({ profileId: 'a', response: 'yes', teamNumber: null, positionNumber: null, name: 'Anna' }),
    ]);

    expect(ids(order)).toEqual(['a', 'b']);
  });

  it('sortiert Umlaute deutsch, nicht nach Zeichencode', () => {
    // „Ö" läge nach Zeichencode hinter „Z". Im Deutschen gehört es zwischen O und P.
    const order = orderLineupCandidates([
      candidate({ profileId: 'z', response: 'yes', teamNumber: null, positionNumber: null, name: 'Zink' }),
      candidate({ profileId: 'oe', response: 'yes', teamNumber: null, positionNumber: null, name: 'Öztürk' }),
    ]);

    expect(ids(order)).toEqual(['oe', 'z']);
  });
});

describe('orderLineupCandidates — Eigenschaften der Funktion', () => {
  it('verändert die übergebene Liste nicht', () => {
    const input = [
      candidate({ profileId: 'b', response: 'no' }),
      candidate({ profileId: 'a', response: 'yes' }),
    ];

    orderLineupCandidates(input);

    expect(ids(input)).toEqual(['b', 'a']);
  });

  it('liefert bei leerer Eingabe eine leere Liste', () => {
    expect(orderLineupCandidates([])).toEqual([]);
  });

  it('ist unabhängig von der Eingabereihenfolge', () => {
    const list = [
      candidate({ profileId: 'ja-1.1', response: 'yes', positionNumber: 1 }),
      candidate({ profileId: 'ja-1.2', response: 'yes', positionNumber: 2 }),
      candidate({ profileId: 'offen', response: 'none', positionNumber: 3 }),
      candidate({ profileId: 'nein', response: 'no', positionNumber: 4 }),
    ];
    const expected = ids(orderLineupCandidates(list));

    expect(ids(orderLineupCandidates([...list].reverse()))).toEqual(expected);
  });
});

describe('compareLineupCandidates', () => {
  it('meldet Gleichstand bei identischen Kandidaten', () => {
    const only = candidate({ profileId: 'a' });
    expect(compareLineupCandidates(only, { ...only })).toBe(0);
  });

  it('ist in beiden Richtungen entgegengesetzt', () => {
    const first = candidate({ profileId: 'a', response: 'yes' });
    const second = candidate({ profileId: 'b', response: 'no' });

    expect(compareLineupCandidates(first, second)).toBeLessThan(0);
    expect(compareLineupCandidates(second, first)).toBeGreaterThan(0);
  });
});
