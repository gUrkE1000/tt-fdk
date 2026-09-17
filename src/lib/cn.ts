import clsx, { type ClassValue } from 'clsx';

/**
 * Klassennamen zusammensetzen. Bewusst ohne tailwind-merge: unsere Komponenten setzen
 * Basisklassen und nehmen `className` als Ergänzung an — kollidierende Utilities vermeiden
 * wir durch Varianten-Props statt durch Überschreiben.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
