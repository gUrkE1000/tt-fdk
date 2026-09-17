import { describe, it, expect } from 'vitest';
import { NAV, visibleNav, primaryNav, labelForPath, type Role } from '../../src/app/nav';

const ALL_ROLES: Role[] = ['admin', 'team_leader', 'trainer', 'organizer', 'member', 'guest'];

describe('visibleNav', () => {
  it('zeigt ohne Rolle nichts an', () => {
    expect(visibleNav(null)).toEqual([]);
    expect(visibleNav(undefined)).toEqual([]);
  });

  it('zeigt dem Admin alle Abschnitte einschließlich Verwalten', () => {
    const sections = visibleNav('admin').map((s) => s.section);
    expect(sections).toContain('Verwalten');
    expect(sections).toContain('Planen');
    expect(sections).toContain('Verein');
  });

  it('blendet Verwalten für alle anderen Rollen aus', () => {
    for (const role of ALL_ROLES.filter((r) => r !== 'admin')) {
      const sections = visibleNav(role).map((s) => s.section);
      expect(sections, `Rolle ${role}`).not.toContain('Verwalten');
    }
  });

  it('gibt dem Mitglied nur die allgemeinen Ziele', () => {
    const paths = visibleNav('member').flatMap((s) => s.items.map((i) => i.to));
    expect(paths).toEqual(
      expect.arrayContaining(['/', '/my-games', '/my-dates', '/my-club', '/calendar', '/votes']),
    );
    expect(paths).not.toContain('/teams');
    expect(paths).not.toContain('/players');
    expect(paths).not.toContain('/trainings');
  });

  it('gibt dem Mannschaftsführer Mannschaften und Spieltermine', () => {
    const paths = visibleNav('team_leader').flatMap((s) => s.items.map((i) => i.to));
    expect(paths).toContain('/teams');
    expect(paths).toContain('/games');
    expect(paths).not.toContain('/trainings');
  });

  it('gibt dem Trainer die Trainings', () => {
    const paths = visibleNav('trainer').flatMap((s) => s.items.map((i) => i.to));
    expect(paths).toContain('/trainings');
    expect(paths).not.toContain('/games');
  });

  it('gibt dem Organisator die Vereinstermine', () => {
    const paths = visibleNav('organizer').flatMap((s) => s.items.map((i) => i.to));
    expect(paths).toContain('/dates');
    expect(paths).not.toContain('/teams');
  });

  it('lässt keinen leeren Abschnitt übrig', () => {
    for (const role of ALL_ROLES) {
      for (const section of visibleNav(role)) {
        expect(section.items.length, `Rolle ${role}, Abschnitt ${section.section}`).toBeGreaterThan(
          0,
        );
      }
    }
  });
});

describe('primaryNav', () => {
  it('liefert höchstens fünf Einträge für die Bottom-Bar', () => {
    for (const role of ALL_ROLES) {
      expect(primaryNav(role).length).toBeLessThanOrEqual(5);
    }
  });

  it('enthält für jede Rolle die Übersicht', () => {
    for (const role of ALL_ROLES) {
      expect(primaryNav(role).map((i) => i.to)).toContain('/');
    }
  });
});

describe('labelForPath', () => {
  it('findet die exakte Route', () => {
    expect(labelForPath('/')).toBe('Übersicht');
    expect(labelForPath('/teams')).toBe('Mannschaften');
  });

  it('findet die längste passende Unterroute', () => {
    expect(labelForPath('/teams/players-management')).toBe('Mannschaften');
  });

  it('fällt auf den Anwendungsnamen zurück', () => {
    expect(labelForPath('/gibt-es-nicht')).toBe('Vereinsplaner');
  });
});

describe('NAV-Struktur', () => {
  it('hat eindeutige Pfade', () => {
    const paths = NAV.flatMap((s) => s.items.map((i) => i.to));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('nennt nur gültige Rollen', () => {
    for (const item of NAV.flatMap((s) => s.items)) {
      for (const role of item.roles) {
        expect(ALL_ROLES).toContain(role);
      }
    }
  });
});
