import { describe, it, expect } from 'vitest';
import { getFirstName, getShortName, isNameMatch } from '../../src/lib/names';

describe('getShortName', () => {
  it('kürzt den Nachnamen auf die Initiale', () => {
    expect(getShortName('Max Mustermann')).toBe('Max M');
  });

  it('lässt mehrere Vornamen stehen', () => {
    expect(getShortName('Karl Heinz Müller')).toBe('Karl Heinz M');
  });

  it('macht die Initiale groß, auch wenn der Name klein geschrieben ist', () => {
    expect(getShortName('max mustermann')).toBe('max M');
  });

  it('lässt einen Namen ohne Nachnamen unverändert', () => {
    expect(getShortName('Max')).toBe('Max');
    expect(getShortName('')).toBe('');
  });

  it('ignoriert Leerraum am Rand und zwischen den Wörtern', () => {
    expect(getShortName('  Max Mustermann  ')).toBe('Max M');
    expect(getShortName('Max   Mustermann')).toBe('Max M');
  });

  it('kommt mit Umlauten im Nachnamen zurecht', () => {
    expect(getShortName('Anna Öztürk')).toBe('Anna Ö');
  });
});

describe('getFirstName', () => {
  it('gibt das erste Wort zurück', () => {
    expect(getFirstName('Max Mustermann')).toBe('Max');
  });

  it('gibt bei einem einzelnen Wort dieses zurück', () => {
    expect(getFirstName('Max')).toBe('Max');
  });

  it('gibt bei leerer Eingabe eine leere Zeichenkette zurück', () => {
    expect(getFirstName('')).toBe('');
    expect(getFirstName('   ')).toBe('');
  });
});

describe('isNameMatch', () => {
  it('erkennt Gleichheit unabhängig von Schreibweise und Leerraum', () => {
    expect(isNameMatch('Max Mustermann', 'max mustermann')).toBe(true);
    expect(isNameMatch('  Max Mustermann  ', 'max mustermann')).toBe(true);
  });

  it('erkennt die abgekürzte Form', () => {
    expect(isNameMatch('Max M', 'Max Mustermann')).toBe(true);
    expect(isNameMatch('max m', 'MAX MUSTERMANN')).toBe(true);
  });

  it('erkennt die abgekürzte Form mit Schlusspunkt', () => {
    expect(isNameMatch('Max M.', 'Max Mustermann')).toBe(true);
  });

  it('erkennt die abgekürzte Form bei mehreren Vornamen', () => {
    expect(isNameMatch('Karl Heinz M', 'Karl Heinz Müller')).toBe(true);
    expect(isNameMatch('Karl Heinz M.', 'Karl Heinz Müller')).toBe(true);
  });

  it('lehnt ab, wenn die Vornamen nicht übereinstimmen', () => {
    expect(isNameMatch('Mia M', 'Max Mustermann')).toBe(false);
  });

  it('lehnt ab, wenn links ein Vorname fehlt', () => {
    expect(isNameMatch('Karl M', 'Karl Heinz Müller')).toBe(false);
  });

  it('lehnt eine falsche Initiale ab', () => {
    expect(isNameMatch('Max S', 'Max Mustermann')).toBe(false);
  });

  it('lehnt ab, wenn rechts an der Stelle der Initiale nichts steht', () => {
    expect(isNameMatch('Max M', 'Max')).toBe(false);
  });

  it('erkennt keine Abkürzung auf der rechten Seite', () => {
    // Die Richtung ist Absicht: Der erste Name ist der gekürzte.
    expect(isNameMatch('Max Mustermann', 'Max M')).toBe(false);
  });

  it('lehnt leere Eingaben ab', () => {
    expect(isNameMatch('', 'Max Mustermann')).toBe(false);
    expect(isNameMatch('Max M', '')).toBe(false);
  });

  it('hält zwei leere Namen für gleich', () => {
    // Beide leer heißt: Es gibt nichts zu unterscheiden. Die Aufrufer prüfen vorher,
    // ob überhaupt ein Name vorliegt.
    expect(isNameMatch('', '')).toBe(true);
  });
});
