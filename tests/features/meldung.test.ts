import { describe, expect, it } from 'vitest';
import {
  normalizeName,
  parseMeldung,
  planMeldung,
  type KnownMember,
  type KnownTeam,
} from '../../src/features/teams/meldung';

// Aufbau der click-TT-Mannschaftsmeldung (nu.Dokument 011b), wie pdfjs sie liest: zwei
// Spalten in einer Zeile, Spieler der ersten Mannschaft erst am Seitenende, ein
// umbrochenes Geschlecht, Legende und Staffelleiter dazwischen. Alle Namen, Nummern und
// Adressen sind erfunden.
const LINES = [
  'Oberbayern-Mitte | 2026/27',
  'TSV Musterdorf (399999)',
  'Mannschaftsmeldung (Vorrunde)',
  'Kontaktadresse Erwachsene (4er) Adler, Anton; T 01700000001 1.3 1700 Berg, Bernd (1990/m) GER',
  'Clara Clubwart anton.adler@example.org 1.4 1650 Dorn, Daniel (1991/m) GER',
  'Hauptstr. 1, 85000 Musterdorf Landesliga Südsüdwest Staffel, Sven, Weg 2, 80000',
  'T 01700000002 m 01700000003 Musterstadt, Mobil: 0170000004, s@example.org Rg. Q-TTR Name, Vorname Nat. A Status Bem.',
  'Erwachsene II (4er) Ernst, Emil; T 0890000000 m 01700000005; 2.1 1600 Ernst, Emil (1985/m) GER',
  'Spiellokal 1 emil@example.org 2.2 1550 Fuchs, Fritz (1972/m) GER',
  'Mehrzweckhalle Bezirksklasse A Gruppe 3 München-Ost Leiter, Lars, 2.3 1540 Groß, Günter (1965/m) GER RES',
  'Legende 2.4 1500 Hahn, Heike (1980/w) GER',
  'SBE ... Spielberechtigung für den Erwachsenensport Erwachsene III (4er) Igel, Ines m 01700000006;',
  'JES ... Jugend-Ergänzungsspieler Bezirksklasse C Gruppe 8 Ebersberg/München Wart, Walter, 3.1 1400 Igel, Ines (1978/w) GER',
  'gA ... gleichgestellter Ausländer 3.2 1390 Jung, Jonas (2008/m) POL eA',
  'Rg. Q-TTR Name, Vorname Nat. A Status Bem. 3.5 1200 Kühn, Karl (2012/m) GER SBEM',
  '1.1 1780 Adler, Anton (1983/m) GER 3.3 1380 Lang, Lea (1990/w) GER',
  '1.2 1760 von der Mühle, Maximilian (1967/ GER 3.4 1300 Mayer, Moritz (1970/m) GER',
  'm)',
  'nu .Dokument 011b, erstellt am 27.06.2026 09:05 | Seite 1 von 2',
  'Genehmigungsvermerke',
];

describe('parseMeldung', () => {
  const meldung = parseMeldung(LINES);

  it('liest Saison, Mannschaften, Größe, Liga und Mannschaftsführung', () => {
    expect(meldung.season).toBe('2026/27');
    expect(
      meldung.teams.map((team) => ({
        number: team.number,
        name: team.name,
        type: team.rankingType,
        size: team.size,
        league: team.league,
        leader: team.leader && `${team.leader.lastName}, ${team.leader.firstName}`,
      })),
    ).toEqual([
      {
        number: 1,
        // „Erwachsene" neben „Erwachsene II" wird zu „Erwachsene I".
        name: 'Erwachsene I',
        type: 'men',
        size: 4,
        league: 'Landesliga Südsüdwest',
        leader: 'Adler, Anton',
      },
      {
        number: 2,
        name: 'Erwachsene II',
        type: 'men',
        size: 4,
        league: 'Bezirksklasse A Gruppe 3 München-Ost',
        leader: 'Ernst, Emil',
      },
      {
        number: 3,
        name: 'Erwachsene III',
        type: 'men',
        size: 4,
        league: 'Bezirksklasse C Gruppe 8 Ebersberg/München',
        leader: 'Igel, Ines',
      },
    ]);
  });

  it('liest alle Spieler in Meldereihenfolge, auch wenn sie weit von ihrem Kopf stehen', () => {
    expect(
      meldung.players.map((player) => `${player.team}.${player.position} ${player.lastName}`),
    ).toEqual([
      '1.1 Adler',
      '1.2 von der Mühle',
      '1.3 Berg',
      '1.4 Dorn',
      '2.1 Ernst',
      '2.2 Fuchs',
      '2.3 Groß',
      '2.4 Hahn',
      '3.1 Igel',
      '3.2 Jung',
      '3.3 Lang',
      '3.4 Mayer',
      '3.5 Kühn',
    ]);
  });

  it('übernimmt QTTR, Vorname, Jahrgang und Status', () => {
    expect(meldung.players.find((player) => player.lastName === 'von der Mühle')).toMatchObject({
      firstName: 'Maximilian',
      qttr: 1760,
      birthYear: 1967,
    });
    expect(meldung.players.find((player) => player.lastName === 'Groß')?.status).toBe('RES');
    expect(meldung.players.find((player) => player.lastName === 'Kühn')?.status).toBe('SBEM');
    expect(meldung.players.find((player) => player.lastName === 'Jung')?.status).toBeNull();
  });

  it('erkennt Altersklassen am Kopf', () => {
    const youth = parseMeldung([
      'Jugend 15 (4er) Trainer, Tom;',
      'Mädchen 13 II (3er) Trainer, Tina;',
      'Damen (4er) Kapitän, Kim;',
      'Senioren 60 (4er) Alt, Alfred;',
    ]);
    expect(youth.teams.map((team) => [team.name, team.rankingType, team.number, team.size])).toEqual([
      ['Jugend 15', 'youth_15', 1, 4],
      ['Mädchen 13 II', 'girls_13', 2, 3],
      ['Damen', 'women', 1, 4],
      ['Senioren 60', 'seniors_60', 1, 4],
    ]);
  });

  it('findet in einem fremden Dokument keine Mannschaft', () => {
    expect(parseMeldung(['Spiel-Erfassungs-Codes', 'Codetabelle']).teams).toEqual([]);
  });
});

