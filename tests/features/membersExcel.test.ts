import { describe, it, expect } from 'vitest';
import {
  bool,
  genderLabel,
  HEADERS,
  memberToRow,
  number,
  parseDate,
  parseGender,
  parseList,
  parseMemberRows,
  parseRanking,
  parseRole,
  planImport,
  text,
  type ExistingMember,
  type ParsedMember,
  type SheetRow,
} from '../../src/features/members/excel';
import { exportFilename, toCell } from '../../src/features/members/workbook';
import { summarizeImport } from '../../src/features/members/importApi';

// ---------------------------------------------------------------- Zellen

describe('text', () => {
  it('macht aus allem eine getrimmte Zeichenkette', () => {
    expect(text('  Erika ')).toBe('Erika');
    expect(text(42)).toBe('42');
    expect(text(null)).toBe('');
    expect(text(undefined)).toBe('');
  });

  it('schreibt ein Datum deutsch', () => {
    expect(text(new Date(1988, 4, 6))).toBe('06.05.1988');
  });
});

describe('bool', () => {
  it('versteht die Schreibweisen, die Leute wirklich eintippen', () => {
    for (const value of ['ja', 'JA', 'x', 'X', 'wahr', 'true', '1']) {
      expect(bool(value)).toBe(true);
    }
  });

  it('nimmt alles andere als nein — auch eine leere Zelle', () => {
    for (const value of ['nein', '', 'vielleicht', null, 0]) {
      expect(bool(value)).toBe(false);
    }
  });
});

describe('number', () => {
  it('versteht das deutsche Komma', () => {
    expect(number('1450')).toBe(1450);
    expect(number('1450,5')).toBe(1450.5);
  });

  it('meldet Unsinn als null, statt NaN weiterzureichen', () => {
    expect(number('etwa 1500')).toBeNull();
    expect(number('')).toBeNull();
  });
});

