import { describe, it, expect } from 'vitest';
import {
  buildLineupText,
  buildMissingPlayersText,
  buildShareText,
  type LineupTextInput,
} from '../../src/lib/lineupText';

// 12.10.2026, 18:00 Uhr Ortszeit (Sommerzeit: 16:00 UTC)
const BASE: LineupTextInput = {
  teamName: 'Erwachsene II',
  opponent: 'TV Beispiel III',
  league: 'Bezirksklasse',
  isHome: true,
  startsAt: '2026-10-12T16:00:00.000Z',
  venue: 'Sporthalle Musterstadt, Turnstraße 5, 12345 Musterstadt',
  requiredPlayers: 4,
  confirmedNames: ['Anna Beispiel', 'Bernd Muster', 'Clara Probe', 'Dieter Test'],
  arrivalMinutes: 60,
};

describe('buildLineupText', () => {
  it('nennt Gegner, Termin, Spielort und die Aufstellung mit Vornamen', () => {
    const text = buildLineupText(BASE);

    expect(text).toContain('TV Beispiel III');
    expect(text).toContain('Bezirksklasse');
    expect(text).toContain('um 18:00 Uhr');
    expect(text).toContain('Sporthalle Musterstadt');
    expect(text).toContain('Aufstellung: Anna, Bernd, Clara, Dieter');
  });

  it('nennt die Ankunftszeit für ein Heimspiel', () => {
    const text = buildLineupText(BASE);
    expect(text).toContain('um 17:00 Uhr in der Halle');
  });

  it('nennt für ein Auswärtsspiel den Spielort statt der Halle', () => {
    const text = buildLineupText({ ...BASE, isHome: false, arrivalMinutes: 30 });
    expect(text).toContain('Auswärtsspiel');
    expect(text).toContain('um 17:30 Uhr am Spielort');
  });

  it('führt überzählige Zusagen als Ersatz', () => {
    const text = buildLineupText({
      ...BASE,
      confirmedNames: [...BASE.confirmedNames, 'Erik Extra'],
    });

    expect(text).toContain('Aufstellung: Anna, Bernd, Clara, Dieter');
    expect(text).toContain('Ersatz: Erik');
  });

  it('nennt Fahrer, wenn sich welche gemeldet haben', () => {
    const text = buildLineupText({ ...BASE, driverNames: ['Anna Beispiel'] });
    expect(text).toContain('Fahrer: Anna');
  });

  it('hängt den Hinweis auf ein zeitgleiches Spiel an', () => {
    const text = buildLineupText({ ...BASE, concurrentTeamName: 'Erwachsene I' });
    expect(text).toContain('Erwachsene I spielt zeitgleich am selben Ort.');
  });

  it('hängt den Standardhinweis der Mannschaft an', () => {
    const text = buildLineupText({ ...BASE, note: 'Bitte Trikots mitbringen.' });
    expect(text).toContain('Bitte Trikots mitbringen.');
  });

  it('kommt mit einer 6er-Mannschaft zurecht', () => {
    const text = buildLineupText({
      ...BASE,
      requiredPlayers: 6,
      confirmedNames: ['A Eins', 'B Zwei', 'C Drei', 'D Vier', 'E Fuenf', 'F Sechs'],
    });

    expect(text).toContain('Aufstellung: A, B, C, D, E, F');
    expect(text).not.toContain('Ersatz:');
  });
});

describe('buildMissingPlayersText', () => {
  it('nennt die Zahl der fehlenden Spieler im Singular', () => {
    const text = buildMissingPlayersText({
      ...BASE,
      confirmedNames: ['Anna Beispiel', 'Bernd Muster', 'Clara Probe'],
    });

    expect(text).toContain('fehlt uns noch 1 Spieler');
    expect(text).toContain('Bisher zugesagt: Anna, Bernd, Clara');
  });

  it('nennt die Zahl der fehlenden Spieler im Plural', () => {
    const text = buildMissingPlayersText({ ...BASE, confirmedNames: ['Anna Beispiel'] });
    expect(text).toContain('fehlen uns noch 3 Spieler');
  });

  it('sagt „niemand", wenn noch keine Zusage da ist', () => {
    const text = buildMissingPlayersText({ ...BASE, confirmedNames: [] });
    expect(text).toContain('Bisher zugesagt: niemand');
  });

  it('nennt eine Frist eine Woche vor dem Spiel', () => {
    const text = buildMissingPlayersText({ ...BASE, confirmedNames: [] });
    expect(text).toContain('Bitte bis Mo 05.10. zurückmelden.');
  });
});

describe('buildShareText', () => {
  it('wählt die Aufstellung, wenn genug zugesagt haben', () => {
    expect(buildShareText(BASE)).toContain('Aufstellung:');
  });

  it('wählt den Aufruf, wenn Zusagen fehlen', () => {
    expect(buildShareText({ ...BASE, confirmedNames: [] })).toContain('fehlen uns noch 4 Spieler');
  });
});
