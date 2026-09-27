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

describe('parseNuscoreList', () => {
  it('liest Datum, Uhrzeit und Code', () => {
    const entries = parseNuscoreList(CODES, 'code');
    expect(entries.map(({ date, time, value }) => ({ date, time, value }))).toEqual([
      { date: '2026-10-10', time: '18:30', value: '7EXU-XFZU-F8S4' },
      { date: '2026-10-23', time: '20:00', value: 'A2BC-D3EF-G4HJ' },
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
      '7EXU-XFZU-F8S4',
    );
    expect(parseNuscoreList(['12.10.2026 7EXUXFZUF8S4'], 'code')[0].value).toBe('7EXU-XFZU-F8S4');
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
      { matchId: 'm-1', code: '7EXU-XFZU-F8S4', pin: '4711' },
      { matchId: 'm-2', code: null, pin: '0815' },
      { matchId: 'm-3', code: 'A2BC-D3EF-G4HJ', pin: null },
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
