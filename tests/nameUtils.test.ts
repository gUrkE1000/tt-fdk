import { describe, it, expect } from 'vitest';
import { getShortName, isNameMatch } from '../src/lib/nameUtils';

describe('nameUtils', () => {
  describe('getShortName', () => {
    it('abbreviates a standard full name to Firstname Lastinitial format', () => {
      expect(getShortName('Max Mustermann')).toBe('Max M');
    });

    it('handles multiple first names and abbreviates only the last name', () => {
      expect(getShortName('Karl Heinz Müller')).toBe('Karl Heinz M');
    });

    it('returns the name as-is if it has fewer than two words', () => {
      expect(getShortName('Max')).toBe('Max');
      expect(getShortName('')).toBe('');
    });

    it('trims leading/trailing spaces correctly', () => {
      expect(getShortName('  Max Mustermann  ')).toBe('Max M');
    });
  });

  describe('isNameMatch', () => {
    it('returns true for exact matches (case-insensitive, trimmed)', () => {
      expect(isNameMatch('Max Mustermann', 'max mustermann')).toBe(true);
      expect(isNameMatch('  Max Mustermann  ', 'max mustermann')).toBe(true);
    });

    it('returns true for short form matches', () => {
      expect(isNameMatch('Max M', 'Max Mustermann')).toBe(true);
      expect(isNameMatch('Max M.', 'Max Mustermann')).toBe(true);
      expect(isNameMatch('max m', 'MAX MUSTERMANN')).toBe(true);
    });

    it('returns true for short form matches with multiple first names', () => {
      expect(isNameMatch('Karl Heinz M', 'Karl Heinz Müller')).toBe(true);
      expect(isNameMatch('Karl Heinz M.', 'Karl Heinz Müller')).toBe(true);
    });

    it('returns false if prefixes do not match', () => {
      expect(isNameMatch('Mia M', 'Max Mustermann')).toBe(false);
      expect(isNameMatch('Karl M', 'Karl Heinz Müller')).toBe(false);
    });

    it('returns false for mismatched initials', () => {
      expect(isNameMatch('Max S', 'Max Mustermann')).toBe(false);
    });
  });
});
