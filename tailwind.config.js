/**
 * Design-Tokens nach Zielbild 6.3.
 *
 * Farben sind semantisch benannt, nicht nach ihrem Farbwert: `status-yes` statt `emerald-600`.
 * Dadurch bleibt eine spätere Umfärbung eine Änderung an einer Stelle, und der Code sagt,
 * was gemeint ist. Die Werte entsprechen der Tailwind-Standardpalette.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aktionen, aktive Navigation
        primary: {
          DEFAULT: '#0d9488', // teal-600
          hover: '#0f766e', // teal-700
          soft: '#f0fdfa', // teal-50
          border: '#99f6e4', // teal-200
        },
        // Rückmeldungen und Teilnahmestatus
        status: {
          yes: '#059669', // emerald-600
          'yes-soft': '#ecfdf5', // emerald-50
          late: '#f59e0b', // amber-500
          'late-soft': '#fffbeb', // amber-50
          unclear: '#f59e0b',
          'unclear-soft': '#fffbeb',
          no: '#e11d48', // rose-600
          'no-soft': '#fff1f2', // rose-50
          open: '#9ca3af', // gray-400
          'open-soft': '#f3f4f6', // gray-100
          absent: '#64748b', // slate-500
          'absent-soft': '#f1f5f9', // slate-100
          removed: '#374151', // gray-700
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
