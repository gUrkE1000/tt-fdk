import { describe, it, expect } from 'vitest';
import {
  orderLineupCandidates,
  type LineupCandidate,
} from '../../supabase/functions/_shared/lineupOrder';

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

describe('orderLineupCandidates', () => {
  it('stellt Zusagen nach vorn', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'nein', response: 'no', positionNumber: 1 }),
      candidate({ profileId: 'ja', response: 'yes', positionNumber: 4 }),
    ]).map((c) => c.profileId);

    expect(order).toEqual(['ja', 'nein']);
  });

  it('sortiert nach Antwort: ja, keine Antwort, unsicher, nein', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'unsicher', response: 'unclear', positionNumber: 1 }),
      candidate({ profileId: 'nein', response: 'no', positionNumber: 2 }),
      candidate({ profileId: 'offen', response: 'none', positionNumber: 3 }),
      candidate({ profileId: 'ja', response: 'yes', positionNumber: 4 }),
    ]).map((c) => c.profileId);

    expect(order).toEqual(['ja', 'offen', 'unsicher', 'nein']);
  });

  it('stellt bei gleicher Antwort Stammspieler vor Ersatzspieler', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'ersatz', response: 'yes', isRegular: false, positionNumber: 1 }),
      candidate({ profileId: 'stamm', response: 'yes', isRegular: true, positionNumber: 4 }),
    ]).map((c) => c.profileId);

    expect(order).toEqual(['stamm', 'ersatz']);
  });

  it('entscheidet danach über die Vereinsrangfolge', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: '2.1', response: 'yes', teamNumber: 2, positionNumber: 1 }),
      candidate({ profileId: '1.3', response: 'yes', teamNumber: 1, positionNumber: 3 }),
      candidate({ profileId: '1.1', response: 'yes', teamNumber: 1, positionNumber: 1 }),
    ]).map((c) => c.profileId);

    expect(order).toEqual(['1.1', '1.3', '2.1']);
  });

  it('sortiert Spieler ohne Rang ans Ende ihrer Gruppe, dann alphabetisch', () => {
    const order = orderLineupCandidates([
      candidate({ profileId: 'ohne-b', response: 'yes', teamNumber: null, positionNumber: null, name: 'Bernd' }),
      candidate({ profileId: 'ohne-a', response: 'yes', teamNumber: null, positionNumber: null, name: 'Anna' }),
      candidate({ profileId: 'mit', response: 'yes', teamNumber: 3, positionNumber: 9, name: 'Zora' }),
    ]).map((c) => c.profileId);

    expect(order).toEqual(['mit', 'ohne-a', 'ohne-b']);
  });

  it('verändert die übergebene Liste nicht', () => {
    const input = [
      candidate({ profileId: 'b', response: 'no' }),
      candidate({ profileId: 'a', response: 'yes' }),
    ];
    const before = input.map((c) => c.profileId);

    orderLineupCandidates(input);

    expect(input.map((c) => c.profileId)).toEqual(before);
  });
});
