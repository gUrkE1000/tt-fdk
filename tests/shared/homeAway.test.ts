import { describe, it, expect } from 'vitest';
import { determineHomeAway } from '../../supabase/functions/_shared/homeAway';

const ALIASES = ['ttc musterstadt', 'musterstadt'];

describe('determineHomeAway — der eindeutige Fall', () => {
  it('erkennt ein Heimspiel, wenn wir links stehen', () => {
    const info = determineHomeAway('TTC Musterstadt II vs TV Beispiel III', 'Erwachsene II', ALIASES);
    expect(info).toEqual({ isHome: true, opponent: 'TV Beispiel III' });
  });

  it('erkennt ein Auswärtsspiel, wenn wir rechts stehen', () => {
    const info = determineHomeAway('TV Beispiel III vs TTC Musterstadt II', 'Erwachsene II', ALIASES);
    expect(info).toEqual({ isHome: false, opponent: 'TV Beispiel III' });
  });
});

describe('determineHomeAway — wie der Titel gelesen wird', () => {
  it('versteht „vs." mit Punkt', () => {
    const info = determineHomeAway('TTC Musterstadt vs. TV Beispiel', 'Erwachsene I', ALIASES);
    expect(info).toEqual({ isHome: true, opponent: 'TV Beispiel' });
  });

  it('versteht „VS" in Großbuchstaben', () => {
    const info = determineHomeAway('TTC Musterstadt VS TV Beispiel', 'Erwachsene I', ALIASES);
    expect(info.isHome).toBe(true);
  });

  it('schneidet Leerraum um die Mannschaftsnamen ab', () => {
    const info = determineHomeAway('TTC Musterstadt   vs   TV Beispiel', 'Erwachsene I', ALIASES);
    expect(info.opponent).toBe('TV Beispiel');
  });

  it('behandelt einen Titel ohne „vs" als Heimtermin mit sich selbst als Gegner', () => {
    const info = determineHomeAway('Vereinsmeisterschaft', 'Erwachsene I', ALIASES);
    expect(info).toEqual({ isHome: true, opponent: 'Vereinsmeisterschaft' });
  });

  it('gibt bei mehr als einem „vs" auf, statt zu raten', () => {
    const info = determineHomeAway('A vs B vs C', 'Erwachsene I', ALIASES);
    expect(info).toEqual({ isHome: true, opponent: 'A vs B vs C' });
  });

  it('lässt sich von „vs" innerhalb eines Wortes nicht täuschen', () => {
    // „Versus" enthält „vs" nicht als eigenes Wort — der Titel bleibt unaufgeteilt.
    const info = determineHomeAway('TTC Versusstadt', 'Erwachsene I', ALIASES);
    expect(info.opponent).toBe('TTC Versusstadt');
  });
});

describe('determineHomeAway — woran wir uns erkennen', () => {
  it('vergleicht Aliase ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    const info = determineHomeAway('ttc MUSTERSTADT I vs TV Beispiel', 'Erwachsene I', ['TTC Musterstadt']);
    expect(info.isHome).toBe(true);
  });

  it('ignoriert Leerraum und leere Einträge in der Aliasliste', () => {
    const info = determineHomeAway('TTC Musterstadt vs TV Beispiel', 'Erwachsene I', ['', '  TTC Musterstadt  ']);
    expect(info.isHome).toBe(true);
  });

  it('greift auf den Mannschaftsnamen zurück, wenn kein Alias passt', () => {
    const info = determineHomeAway('TV Beispiel vs Erwachsene III', 'Erwachsene III', []);
    expect(info).toEqual({ isHome: false, opponent: 'TV Beispiel' });
  });

  it('erkennt den Mannschaftsnamen auch, wenn der Verband ihn länger schreibt', () => {
    const info = determineHomeAway('TV Beispiel vs Erwachsene', 'Erwachsene III', []);
    expect(info.isHome).toBe(false);
  });
});

describe('determineHomeAway — wenn es nicht eindeutig ist', () => {
  it('nimmt ein Heimspiel an, wenn keine Seite zu uns passt', () => {
    const info = determineHomeAway('TV Eins vs TV Zwei', 'Erwachsene I', ALIASES);
    expect(info).toEqual({ isHome: true, opponent: 'TV Zwei' });
  });

  it('nimmt ein Heimspiel an, wenn beide Seiten zu uns passen', () => {
    // Zwei eigene Mannschaften gegeneinander — kommt in unteren Klassen vor.
    const info = determineHomeAway('TTC Musterstadt II vs TTC Musterstadt III', 'Erwachsene II', ALIASES);
    expect(info).toEqual({ isHome: true, opponent: 'TTC Musterstadt III' });
  });

  it('nimmt ein Heimspiel an, wenn weder Aliase noch Mannschaftsname vorliegen', () => {
    const info = determineHomeAway('TV Eins vs TV Zwei', '', []);
    expect(info).toEqual({ isHome: true, opponent: 'TV Zwei' });
  });
});
