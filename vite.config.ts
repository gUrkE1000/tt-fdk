import { defineConfig, loadEnv, type Plugin } from 'vite';
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

/**
 * Welcher Stand ausgeliefert wird — im Bundle festgeschrieben.
 *
 * Ohne das ist bei einem Fehler, der nur auf fremden Geräten auftritt, nicht
 * feststellbar, ob die Person gerade die gebaute Fassung sieht oder eine ältere aus
 * einem Zwischenspeicher. Diese eine Unbekannte kostet sonst jede Fehlersuche mehrere
 * Runden: Jede Gegenprobe ist wertlos, solange offen ist, welcher Code lief.
 */
const buildId = (process.env.GITHUB_SHA ?? '').slice(0, 7) || 'lokal';

/**
 * Content-Security-Policy als Meta-Tag — nur im Produktionsbuild.
 *
 * GitHub Pages setzt keine Sicherheits-Header. Die Policy erlaubt Skripte nur vom eigenen
 * Ursprung (kein Inline-Skript) und Verbindungen nur zu Supabase: Ein eingeschleustes
 * Skript könnte weder etwas nachladen noch Daten wegschicken. `style-src 'unsafe-inline'`
 * brauchen FullCalendar und der Editor. `frame-ancestors` wirkt per Meta-Tag nicht.
 *
 * Nicht im Entwicklungsmodus: Dort braucht Vite ein Inline-Skript (React Refresh) und
 * eine WebSocket-Verbindung für das Neuladen.
 */
function contentSecurityPolicy(supabaseUrl: string): Plugin {
  const connect = ["'self'", supabaseUrl].filter(Boolean).join(' ');
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig(({ command, mode }) => ({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    contentSecurityPolicy(
      (loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
    ),
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
      // Ein gültiger, aber bedeutungsloser VAPID-Schlüssel: Die Glocke prüft ihn auf
      // Vorhandensein, und `urlBase64ToUint8Array` soll an echtem Base64 arbeiten.
      VITE_VAPID_PUBLIC_KEY:
        'BAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-P0A',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/sw.ts'],
    },
  },
}));
