import { HEADERS, type Cell, type SheetRow } from './excel';

/**
 * Lesen und Schreiben von .xlsx-Dateien (Aufgabe 9.5).
 *
 * **Warum `exceljs` und nicht `xlsx`:** Der Plan nennt das Paket `xlsx` (SheetJS). Die
 * Fassung, die auf npm liegt, ist 0.18.5 und hat eine offene Prototype-Pollution-Lücke
 * genau im Tabellen-Parser (CVE-2023-30533) — also in dem Code, der eine hochgeladene
 * Datei liest. Die behobenen Fassungen vertreibt SheetJS nur über die eigene Adresse,
 * nicht über npm. `exceljs` kann dasselbe, ist gepflegt und hat diese Lücke nicht.
 *
 * Beide Funktionen laden die Bibliothek **erst beim Aufruf**. Sie wiegt rund ein Megabyte;
 * fest eingebunden zahlte jedes Mitglied beim ersten Seitenaufruf dafür, obwohl der
 * Import zweimal im Vereinsleben vorkommt.
 */

export const SHEET_NAME = 'Mitglieder';

/** Eine Arbeitsmappe mit Kopfzeile und den übergebenen Zeilen. */
export async function buildWorkbook(rows: Record<string, string>[]): Promise<Blob> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);

  sheet.columns = HEADERS.map((header) => ({
    header,
    key: header,
    // Grob nach Inhalt: Sonst steht in jeder Spalte „####" und niemand sieht, was drin ist.
    width: header.length < 10 ? 14 : header.length + 6,
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Die erste Tabelle einer Datei als Zeilen, benannt nach der Kopfzeile.
 *
 * Gelesen wird nach **Überschrift**, nicht nach Spaltennummer: Wer in der Vorlage eine
 * Spalte einfügt oder verschiebt, soll nicht plötzlich Telefonnummern im Feld Geburtstag
 * haben.
 */
export async function readWorkbook(file: ArrayBuffer): Promise<SheetRow[]> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Die Datei enthält keine Tabelle.');

  const headerRow = sheet.getRow(1);
  const headers = new Map<number, string>();

  headerRow.eachCell((cell, columnNumber) => {
    const name = String(cell.value ?? '').trim();
    if (name !== '') headers.set(columnNumber, name);
  });

  if (headers.size === 0) throw new Error('Die erste Zeile enthält keine Überschriften.');

  const rows: SheetRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const entry: SheetRow = {};
    for (const header of HEADERS) entry[header] = '';

    headers.forEach((name, columnNumber) => {
      entry[name] = toCell(row.getCell(columnNumber).value);
    });

    rows.push(entry);
  });

  return rows;
}

/**
 * Eine Zelle von exceljs in etwas verwandeln, mit dem `excel.ts` rechnen kann.
 *
 * exceljs gibt Formeln als Objekt mit Ergebnis, Links als Objekt mit Text und
 * Rich-Text als Liste von Stücken zurück. Wer das nicht auspackt, bekommt in der
 * Tabelle „[object Object]" — und im schlimmsten Fall steht das dann als Nachname
 * in der Datenbank.
 */
export function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  const object = value as Record<string, unknown>;

  if (typeof object.text === 'string') return object.text;
  if ('result' in object) return toCell(object.result);
  if ('hyperlink' in object && typeof object.hyperlink === 'string') return object.hyperlink;

  if (Array.isArray(object.richText)) {
    return (object.richText as { text?: unknown }[])
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
  }

  return String(value);
}

/** Die Datei zum Herunterladen anbieten. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** „mitglieder-2026-09-18.xlsx" — mit Datum, damit zwei Downloads nicht gleich heißen. */
export function exportFilename(prefix: string, now: Date = new Date()): string {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `${prefix}-${date}.xlsx`;
}
