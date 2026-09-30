import { describe, expect, it } from 'vitest';
import {
  parseNuscoreList,
  planNuscoreImport,
  splitRecords,
  type NuscoreMatch,
} from '../../src/features/matches/nuscore';
import { groupTextLines } from '../../src/lib/pdfText';

const CODES = [
  'Spiel-Codes für nuScore',
  'TSV Feldkirchen II — Bezirksliga Herren, Vorrunde 2026/27',
  'Datum Zeit Nr. Heimmannschaft Gastmannschaft Spiel-Code',
  'Sa. 10.10.2026 18:30 12 TSV Feldkirchen II TTC Kirchheim 7EXU-XFZU-F8S4',
  // Der Gegner bricht in der Liste auf eine zweite Zeile um, der Code steht dort.
  'Fr. 23.10.2026 20:00 27 TSV Feldkirchen II SV Heimstetten',
  'II A2BC-D3EF-G4HJ',
  'Seite 1 von 1',
];

const PINS = [
  'Spiel-PINs für nuScore',
  'Datum Zeit Nr. Heimmannschaft Gastmannschaft PIN',
  'Sa. 10.10.2026 18:30 12 TSV Feldkirchen II TTC Kirchheim 4711',
  'So. 18.10.26 10:00 19 SC Baldham TSV Feldkirchen II 0815',
];

function match(overrides: Partial<NuscoreMatch> & { id: string; dtstart: string }): NuscoreMatch {
  return { opponent: null, nuscore_code: null, nuscore_pin: null, ...overrides };
}

// 18:30 und 20:00 Uhr Sommerzeit, 10:00 Uhr Sommerzeit (Umstellung am 25.10.2026).
const MATCHES: NuscoreMatch[] = [
  match({ id: 'm-1', dtstart: '2026-10-10T16:30:00Z', opponent: 'TTC Kirchheim' }),
  match({ id: 'm-2', dtstart: '2026-10-18T08:00:00Z', opponent: 'SC Baldham' }),
  match({ id: 'm-3', dtstart: '2026-10-23T18:00:00Z', opponent: 'SV Heimstetten II' }),
];

describe('splitRecords', () => {
  it('beginnt mit jeder Datumszeile einen Eintrag und hängt Folgezeilen an', () => {
    expect(splitRecords(CODES)).toEqual([
      ['Sa. 10.10.2026 18:30 12 TSV Feldkirchen II TTC Kirchheim 7EXU-XFZU-F8S4'],
      [
        'Fr. 23.10.2026 20:00 27 TSV Feldkirchen II SV Heimstetten',
        'II A2BC-D3EF-G4HJ',
        'Seite 1 von 1',
      ],
    ]);
  });
});

// Aufbau der echten click-TT-Liste „Spiel-Erfassungs-Codes" (nu.Dokument 018), wie
// pdfjs sie liest — mit erfundenen Codes: Echte Codes öffnen den Spielbericht.
const CLICK_TT_CODES = [
  'TSV Feldkirchen',
  'Erwachsene II',
  'Spiel-Erfassungs-Codes',
  'Verwendung der Spielcodes',
  'Die Spielcodes sind erforderlich, um die Spielberichte in nuScore zu laden und zu erfassen.',
  'Codetabelle',
  'Datum, Uhrzeit (Lokal) Heimmannschaft Gastmannschaft Spiel-Code',
  'Mo. 26.10.2026 20:00 (1) TSV Feldkirchen II TSV Ebersberg AB12CD34EF56',
  'Mo. 23.11.2026 20:00 (1) TSV Feldkirchen II TSV Zorneding 1920 II QWERTZUIOPAS',
  'Mo. 18.01.2027 20:00 (1) TSV Feldkirchen II TV 1895 Markt Schwaben 9Z8Y7X6W5V4U',
  'nu .Dokument 018, erstellt am 26.09.2026 19:16 | Seite 1 von 1',
];

