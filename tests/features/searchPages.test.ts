import { describe, it, expect } from 'vitest';
import { pagesForRole, searchPages } from '../../src/features/search/pages';
import { visibleNav } from '../../src/app/nav';
import { kindsForRole } from '../../src/features/search/types';

const first = (query: string, role: Parameters<typeof searchPages>[1] = 'member') =>
  searchPages(query, role)[0]?.page.label;

describe('Seiten & Aktionen in der Suche', () => {
  it('versteht Alltagswörter', () => {
    expect(first('urlaub')).toBe('Abwesenheit eintragen');
    expect(first('ics')).toBe('Kalender abonnieren');
    expect(first('push')).toBe('Benachrichtigungen einstellen');
    expect(first('konto löschen')).toBe('Datenschutz, Datenexport, Konto löschen');
  });

  it('findet Menüpunkte über ihren Namen und Wortanfänge', () => {
    expect(first('kalen')).toBe('Kalender');
    expect(first('mein verein')).toBe('Verein');
  });

  it('zeigt nur, was auch im Menü der Rolle steht', () => {
    const memberPages = pagesForRole('member').map((p) => p.to);
    expect(memberPages).not.toContain('/players');
    expect(memberPages).not.toContain('/games');
    expect(pagesForRole('admin').map((p) => p.to)).toContain('/players');

    const menu = new Set(visibleNav('member').flatMap((s) => s.items.map((i) => i.to)));
    for (const page of pagesForRole('member').filter((p) => p.id.startsWith('nav:'))) {
      expect(menu.has(page.to)).toBe(true);
    }
  });

  it('bietet Verwaltungsaktionen nur den passenden Rollen an', () => {
    expect(first('nuscore', 'member')).toBeUndefined();
    expect(first('nuscore', 'team_leader')).toBe('Codes & PINs für nuScore');
    expect(first('einladen', 'trainer')).toBeUndefined();
    expect(first('einladen', 'admin')).toBe('Mitglied einladen');
  });

  it('findet ohne Anmeldung nichts', () => {
    expect(searchPages('kalender', null)).toEqual([]);
  });

  it('sucht erst ab zwei Zeichen', () => {
    expect(searchPages('k', 'member')).toEqual([]);
  });

  it('bietet Gästen keine Filter für Spiele und Mannschaften an', () => {
    expect(kindsForRole('guest')).not.toContain('match');
    expect(kindsForRole('guest')).not.toContain('team');
    expect(kindsForRole('member')).toContain('match');
  });
});
