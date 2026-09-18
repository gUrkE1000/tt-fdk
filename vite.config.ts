import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `base` steuert, unter welchem Pfad die Anwendung ausgeliefert wird.
 *
 * Voreinstellung ist die Wurzel. Wer auf einem Unterpfad hostet (GitHub Pages liefert ein
 * Projekt unter `/<repo>/` aus), setzt `VITE_BASE_PATH=/repo/` beim Bauen. Ein relativer
 * Pfad (`./`) ginge hier nicht: Der Service Worker braucht einen festen Gültigkeitsbereich,
 * und ein tiefer Link wie `/trainings/cancellations` würde seine Skripte sonst unter
 * `/trainings/assets/…` suchen.
 */
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig(({ command }) => ({
  base,
  plugins: [
    react(),
    // Nur beim Bauen: im Entwicklungsmodus säße sonst ein Service Worker vor dem
    // Neuladen und lieferte hartnäckig den Stand von vorhin.
    ...(command === 'build'
      ? [
          VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'prompt',
            // Angemeldet wird der Service Worker in `src/lib/pwa.ts` — sonst täte es
            // zusätzlich ein eingefügtes Skript, und der Hinweis auf einen neuen Stand
            // hinge an einer Anmeldung, die die Anwendung nicht in der Hand hat.
            injectRegister: false,
            injectManifest: {
              globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
            },
            manifest: {
              name: 'Vereinsplaner',
              short_name: 'Vereinsplaner',
              description: 'Trainings, Spieltermine und Vereinstermine des Vereins.',
              lang: 'de',
              start_url: base,
              scope: base,
              display: 'standalone',
              orientation: 'portrait',
              background_color: '#f9fafb',
              theme_color: '#0d9488',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: 'icons/icon-maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
          }),
        ]
      : []),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Der Supabase-Client bricht ohne Konfiguration bewusst ab. In Tests genügen
    // Platzhalter: es geht nie eine echte Anfrage raus, die Module werden gemockt.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_APP_URL: 'http://localhost:5173',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/sw.ts'],
    },
  },
}));