describe('parseNuscoreList mit der click-TT-Liste', () => {
  it('liest jede Spielzeile, übergeht Kopf und Fußzeile', () => {
    expect(
      parseNuscoreList(CLICK_TT_CODES, 'code').map(({ date, time, value }) => [date, time, value]),
    ).toEqual([
      ['2026-10-26', '20:00', 'AB12CD34EF56'],
      // Nur Buchstaben — steht am Zeilenende, also der Code.
      ['2026-11-23', '20:00', 'QWERTZUIOPAS'],
      ['2027-01-18', '20:00', '9Z8Y7X6W5V4U'],
    ]);
  });

  it('ordnet über das Datum den Heimspielen zu', () => {
    const plan = planNuscoreImport(parseNuscoreList(CLICK_TT_CODES, 'code'), [
      match({ id: 'eb', dtstart: '2026-10-26T19:00:00Z', opponent: 'TSV Ebersberg' }),
      match({ id: 'zo', dtstart: '2026-11-23T19:00:00Z', opponent: 'TSV Zorneding 1920 II' }),
      match({ id: 'ms', dtstart: '2027-01-18T19:00:00Z', opponent: 'TV 1895 Markt Schwaben' }),
    ]);
    expect(plan.unassigned).toEqual([]);
    expect(plan.assignments.map((item) => [item.matchId, item.code])).toEqual([
      ['eb', 'AB12CD34EF56'],
      ['zo', 'QWERTZUIOPAS'],
      ['ms', '9Z8Y7X6W5V4U'],
    ]);
  });

  it('nimmt aus einer PIN-Liste desselben Aufbaus den Wert am Zeilenende', () => {
    const entries = parseNuscoreList(
      [
        'Datum, Uhrzeit (Lokal) Heimmannschaft Gastmannschaft Spiel-PIN',
        'Mo. 23.11.2026 20:00 (1) TSV Feldkirchen II TSV Zorneding 1920 II 4821',
        'Do. 03.12.2026 19:45 (1) TSV Zorneding 1920 II TSV Feldkirchen II 7310',
      ],
      'pin',
    );
    expect(entries.map((entry) => entry.value)).toEqual(['4821', '7310']);
  });
});

describe('parseNuscoreList', () => {
  it('liest Datum, Uhrzeit und Code und lässt die Bindestriche weg', () => {
    const entries = parseNuscoreList(CODES, 'code');
    expect(entries.map(({ date, time, value }) => ({ date, time, value }))).toEqual([
      { date: '2026-10-10', time: '18:30', value: '7EXUXFZUF8S4' },
      { date: '2026-10-23', time: '20:00', value: 'A2BCD3EFG4HJ' },
    ]);
  });

  it('liest PINs, auch mit zweistelliger Jahreszahl', () => {
    const entries = parseNuscoreList(PINS, 'pin');
    expect(entries.map(({ date, value }) => ({ date, value }))).toEqual([
      { date: '2026-10-10', value: '4711' },
      { date: '2026-10-18', value: '0815' },
    ]);
  });

  it('nimmt einen beschrifteten PIN vor allem anderen', () => {
    const [entry] = parseNuscoreList(['12.10.2026 Nr. 4455 TSV 1860 PIN: 9A7B'], 'pin');
    expect(entry.value).toBe('9A7B');
  });

  it('nimmt den Wert aus der Datumszeile, nicht aus dem Umbruch der nächsten', () => {
    // So kommt ein umbrochener Name aus der PDF: halb über, halb unter der Datumszeile.
    const entries = parseNuscoreList(
      [
        'Sa. 10.10.2026 18:30 12 TSV Feldkirchen II TTC Kirchheim 4711',
        'TSV 1860',
        'So. 18.10.2026 10:00 19 TSV Feldkirchen II 0815',
        'München III',
      ],
      'pin',
    );
    expect(entries.map((entry) => entry.value)).toEqual(['4711', '0815']);
  });

  it('hält den Code nicht für einen PIN', () => {
    const [entry] = parseNuscoreList(['12.10.2026 18:00 7EXU-XFZU-F8S4 5566'], 'pin');
    expect(entry.value).toBe('5566');
  });

  it('erkennt Codes mit Leerzeichen oder ohne Trennung', () => {
    expect(parseNuscoreList(['12.10.2026 7exu xfzu f8s4'], 'code')[0].value).toBe(
      '7EXUXFZUF8S4',
    );
    expect(parseNuscoreList(['12.10.2026 7EXUXFZUF8S4'], 'code')[0].value).toBe('7EXUXFZUF8S4');
  });

  it('hält drei kurze Wörter nicht für einen Code', () => {
    expect(parseNuscoreList(['12.10.2026 TTC Grün Weiß Nord Süd West'], 'code')).toEqual([]);
    expect(parseNuscoreList(['12.10.2026 SV Rot Bad Wald Hof Berg'], 'code')).toEqual([]);
  });

  it('übergeht Zeilen ohne Wert und ungültige Daten', () => {
    expect(parseNuscoreList(['31.13.2026 7EXU-XFZU-F8S4', '12.10.2026 spielfrei'], 'code')).toEqual(
      [],
    );
  });
});

