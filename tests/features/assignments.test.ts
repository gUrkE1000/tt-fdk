import { describe, it, expect } from 'vitest';
import {
  assignmentText,
  memberAssignments,
} from '../../src/features/club/assignments';

// Die Zuordnungsspalten der Vereinsübersicht (früher in keys.test.tsx; die
// Schlüsselverwaltung gibt es nicht mehr, an ihrer Stelle steht der Schlüsseldienst).

describe('memberAssignments', () => {
  const map = memberAssignments({
    trainings: [
      { name: 'Erwachsenentraining', memberIds: ['p-1', 'p-2'] },
      { name: 'Jugendtraining', memberIds: ['p-2'] },
    ],
    teams: [
      { name: '1. Herren', regularIds: ['p-1'], substituteIds: ['p-2'] },
      { name: '2. Herren', regularIds: [], substituteIds: ['p-2'] },
    ],
    keyDuty: [
      { weekday: 'Montag', profile_id: 'p-1' },
      { weekday: 'Donnerstag', profile_id: 'p-1' },
    ],
  });

  it('sammelt die Trainings je Mitglied', () => {
    expect(map.get('p-2')?.trainings).toEqual(['Erwachsenentraining', 'Jugendtraining']);
  });

  it('trennt Kader und Ersatz', () => {
    expect(map.get('p-1')?.teams).toEqual(['1. Herren']);
    expect(map.get('p-2')?.substituteFor).toEqual(['1. Herren', '2. Herren']);
    expect(map.get('p-2')?.teams).toEqual([]);
  });

  it('nennt die festen Tage im Schlüsseldienst', () => {
    expect(map.get('p-1')?.keyDuty).toEqual(['Montag', 'Donnerstag']);
    expect(map.get('p-2')?.keyDuty).toEqual([]);
    expect(map.has('kein-mitglied')).toBe(false);
  });

  it('formatiert leere Listen als Gedankenstrich', () => {
    expect(assignmentText([])).toBe('—');
    expect(assignmentText(['1. Herren', '2. Herren'])).toBe('1. Herren, 2. Herren');
  });
});
