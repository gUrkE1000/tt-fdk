import { describe, it, expect } from 'vitest';
import {
  ROLE_LABELS,
  STATUS_LABELS,
  GENDER_LABELS,
  RANKING_TYPE_LABELS,
  roleLabel,
  formatRanking,
  parseRanking,
} from '../../src/lib/labels';

/**
 * Diese Tests sind der Grund, warum labels.ts als Record<Enum, string> getippt ist:
 * Wer einen Enum-Wert in der Datenbank ergänzt und die Beschriftung vergisst, bekommt
 * schon beim Typcheck einen Fehler — und hier zusätzlich einen roten Test.
 */

describe('Beschriftungen', () => {
  it('kennt alle sechs Benutzerrollen', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(6);
    expect(ROLE_LABELS.team_leader).toBe('Mannschaftsführer');
    expect(ROLE_LABELS.organizer).toBe('Organisator');
  });

  it('kennt alle drei Mitgliedsstatus', () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(3);
  });

  it('kennt beide Geschlechter plus „keine Angabe"', () => {
    expect(Object.keys(GENDER_LABELS)).toHaveLength(3);
  });

  it('kennt alle 15 Rangtypen des TT-Planers', () => {
    expect(Object.keys(RANKING_TYPE_LABELS)).toHaveLength(15);
    expect(RANKING_TYPE_LABELS.men).toBe('Erwachsene');
    expect(RANKING_TYPE_LABELS.girls_11).toBe('Mädchen 11');
  });

  it('hat keine leere Beschriftung', () => {
    const all = {
      ...ROLE_LABELS,
      ...STATUS_LABELS,
      ...GENDER_LABELS,
      ...RANKING_TYPE_LABELS,
    };
    for (const [key, label] of Object.entries(all)) {
      expect(label, key).not.toBe('');
    }
  });

  it('liefert für null einen leeren Text statt undefined', () => {
    expect(roleLabel(null)).toBe('');
    expect(roleLabel(undefined)).toBe('');
  });
});

describe('Ränge', () => {
  it('formatiert Mannschaft und Position als 1.2', () => {
    expect(formatRanking(1, 2)).toBe('1.2');
    expect(formatRanking(12, 10)).toBe('12.10');
  });

  it('liest 1.2 wieder ein', () => {
    expect(parseRanking('1.2')).toEqual({ teamNumber: 1, positionNumber: 2 });
    expect(parseRanking('  3 . 4 ')).toEqual({ teamNumber: 3, positionNumber: 4 });
  });

  it('weist Unsinn zurück, statt etwas zu erfinden', () => {
    expect(parseRanking('')).toBeNull();
    expect(parseRanking('1')).toBeNull();
    expect(parseRanking('1.2.3')).toBeNull();
    expect(parseRanking('a.b')).toBeNull();
  });
});