describe('planNuscoreImport', () => {
  it('ordnet Codes und PINs über das Datum zu und fasst sie je Spiel zusammen', () => {
    const plan = planNuscoreImport(
      [...parseNuscoreList(CODES, 'code'), ...parseNuscoreList(PINS, 'pin')],
      MATCHES,
    );

    expect(plan.unassigned).toEqual([]);
    expect(plan.assignments).toEqual([
      { matchId: 'm-1', code: '7EXUXFZUF8S4', pin: '4711' },
      { matchId: 'm-2', code: null, pin: '0815' },
      { matchId: 'm-3', code: 'A2BCD3EFG4HJ', pin: null },
    ]);
  });

  it('findet ein verlegtes Spiel über den ursprünglichen Termin', () => {
    const moved = [
      match({
        id: 'm-1',
        dtstart: '2026-11-07T17:00:00Z',
        dtstart_external: '2026-10-10T16:30:00Z',
      }),
    ];
    const plan = planNuscoreImport(parseNuscoreList(PINS, 'pin'), moved);
    expect(plan.assignments).toEqual([{ matchId: 'm-1', code: null, pin: '4711' }]);
  });

  it('unterscheidet zwei Spiele am selben Tag über die Uhrzeit', () => {
    const doubleHeader = [
      match({ id: 'früh', dtstart: '2026-10-10T08:00:00Z' }),
      match({ id: 'spät', dtstart: '2026-10-10T16:30:00Z' }),
    ];
    const plan = planNuscoreImport(parseNuscoreList(PINS.slice(0, 3), 'pin'), doubleHeader);
    expect(plan.assignments).toEqual([{ matchId: 'spät', code: null, pin: '4711' }]);
  });

  it('unterscheidet ohne Uhrzeit über den Gegner', () => {
    const sameTime = [
      match({ id: 'a', dtstart: '2026-10-10T16:30:00Z', opponent: 'SV Heimstetten' }),
      match({ id: 'b', dtstart: '2026-10-10T16:30:00Z', opponent: 'TTC Kirchheim' }),
    ];
    const plan = planNuscoreImport(parseNuscoreList(PINS.slice(0, 3), 'pin'), sameTime);
    expect(plan.assignments).toEqual([{ matchId: 'b', code: null, pin: '4711' }]);
  });

  it('rät nicht, wenn zwei Spiele gleich gut passen', () => {
    const twins = [
      match({ id: 'a', dtstart: '2026-10-10T16:30:00Z' }),
      match({ id: 'b', dtstart: '2026-10-10T16:30:00Z' }),
    ];
    const plan = planNuscoreImport(parseNuscoreList(PINS.slice(0, 3), 'pin'), twins);
    expect(plan.assignments).toEqual([]);
    expect(plan.unassigned.map((item) => item.reason)).toEqual(['ambiguous']);
  });

  it('meldet Einträge ohne passendes Spiel', () => {
    const plan = planNuscoreImport(parseNuscoreList(PINS, 'pin'), MATCHES.slice(0, 1));
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0]).toMatchObject({ reason: 'no_match', entry: { value: '0815' } });
  });

  it('lässt Werte weg, die schon am Spiel stehen', () => {
    const known = [{ ...MATCHES[0], nuscore_pin: '4711' }];
    const plan = planNuscoreImport(parseNuscoreList(PINS.slice(0, 3), 'pin'), known);
    expect(plan.assignments).toEqual([]);
    expect(plan.unassigned).toEqual([]);
  });
});

