/**
 * Text aus einer PDF-Datei lesen — Zeile für Zeile, wie er auf der Seite steht.
 *
 * Eine PDF kennt keine Zeilen, nur Textstücke an Positionen. Eine Tabellenzeile besteht
 * aus mehreren Stücken mit (fast) derselben Höhe; die werden hier wieder zu einer Zeile
 * zusammengesetzt, von links nach rechts.
 *
 * pdfjs ist groß und wird nur für den nuScore-Import gebraucht. Deshalb wird es erst
 * beim Einlesen geladen, nicht mit der Anwendung.
 */

export interface PositionedText {
  str: string;
  x: number;
  /** PDF-Koordinaten: größer heißt weiter oben. */
  y: number;
}

/** Bis zu diesem Abstand (in PDF-Punkten) gelten zwei Stücke als dieselbe Zeile. */
const LINE_TOLERANCE = 3;

export function groupTextLines(items: readonly PositionedText[]): string[] {
  const sorted = items
    .filter((item) => item.str.trim() !== '')
    .slice()
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PositionedText[][] = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - item.y) <= LINE_TOLERANCE) line.push(item);
    else lines.push([item]);
  }

  return lines.map((line) =>
    line
      .sort((a, b) => a.x - b.x)
      .map((item) => item.str.trim())
      .join(' '),
  );
}

export async function readPdfLines(file: Blob): Promise<string[]> {
  // Der `legacy`-Build läuft auch in Browsern, die neue Sprachmittel wie
  // `Math.sumPrecise` noch nicht kennen — etwa Safari auf älteren iPhones.
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await task.promise;
  try {
    const lines: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const items: PositionedText[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5] });
      }
      lines.push(...groupTextLines(items));
    }
    return lines;
  } finally {
    await task.destroy();
  }
}
