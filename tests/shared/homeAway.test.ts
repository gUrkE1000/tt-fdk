import { describe, it, expect } from 'vitest';
import { determineHomeAway } from '../../supabase/functions/_shared/homeAway';

const ALIASES = ['ttc musterstadt', 'musterstadt'];

describe('determineHomeAway', () => {
  it('erkennt ein Heimspiel über einen Vereins-Alias', () => {
    const info = determineHomeAway('TTC Musterstadt II vs TV Beispiel III', 'Erwachsene II', ALIASES);
    expect(info.isHome).toBe(true);
    expect(info.opponent).toBe('TV Beispiel III');
  });

  it('erkennt ein Auswärtsspiel über einen Vereins-Alias', () => {
    const info = determineHomeAway('TV Beispiel III vs TTC Musterstadt II', 'Erwachsene II', ALIASES);
    expect(info.isHome).toBe(false);
    expect(info.opponent).toBe('TV Beispiel III');
  });

  it('vergleicht Aliase ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    const info = determineHomeAway('ttc MUSTERSTADT I vs TV Beispiel', 'Erwachsene I', ['TTC Musterstadt']);
    expect(info.isHome).toBe(true);
  });

  it('greift auf den Mannschaftsnamen zurück, wenn kein Alias passt', () => {
    const info = determineHomeAway('TV Beispiel vs Erwachsene III', 'Erwachsene III', []);
    expect(info.isHome).toBe(false);
    expect(info.opponent).toBe('TV Beispiel');
  });

  it('nimmt bei Mehrdeutigkeit ein Heimspiel an', () => {
    // Weder Alias noch Mannschaftsname passen auf eine der beiden Seiten.
    const info = determineHomeAway('TV Eins vs TV Zwei', 'Erwachsene I', ALIASES);
    expect(info.isHome).toBe(true);
    expect(info.opponent).toBe('TV Zwei');
  });

  it('kommt mit einem Titel ohne vs zurecht', () => {
    const info = determineHomeAway('Vereinsmeisterschaft', 'Erwachsene I', ALIASES);
    expect(info.isHome).toBe(true);
    expect(info.opponent).toBe('Vereinsmeisterschaft');
  });

  it('erkennt auch die Schreibweise mit Punkt', () => {
    const info = determineHomeAway('TTC Musterstadt vs. TV Beispiel', 'Erwachsene I', ALIASES);
    expect(info.isHome).toBe(true);
    expect(info.opponent).toBe('TV Beispiel');
  });
});
