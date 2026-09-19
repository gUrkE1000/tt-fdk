/**
 * Kopiert `dist/index.html` nach `dist/404.html`.
 *
 * Diese Anwendung ist eine Single-Page-App: `/trainings` ist keine Datei, sondern eine
 * Route, die erst im Browser entsteht. Ein statischer Hoster kennt sie nicht und antwortet
 * mit 404 — bei jedem Lesezeichen, jedem Neuladen und jedem Link aus einer
 * Benachrichtigung. Nur der Aufruf der Wurzel funktioniert, und genau deshalb fällt es
 * beim Ausprobieren nicht auf.
 *
 * GitHub Pages liefert bei einem unbekannten Pfad die Datei `404.html` aus. Ist sie eine
 * Kopie von `index.html`, lädt dort dieselbe Anwendung, liest die Adresse aus
 * `window.location` und zeigt die richtige Seite. Der Umweg ist von außen nicht zu sehen.
 *
 * Andere Hoster lösen dasselbe über eine Umschreiberegel (Netlify `_redirects`, Vercel
 * `rewrites`, nginx `try_files`). Eine zusätzliche Datei schadet dort nicht — deshalb
 * läuft dieser Schritt bei jedem Build und nicht nur im Pages-Workflow.
 */

import { copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const dist = process.env.VITE_OUT_DIR ?? 'dist';
const source = join(dist, 'index.html');
const target = join(dist, '404.html');

try {
  await access(source);
} catch {
  console.error(`spa-fallback: ${source} gibt es nicht — lief 'vite build' vorher?`);
  process.exit(1);
}

await copyFile(source, target);
console.log(`spa-fallback: ${target} geschrieben`);
