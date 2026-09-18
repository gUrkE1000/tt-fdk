#!/usr/bin/env node --experimental-strip-types
/**
 * Erzeugt die App-Symbole aus `scripts/icon.svg`.
 *
 * Aufruf: `npm run make:icons`
 *
 * Die Ergebnisse liegen in `public/icons/` und sind eingecheckt — sie ändern sich nur,
 * wenn jemand das Symbol ändert, und niemand soll für einen Build `sharp` bauen müssen.
 *
 * Warum nicht ein einziges SVG im Manifest: Android und iOS verlangen Rastergrafiken in
 * festen Größen, und iOS ignoriert das Manifest ohnehin und nimmt `apple-touch-icon`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, 'icon.svg');
const target = join(here, '..', 'public', 'icons');

interface IconSpec {
  file: string;
  size: number;
  /** Maskierbar: das Symbol füllt die Fläche randlos, das System schneidet die Form. */
  maskable?: boolean;
}

const ICONS: IconSpec[] = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  // iOS zeigt dieses Symbol auf dem Startbildschirm — ohne Transparenz, sonst wird es schwarz.
  { file: 'apple-touch-icon.png', size: 180 },
];

async function main(): Promise<void> {
  const svg = await readFile(source);
  await mkdir(target, { recursive: true });

  for (const icon of ICONS) {
    // Für das maskierbare Symbol schrumpft der Inhalt auf 80 % und bekommt ringsum
    // Vereinsfarbe: so überlebt der Schläger jeden Zuschnitt.
    const inner = icon.maskable ? Math.round(icon.size * 0.8) : icon.size;
    const pad = Math.round((icon.size - inner) / 2);

    const rendered = await sharp(svg, { density: 384 })
      .resize(inner, inner, { fit: 'contain' })
      .extend({
        top: pad,
        bottom: icon.size - inner - pad,
        left: pad,
        right: icon.size - inner - pad,
        background: '#0d9488',
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeFile(join(target, icon.file), rendered);
    process.stdout.write(`✓ ${icon.file} (${icon.size}×${icon.size})\n`);
  }
}

await main();
