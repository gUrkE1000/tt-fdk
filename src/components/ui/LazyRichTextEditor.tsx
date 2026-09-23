import { lazy, Suspense } from 'react';
import type { RichTextEditorProps } from './RichTextEditor';

const Editor = lazy(() => import('./RichTextEditor'));

/**
 * Der Editor wird erst geladen, wenn jemand ihn öffnet — er ist das größte Einzelstück
 * der Anwendung und wird nur zum Schreiben gebraucht. Bis er da ist, steht ein Feld in
 * seiner Größe dort, damit der Dialog nicht springt.
 */
export default function LazyRichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          className="h-40 animate-pulse rounded-xl border border-gray-300 bg-gray-50"
          aria-busy="true"
          aria-label="Editor wird geladen"
        />
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}
