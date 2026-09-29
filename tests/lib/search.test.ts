import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  highlightParts,
  matchesSearch,
  normalizeSearch,
  searchTokens,
} from '../../src/lib/search';

describe('normalizeSearch', () => {
  it('schreibt Umlaute aus, entfernt Akzente und Satzzeichen', () => {
    // Derselbe Satz wie in der Migration geprüft — Ergebnis von public.search_norm.
    expect(normalizeSearch('Müller-Lüdenscheidt, Straße 5 · Café Ängström ẞ ÉLAN')).toBe(
      'mueller luedenscheidt strasse 5 cafe aengstroem ss elan',
    );
  });

  it('macht Müller, Mueller und MÜLLER gleich', () => {
    expect(normalizeSearch('Müller')).toBe('mueller');
    expect(normalizeSearch('Mueller')).toBe('mueller');
    expect(normalizeSearch('MÜLLER')).toBe('mueller');
  });

  it('kommt mit leer und null zurecht', () => {
    expect(normalizeSearch('')).toBe('');
    expect(normalizeSearch(null)).toBe('');
    expect(normalizeSearch('  --  ')).toBe('');
  });

  it('nimmt höchstens acht Wörter', () => {
    expect(searchTokens('a b c d e f g h i j')).toHaveLength(8);
  });
});

describe('Gleichlauf mit der Datenbank', () => {
  it('nutzt dieselben Zeichenlisten wie public.search_norm', () => {
    const dir = resolve(__dirname, '../../supabase/migrations');
    const file = readdirSync(dir).find((name) => name.endsWith('_search.sql'))!;
    const sql = readFileSync(resolve(dir, file), 'utf8');
    const source = readFileSync(resolve(__dirname, '../../src/lib/search.ts'), 'utf8');

    const lists = [...sql.matchAll(/^\s+'([^'\s]{50,})',?$/gm)].map((match) => match[1]);
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(source).toContain(`'${list}'`);
    expect([...lists[0]].length).toBe([...lists[1]].length);
  });
});

describe('matchesSearch', () => {
  it('verlangt jedes Wort, egal in welcher Reihenfolge', () => {
    expect(matchesSearch(['1. Herren', 'TTC Nachbarstadt'], 'nachbar herren')).toBe(true);
    expect(matchesSearch(['1. Herren', 'TTC Nachbarstadt'], 'nachbar damen')).toBe(false);
  });

  it('findet auch mitten im Wort, wie die Filter bisher', () => {
    expect(matchesSearch(['TTC Nachbarstadt'], 'stadt')).toBe(true);
  });

  it('lässt bei leerer Eingabe alles durch', () => {
    expect(matchesSearch(['irgendwas'], '  ')).toBe(true);
  });

  it('findet Müller über mueller', () => {
    expect(matchesSearch(['Erika Müller'], 'mueller')).toBe(true);
  });
});

describe('highlightParts', () => {
  it('markiert Wortanfänge im Original', () => {
    // „muel" ist in der Normalform „M-ue-l": markiert werden M, ü und l.
    expect(highlightParts('Erika Müller', 'muel')).toEqual([
      { text: 'Erika ', hit: false },
      { text: 'Mül', hit: true },
      { text: 'ler', hit: false },
    ]);
  });

  it('markiert nichts mitten im Wort', () => {
    expect(highlightParts('Nachbarstadt', 'stadt')).toEqual([{ text: 'Nachbarstadt', hit: false }]);
  });

  it('markiert mehrere Wörter', () => {
    const parts = highlightParts('2. Herren – SV Musterdorf', 'herren muster');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['Herren', 'Muster']);
  });
});