describe('groupTextLines', () => {
  it('setzt Textstücke derselben Höhe von links nach rechts zu Zeilen zusammen', () => {
    expect(
      groupTextLines([
        { str: 'TTC Kirchheim', x: 300, y: 700.4 },
        { str: '10.10.2026', x: 40, y: 700 },
        { str: '4711', x: 500, y: 699 },
        { str: 'Datum', x: 40, y: 720 },
        { str: ' ', x: 60, y: 720 },
        { str: '18.10.2026', x: 40, y: 680 },
      ]),
    ).toEqual(['Datum', '10.10.2026 TTC Kirchheim 4711', '18.10.2026']);
  });
});

// Randfälle aus der Prüfung der Import-Logik (30.09.2026). Ein PIN hat dieselbe Form
// wie eine Jahreszahl im Vereinsnamen oder eine Spielnummer — entscheidend ist, wo er
// steht.
describe('parseNuscoreList: PINs', () => {
  const values = (lines: string[]) => parseNuscoreList(lines, 'pin').map((entry) => entry.value);

  it('nimmt ohne PIN keine Zahl aus dem Vereinsnamen', () => {
    expect(values(['Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TSV 1860 München'])).toEqual([]);
  });

  it('nimmt ohne PIN keine Spielnummer', () => {
    expect(values(['Sa. 10.10.2026 18:30 1045 TSV Feldkirchen II TTC Kirchheim'])).toEqual([]);
  });

  it('findet den PIN hinter einem Gegner mit Jahreszahl', () => {
    expect(values(['Sa. 10.10.2026 18:30 (1) TSV 1860 München TSV Feldkirchen II 4711'])).toEqual([
      '4711',
    ]);
  });

  it('nimmt den PIN aus der Folgezeile, wenn der Name nach der Jahreszahl umbricht', () => {
    expect(
      values(['Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TSV Zorneding 1920', 'II 4711']),
    ).toEqual(['4711']);
  });

  it('hält den Code nicht für den PIN, egal in welcher Reihenfolge', () => {
    expect(
      values([
        'Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TTC Kirchheim AB12CD34EF56 4711',
        'So. 18.10.2026 10:00 (1) SC Baldham TSV Feldkirchen II 0815 ZX98YW76VU54',
      ]),
    ).toEqual(['4711', '0815']);
  });

  it('liest PINs aus Buchstaben und Ziffern', () => {
    expect(values(['Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TTC Kirchheim A7K9Q2'])).toEqual([
      'A7K9Q2',
    ]);
  });

  it('übergeht Fußzeile und Stand-Datum, auch über einen Seitenwechsel', () => {
    expect(
      values([
        'Stand: 26.09.2026',
        'Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TTC Kirchheim 4711',
        'nu .Dokument 019, erstellt am 26.09.2026 19:16 | Seite 1 von 2',
        'Datum, Uhrzeit (Lokal) Heimmannschaft Gastmannschaft Spiel-PIN',
        'So. 18.10.2026 10:00 (1) SC Baldham TSV Feldkirchen II 0815',
      ]),
    ).toEqual(['4711', '0815']);
  });
});

