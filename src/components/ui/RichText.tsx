import { cn } from '../../lib/cn';
import { sanitizeRichText } from '../../lib/richText';

export interface RichTextProps {
  html: string;
  className?: string;
}

/**
 * Die Anzeigeseite. Bereinigt **immer** — auch, was aus der eigenen Datenbank kommt.
 *
 * Eigene Datei, getrennt vom Editor: Jedes Mitglied liest Rich-Text (Vereinstermine,
 * Umfragen, Neuigkeiten), aber nur Veranstalter schreiben ihn. Stünden beide in einer
 * Datei, lüde jedes Mitglied den ganzen Editor mit.
 */
export function RichText({ html, className }: RichTextProps) {
  return (
    <div
      className={cn('prose-sm max-w-none text-gray-800', className)}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}