function member(id: string, first: string, last: string, qttr: number | null = null): KnownMember {
  return { id, first_name: first, last_name: last, qttr };
}

const MEMBERS: KnownMember[] = [
  member('adler', 'Anton', 'Adler', 1780),
  member('muehle', 'Maximilian', 'von der Mühle', 1700),
  member('berg', 'Bernd', 'Berg'),
  member('dorn', 'Daniel', 'Dorn'),
  member('ernst', 'Emil', 'Ernst'),
  member('fuchs', 'Fritz', 'Fuchs'),
  member('gross', 'Günter', 'Gross'),
  member('hahn', 'Heike', 'Hahn'),
  // Zweimal derselbe Name: nicht raten.
  member('igel-1', 'Ines', 'Igel'),
  member('igel-2', 'Ines', 'Igel'),
  member('jung', 'Jonas', 'Jung'),
  member('lang', 'Lea', 'Lang'),
  member('mayer', 'Moritz', 'Mayer'),
  member('kuehn', 'Karl', 'Kühn'),
];

const EXISTING: KnownTeam = {
  id: 'team-2',
  name: 'Herren II',
  ranking_type: 'men',
  ranking: 2,
  size: 6,
  leagues: ['Kreisliga'],
  leaderIds: ['bisher'],
};

describe('planMeldung', () => {
  const plan = planMeldung(parseMeldung(LINES), MEMBERS, [EXISTING], [
    { profile_id: 'adler', ranking_type: 'men', team_number: 1, position_number: 2 },
    { profile_id: 'ausgeschieden', ranking_type: 'men', team_number: 4, position_number: 1 },
    { profile_id: 'jugend', ranking_type: 'youth_19', team_number: 1, position_number: 1 },
  ]);

  it('erkennt vorhandene Mannschaften an Rangtyp und Nummer, legt die übrigen neu an', () => {
    expect(plan.teams.map((team) => [team.meldung.name, team.existing?.id ?? null])).toEqual([
      ['Erwachsene I', null],
      ['Erwachsene II', 'team-2'],
      ['Erwachsene III', null],
    ]);
  });

  it('ordnet Mitglieder über den Namen zu, auch mit ß, Umlaut und Namenszusatz', () => {
    const second = plan.teams[1].players;
    expect(second.map((player) => player.profileId)).toEqual(['ernst', 'fuchs', 'gross', 'hahn']);
    expect(plan.teams[0].players[1].profileId).toBe('muehle');
  });

  it('macht die ersten n Spieler zu Stammspielern, den Rest zu Ersatz', () => {
    expect(plan.teams[2].players.map((player) => [player.lastName, player.kind])).toEqual([
      // Igel ist nicht eindeutig und zählt nicht mit.
      ['Igel', 'substitute'],
      ['Jung', 'regular'],
      ['Lang', 'regular'],
      ['Mayer', 'regular'],
      ['Kühn', 'regular'],
    ]);
  });

  it('meldet, wer sich nicht zuordnen lässt, und warum', () => {
    expect(plan.teams[2].players[0]).toMatchObject({ profileId: null, problem: 'ambiguous' });
    const unknown = planMeldung(parseMeldung(LINES), [], [], []);
    expect(unknown.teams[0].players[0]).toMatchObject({ profileId: null, problem: 'not_found' });
  });

  it('übernimmt die Mannschaftsführung nur, wenn sie eindeutig ein Mitglied ist', () => {
    expect(plan.teams.map((team) => team.leaderId)).toEqual(['adler', 'ernst', null]);
  });

  it('sieht geänderte QTTR-Werte vor', () => {
    expect(plan.teams[0].players[0].qttrChange).toBeNull();
    expect(plan.teams[0].players[1].qttrChange).toEqual({ from: 1700, to: 1760 });
    expect(plan.teams[0].players[2].qttrChange).toEqual({ from: null, to: 1700 });
  });

  it('nennt alte Ränge derselben Altersklasse, andere bleiben unberührt', () => {
    expect(plan.staleRankings.map((ranking) => ranking.profile_id)).toEqual(['ausgeschieden']);
  });
});

describe('normalizeName', () => {
  it('gleicht Schreibweisen an', () => {
    expect(normalizeName('Groß')).toBe(normalizeName('Gross'));
    expect(normalizeName('Müller-Lüdenscheidt')).toBe('muller ludenscheidt');
  });
});