describe('parseNuscoreList: Codes', () => {
  const values = (lines: string[]) => parseNuscoreList(lines, 'code').map((entry) => entry.value);

  it('nimmt ohne Code nichts aus dem Vereinsnamen', () => {
    expect(values(['Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TSV 1860 München'])).toEqual([]);
  });

  it('setzt einen in der PDF zerrissenen Code wieder zusammen', () => {
    expect(values(['Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TTC Kirchheim AB12CD34 EF56'])).toEqual([
      'AB12CD34EF56',
    ]);
  });

  it('findet den Code in der Folgezeile und neben einer PIN-Spalte', () => {
    expect(
      values([
        'Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TTC Kirchheim',
        'AB12CD34EF56',
        'So. 18.10.2026 10:00 (1) TSV Feldkirchen II SC Baldham ZX98YW76VU54 4711',
      ]),
    ).toEqual(['AB12CD34EF56', 'ZX98YW76VU54']);
  });

  it('liest die Uhrzeit auch mit Punkt', () => {
    expect(
      parseNuscoreList(['Sa. 10.10.2026 18.30 (1) TSV Feldkirchen II TTC Kirchheim AB12CD34EF56'], 'code')[0]
        .time,
    ).toBe('18:30');
  });
});

describe('planNuscoreImport: Randfälle', () => {
  it('ordnet ein am selben Tag verschobenes Spiel trotz anderer Uhrzeit zu', () => {
    const plan = planNuscoreImport(
      parseNuscoreList(['Sa. 10.10.2026 18:30 (1) TSV Feldkirchen II TTC Kirchheim 4711'], 'pin'),
      [match({ id: 'a', dtstart: '2026-10-10T17:00:00Z', opponent: 'TTC Kirchheim' })],
    );
    expect(plan.assignments).toEqual([{ matchId: 'a', code: null, pin: '4711' }]);
  });

  it('unterscheidet zweite und dritte Mannschaft desselben Vereins am selben Tag', () => {
    const plan = planNuscoreImport(
      parseNuscoreList(
        [
          'Sa. 10.10.2026 (1) TSV Feldkirchen II TSV Kirchheim II 4711',
          'Sa. 10.10.2026 (1) TSV Kirchheim III TSV Feldkirchen II 0815',
        ],
        'pin',
      ),
      [
        match({ id: 'zwei', dtstart: '2026-10-10T08:00:00Z', opponent: 'TSV Kirchheim II' }),
        match({ id: 'drei', dtstart: '2026-10-10T12:00:00Z', opponent: 'TSV Kirchheim III' }),
      ],
    );
    expect(plan.unassigned).toEqual([]);
    expect(plan.assignments).toEqual([
      { matchId: 'zwei', code: null, pin: '4711' },
      { matchId: 'drei', code: null, pin: '0815' },
    ]);
  });

  it('führt beide Listen einer Mannschaft zu je einem Eintrag pro Spiel zusammen', () => {
    const plan = planNuscoreImport(
      [
        ...parseNuscoreList(
          ['Mo. 26.10.2026 20:00 (1) TSV Feldkirchen II TSV Ebersberg AB12CD34EF56'],
          'code',
        ),
        ...parseNuscoreList(
          [
            'Mo. 26.10.2026 20:00 (1) TSV Feldkirchen II TSV Ebersberg 4821',
            'Do. 03.12.2026 19:45 (1) TSV Zorneding 1920 II TSV Feldkirchen II 7310',
          ],
          'pin',
        ),
      ],
      [
        match({ id: 'heim', dtstart: '2026-10-26T19:00:00Z', opponent: 'TSV Ebersberg' }),
        match({ id: 'ausw', dtstart: '2026-12-03T18:45:00Z', opponent: 'TSV Zorneding 1920 II' }),
      ],
    );
    expect(plan.unassigned).toEqual([]);
    expect(plan.assignments).toEqual([
      { matchId: 'heim', code: 'AB12CD34EF56', pin: '4821' },
      { matchId: 'ausw', code: null, pin: '7310' },
    ]);
  });
});