describe('parseDate', () => {
  it('versteht die deutsche Schreibweise', () => {
    expect(parseDate('06.05.1988')).toBe('1988-05-06');
    expect(parseDate('6.5.1988')).toBe('1988-05-06');
  });

  it('versteht ein echtes Excel-Datum', () => {
    expect(parseDate(new Date(1988, 4, 6))).toBe('1988-05-06');
  });

  it('versteht ISO, falls die Datei durch ein anderes Programm lief', () => {
    expect(parseDate('1988-05-06')).toBe('1988-05-06');
  });

  it('lehnt ab, was kein Datum ist', () => {
    expect(parseDate('Mai 1988')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('Auswahlfelder', () => {
  it('übersetzt deutsche Rollen', () => {
    expect(parseRole('Mannschaftsführer')).toBe('team_leader');
    expect(parseRole('  admin ')).toBe('admin');
    expect(parseRole('Vorstand')).toBeNull();
  });

  it('übersetzt das Geschlecht', () => {
    expect(parseGender('weiblich')).toBe('female');
    expect(parseGender('MÄNNLICH')).toBe('male');
    expect(genderLabel('female')).toBe('weiblich');
  });

  it('lässt „keine Angabe" aus der Datei heraus', () => {
    // Eine leere Zelle sagt dasselbe und lädt niemanden zum Abtippen ein.
    expect(genderLabel('unspecified')).toBe('');
    expect(genderLabel(null)).toBe('');
  });
});

describe('parseRanking', () => {
  it('zerlegt „1.2" in Mannschaft und Position', () => {
    expect(parseRanking('1.2')).toEqual({ team: 1, position: 2 });
    expect(parseRanking(' 12 , 3 ')).toEqual({ team: 12, position: 3 });
  });

  it('lehnt ab, was kein Rang ist', () => {
    expect(parseRanking('1')).toBeNull();
    expect(parseRanking('1.2.3')).toBeNull();
    expect(parseRanking('0.1')).toBeNull();
  });
});

describe('parseList', () => {
  it('versteht Kommalisten mit und ohne Anführungszeichen', () => {
    expect(parseList('Hobby, Jugend')).toEqual(['Hobby', 'Jugend']);
    expect(parseList('"Training 1","Training 2"')).toEqual(['Training 1', 'Training 2']);
    expect(parseList('  ,  ')).toEqual([]);
  });
});

// ---------------------------------------------------------------- Zeilen

function row(overrides: SheetRow = {}): SheetRow {
  const base: SheetRow = {};
  for (const header of HEADERS) base[header] = '';
  return {
    ...base,
    Vorname: 'Erika',
    Nachname: 'Mustermann',
    'E-Mail': 'erika@example.org',
    Rolle: 'Mitglied',
    ...overrides,
  };
}

describe('parseMemberRows', () => {
  it('liest eine vollständige Zeile', () => {
    const result = parseMemberRows([
      row({
        Geschlecht: 'weiblich',
        Geburtstag: '06.05.1988',
        Handynummer: '0170 1234567',
        Mitgliedsnummer: '42',
        QTTR: '1450',
        Rang: '1.2',
        'Kein Mannschaftsspieler': 'ja',
        Gruppen: 'Hobby, Jugend',
        Trainings: '"Erwachsenentraining"',
      }),
    ]);

    expect(result.problems).toEqual([]);
    expect(result.members[0].values).toEqual({
      first_name: 'Erika',
      last_name: 'Mustermann',
      email: 'erika@example.org',
      role: 'member',
      gender: 'female',
      birthday: '1988-05-06',
      phone: null,
      mobile_phone: '0170 1234567',
      member_number: '42',
      qttr: 1450,
      no_games: true,
      ranking: { team: 1, position: 2 },
      groups: ['Hobby', 'Jugend'],
      trainings: ['Erwachsenentraining'],
    });
  });

  it('zählt Zeilen so, wie Excel sie anzeigt', () => {
    // Kopfzeile ist 1, die erste Datenzeile also 2 — sonst sucht man die falsche Zeile.
    const result = parseMemberRows([row(), row({ Vorname: '' })]);
    expect(result.problems[0].row).toBe(3);
  });

  it('überspringt leere Zeilen, statt sie zu bemängeln', () => {
    const empty: SheetRow = {};
    for (const header of HEADERS) empty[header] = '';

    const result = parseMemberRows([row(), empty]);
    expect(result.members).toHaveLength(1);
    expect(result.problems).toEqual([]);
  });

  it('verlangt Vor- und Nachnamen', () => {
    const result = parseMemberRows([row({ Vorname: '', Nachname: '' })]);
    expect(result.problems.map((p) => p.column)).toEqual(['Vorname', 'Nachname']);
  });

  it('nimmt Mitglieder ohne E-Mail an', () => {
    // Kinder haben oft keine — das ist im Verein der Normalfall, kein Fehler.
    const result = parseMemberRows([row({ 'E-Mail': '' })]);
    expect(result.problems).toEqual([]);
    expect(result.members[0].values.email).toBeNull();
  });

  it('meldet eine Adresse, die zweimal vorkommt', () => {
    const result = parseMemberRows([row(), row({ Vorname: 'Erik' })]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].message).toMatch(/Zeile 2/);
  });

  it('meldet unbekannte Rollen, statt zu raten', () => {
    const result = parseMemberRows([row({ Rolle: 'Vorstand' })]);
    expect(result.problems[0].column).toBe('Rolle');
    expect(result.members).toHaveLength(0);
  });

  it('nimmt eine leere Rolle als Mitglied an', () => {
    const result = parseMemberRows([row({ Rolle: '' })]);
    expect(result.members[0].values.role).toBe('member');
  });

  it('nennt bei einem kaputten Datum die erwartete Schreibweise', () => {
    const result = parseMemberRows([row({ Geburtstag: 'Mai 1988' })]);
    expect(result.problems[0].message).toMatch(/06\.05\.1988/);
  });
});

// ---------------------------------------------------------------- Abgleich

function parsed(values: Partial<ParsedMember> & { first_name: string; last_name: string }) {
  return {
    row: 2,
    values: {
      email: null,
      role: 'member' as const,
      gender: null,
      birthday: null,
      phone: null,
      mobile_phone: null,
      member_number: null,
      qttr: null,
      no_games: false,
      ranking: null,
      groups: [],
      trainings: [],
      ...values,
    },
  };
}

describe('planImport', () => {
  const existing: ExistingMember[] = [
    { id: 'm-1', email: 'erika@example.org', member_number: '42', full_name: 'Erika Mustermann' },
    { id: 'm-2', email: null, member_number: '43', full_name: 'Max Mustermann' },
    { id: 'm-3', email: null, member_number: null, full_name: 'Max Mustermann' },
  ];

  it('legt unbekannte Mitglieder an', () => {
    const plan = planImport([parsed({ first_name: 'Neu', last_name: 'Zugang' })], existing);
    expect(plan.create).toHaveLength(1);
    expect(plan.update).toHaveLength(0);
  });

  it('erkennt ein Mitglied an der E-Mail', () => {
    const plan = planImport(
      [parsed({ first_name: 'Erika', last_name: 'Anders', email: 'erika@example.org' })],
      existing,
    );
    expect(plan.update).toEqual([{ id: 'm-1', values: expect.objectContaining({ last_name: 'Anders' }) }]);
  });

  it('erkennt es sonst an der Mitgliedsnummer', () => {
    const plan = planImport(
      [parsed({ first_name: 'Max', last_name: 'Neu', member_number: '43' })],
      existing,
    );
    expect(plan.update[0].id).toBe('m-2');
  });

  it('lässt zweideutige Namen liegen, statt das falsche Mitglied zu überschreiben', () => {
    // Zwei „Max Mustermann" ohne E-Mail und ohne Nummer: Wer gemeint ist, weiß nur ein Mensch.
    const plan = planImport([parsed({ first_name: 'Max', last_name: 'Mustermann' })], existing);
    expect(plan.ambiguous).toHaveLength(1);
    expect(plan.create).toHaveLength(0);
    expect(plan.update).toHaveLength(0);
  });

  it('nimmt den Namen nur, wenn er eindeutig ist', () => {
    const plan = planImport(
      [parsed({ first_name: 'Erika', last_name: 'Mustermann' })],
      [existing[0]],
    );
    expect(plan.update[0].id).toBe('m-1');
  });
});

// ---------------------------------------------------------------- Export

describe('memberToRow', () => {
  const context = {
    rankings: new Map([['m-1', '1.2']]),
    groups: new Map([['m-1', ['Hobby', 'Jugend']]]),
    trainings: new Map([['m-1', ['Erwachsenentraining']]]),
  };

  it('schreibt dieselben Spalten, die der Import liest', () => {
    const exported = memberToRow(
      {
        id: 'm-1',
        first_name: 'Erika',
        last_name: 'Mustermann',
        email: 'erika@example.org',
        role: 'team_leader',
        gender: 'female',
        birthday: '1988-05-06',
        phone: null,
        mobile_phone: '0170 1234567',
        member_number: '42',
        qttr: 1450,
        no_games: false,
      },
      context,
    );

    expect(Object.keys(exported)).toEqual(HEADERS);
    expect(exported.Rolle).toBe('Mannschaftsführer');
    expect(exported.Geburtstag).toBe('06.05.1988');
    expect(exported.Gruppen).toBe('Hobby, Jugend');
    expect(exported['Kein Mannschaftsspieler']).toBe('nein');
  });

  it('kommt heil wieder herein — Export, dann Import', () => {
    const exported = memberToRow(
      {
        id: 'm-1',
        first_name: 'Erika',
        last_name: 'Mustermann',
        email: 'erika@example.org',
        role: 'trainer',
        gender: 'female',
        birthday: '1988-05-06',
        phone: null,
        mobile_phone: null,
        member_number: '42',
        qttr: 1450,
        no_games: true,
      },
      context,
    );

    const back = parseMemberRows([exported]).members[0].values;

    expect(back.role).toBe('trainer');
    expect(back.gender).toBe('female');
    expect(back.birthday).toBe('1988-05-06');
    expect(back.qttr).toBe(1450);
    expect(back.no_games).toBe(true);
    expect(back.ranking).toEqual({ team: 1, position: 2 });
    expect(back.groups).toEqual(['Hobby', 'Jugend']);
  });
});

// ---------------------------------------------------------------- Zellen aus exceljs

describe('toCell', () => {
  it('lässt einfache Werte durch', () => {
    expect(toCell('Erika')).toBe('Erika');
    expect(toCell(1450)).toBe(1450);
    expect(toCell(null)).toBe('');
  });

  it('packt eine Formel aus', () => {
    // Sonst stünde „[object Object]" als Nachname in der Datenbank.
    expect(toCell({ formula: 'A1&B1', result: 'Erika Mustermann' })).toBe('Erika Mustermann');
  });

  it('packt einen Link aus', () => {
    expect(toCell({ text: 'erika@example.org', hyperlink: 'mailto:erika@example.org' })).toBe(
      'erika@example.org',
    );
  });

  it('setzt formatierten Text wieder zusammen', () => {
    expect(
      toCell({ richText: [{ text: 'Erika' }, { text: ' ' }, { text: 'Mustermann' }] }),
    ).toBe('Erika Mustermann');
  });

  it('reicht ein Datum unverändert weiter', () => {
    const date = new Date(1988, 4, 6);
    expect(toCell(date)).toBe(date);
  });
});

describe('exportFilename', () => {
  it('hängt das Datum an, damit zwei Downloads nicht gleich heißen', () => {
    expect(exportFilename('mitglieder', new Date(2026, 8, 18))).toBe('mitglieder-2026-09-18.xlsx');
  });
});

// ---------------------------------------------------------------- Bericht

describe('summarizeImport', () => {
  it('zählt, was passiert ist', () => {
    expect(
      summarizeImport([
        { name: 'A', action: 'created', invited: true },
        { name: 'B', action: 'created', invited: false },
        { name: 'C', action: 'updated' },
        { name: 'D', action: 'failed', detail: 'kaputt' },
      ]),
    ).toEqual({ created: 2, updated: 1, failed: 1, invited: 1 });
  });
});
