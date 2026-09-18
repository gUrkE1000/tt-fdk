/**
 * Design-Tokens nach Zielbild 6.3.
 *
 * Farben sind semantisch benannt, nicht nach ihrem Farbwert: `status-yes` statt `emerald-600`.
 * Dadurch bleibt eine spätere Umfärbung eine Änderung an einer Stelle, und der Code sagt,
 * was gemeint ist.
 *
 * **Dark Mode (Aufgabe 9.11) über Variablen, nicht über `dark:`-Varianten.** Der Code
 * verwendet `gray-*` und `bg-white` an gut fünfhundert Stellen. Neben jede davon ein
 * `dark:`-Gegenstück zu schreiben hieße, fünfhundert Gelegenheiten für ein vergessenes
 * oder falsches Paar zu schaffen. Stattdessen zeigen die Token auf CSS-Variablen, und
 * `src/index.css` setzt sie unter `.dark` anders — eine Stelle statt fünfhundert.
 *
 * `<alpha-value>` muss dabei stehen bleiben, sonst funktionieren `bg-gray-900/40` und
 * ähnliche Transparenzen nicht mehr.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Flächen und Schrift. Dieselben Namen wie in Tailwind, damit der
        // vorhandene Code unverändert bleibt — nur die Werte hängen jetzt am Modus.
        white: token('surface'),
        gray: {
          50: token('gray-50'),
          100: token('gray-100'),
          200: token('gray-200'),
          300: token('gray-300'),
          400: token('gray-400'),
          500: token('gray-500'),
          600: token('gray-600'),
          700: token('gray-700'),
          800: token('gray-800'),
          900: token('gray-900'),
        },
        // Aktionen, aktive Navigation
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          soft: token('primary-soft'),
          border: token('primary-border'),
        },
        // Rückmeldungen und Teilnahmestatus
        // Die kräftigen Statusfarben bleiben in beiden Modi gleich — grün heißt
        // Zusage, rot heißt Absage, und daran darf der Modus nichts ändern. Nur die
        // blassen Hintergründe kippen, weil ein Pastellton auf dunklem Grund leuchtet.
        status: {
          yes: token('status-yes'),
          'yes-soft': token('status-yes-soft'),
          late: token('status-late'),
          'late-soft': token('status-late-soft'),
          unclear: token('status-late'),
          'unclear-soft': token('status-late-soft'),
          no: token('status-no'),
          'no-soft': token('status-no-soft'),
          open: token('gray-400'),
          'open-soft': token('gray-100'),
          absent: token('status-absent'),
          'absent-soft': token('status-absent-soft'),
          removed: token('gray-700'),
        },
        // Kalenderkategorien (Zielbild 6.3)
        cal: {
          training: '#0ea5e9', // sky-500
          match: '#0d9488', // teal-600
          event: '#8b5cf6', // violet-500
          birthday: '#ec4899', // pink-500
          misc: '#6b7280', // gray-500
          venue: '#f43f5e', // rose-500
        },
        // Signalfarben
        danger: '#e11d48',
        warning: '#f59e0b',
        info: '#0284c7', // sky-600
        success: '#059669',
      },
      minHeight: {
        touch: '44px', // Mindestgröße für Touch-Ziele
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
