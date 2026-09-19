import { useEffect, useState } from 'react';

export interface LoadingScreenProps {
  /** Nach wie vielen Millisekunden der Hinweis erscheint. */
  hintAfterMs?: number;
  /**
   * Woran es gerade hängt, in einem kurzen technischen Kürzel.
   *
   * Erscheint erst ganz zum Schluss und klein: Für ein Mitglied ist es bedeutungslos,
   * für denjenigen, der den Fehler sucht, ist es alles. Ein Fehler, der nur auf fremden
   * Geräten auftritt, lässt sich sonst nur über Screenshots und Vermutungen eingrenzen.
   */
  detail?: string;
}

/**
 * Der bildschirmfüllende Ladezustand.
 *
 * Ein Kringel, der sich dreht und sonst nichts sagt, ist die schlechteste Auskunft, die
 * eine Anwendung geben kann: Nach fünf Sekunden weiß niemand, ob noch etwas passiert, ob
 * das Netz weg ist oder ob die Seite kaputt ist. Deshalb meldet sich dieser hier nach
 * einer Weile zu Wort — und sagt am Ende auch, was man selbst tun kann.
 *
 * Die Zeiten sind bewusst großzügig: Wer auf dem Hallenparkplatz im Funkloch steht, soll
 * nicht nach zwei Sekunden lesen, es sei etwas kaputt.
 */
export default function LoadingScreen({ hintAfterMs = 4000, detail }: LoadingScreenProps) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const first = setTimeout(() => setStage(1), hintAfterMs);
    const second = setTimeout(() => setStage(2), hintAfterMs * 3);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [hintAfterMs]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4">
      <div
        role="status"
        aria-label="Lädt"
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary"
      />

      {stage > 0 && (
        <p className="max-w-xs text-center text-sm text-gray-500" aria-live="polite">
          {stage === 1
            ? 'Das dauert länger als gewöhnlich …'
            : 'Der Server antwortet nicht. Prüfe deine Internetverbindung — wenn sie steht, liegt es nicht an dir.'}
        </p>
      )}

      {stage === 2 && detail && (
        <p className="max-w-xs text-center font-mono text-xs text-gray-400">{detail}</p>
      )}
    </div>
  );
}
