// ESLint (flache Konfiguration). Bewusst schmal: Die Typprüfung übernimmt tsc, das Format
// ist Sache der Entwickler. ESLint prüft, was tsc nicht sieht — vor allem die Regeln der
// React-Hooks, deren Verletzung erst zur Laufzeit auffällt.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/', 'dev-dist/', 'coverage/', 'node_modules/', 'src/lib/database.types.ts'],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    // Edge Functions laufen in Deno, Skripte und Konfiguration in Node.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', '*.config.{js,ts}', 'public/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-var': 'off', 'no-unused-vars': 'off' },
  },
);
