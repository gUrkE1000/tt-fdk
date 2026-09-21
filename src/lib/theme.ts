/**
 * Hell, dunkel oder wie das System (Aufgabe 9.11).
 *
 * Die Farben selbst stehen als CSS-Variablen in `src/index.css`; hier wird nur
 * entschieden, ob `<html>` die Klasse `dark` trägt. Deshalb ist Dark Mode keine Änderung
 * an fünfhundert Komponenten, sondern eine an einer Stelle.
 */

export type ThemeChoice = 'system' | 'light' | 'dark';

/**
 * Was gilt, solange niemand etwas gewählt hat.
 *
 * Bewusst `light` und nicht `system`: Ein Verein bekommt die Anwendung am Hallenabend auf
 * einem fremden Telefon gezeigt, und auf vielen Geräten steht das System dauerhaft auf
 * dunkel. Eine Aufstellung, ein Kalender und eine Tabelle sind hell entworfen und
 * geprüft; hell ist der Zustand, den alle gemeinsam sehen. Wer es dunkel will, stellt es
 * unter „Mein Profil" um — und das bleibt dann auch so.
 */
export const DEFAULT_THEME: ThemeChoice = 'light';

export const THEME_STORAGE_KEY = 'vereinsplaner.theme';

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'Wie das System',
  light: 'Hell',
  dark: 'Dunkel',
};

/** Was tatsächlich angezeigt wird — „system" auf das aufgelöst, was das Gerät sagt. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): 'light' | 'dark' {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice;
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Die gespeicherte Wahl.
 *
 * `localStorage` kann werfen — im privaten Fenster, bei gesperrten Website-Daten, in
 * manchen eingebetteten Ansichten. Eine Anwendung, die daran scheitert, wäre wegen einer
 * Farbeinstellung nicht startbar.
 */
export function readStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Dann gilt die Wahl eben nur für diese Sitzung.
  }
}

/** Die Klasse an `<html>` setzen oder entfernen. */
export function applyTheme(mode: 'light' | 'dark', root: HTMLElement): void {
  root.classList.toggle('dark', mode === 'dark');
  // Damit der Browser Auswahlfelder, Bildlaufleisten und den Datumswähler passend zeichnet.
  root.style.colorScheme = mode;
}

export function prefersDarkNow(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
