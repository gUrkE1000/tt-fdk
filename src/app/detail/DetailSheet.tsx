import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as RadixDialog from '@radix-ui/react-dialog';
import { ArrowLeft, X } from 'lucide-react';
import { LoadingState } from '../../components/ui';
import { detailLabel, readDetail, withDetail, type DetailState } from '../../lib/detailSheet';

// Erst beim Öffnen laden: Die Übersicht braucht die Einzelansichten nicht.
const MatchDetail = lazy(() => import('../../features/matches/MatchDetail'));
const TrainingSessionDetail = lazy(() => import('../../features/trainings/TrainingSessionDetail'));
const EventDetail = lazy(() => import('../../features/events/EventDetail'));

/**
 * Die Einzelansicht als Blatt über der Seite (`src/lib/detailSheet.ts`).
 *
 * Am Telefon deckt es den Bildschirm ab und hat links einen Pfeil wie eine eigene Seite;
 * ab `sm` fährt es von rechts herein, und man sieht die Liste daneben noch.
 * Offen ist es, solange die Adresse den Parameter trägt — Zurückwischen schließt es
 * also ganz von selbst.
 */
export default function DetailSheet() {
  const location = useLocation();
  const navigate = useNavigate();
  const detail = readDetail(location.search);

  if (!detail) return null;

  function close() {
    // Für das Blatt angelegt: einen Schritt zurück, damit „vorwärts" nichts übrig bleibt.
    if ((location.state as DetailState | null)?.detailSheet) {
      navigate(-1);
      return;
    }
    // Direkt so aufgerufen (Lesezeichen, neu geladen ohne Verlauf): nur den Parameter weg.
    navigate(
      { pathname: location.pathname, search: withDetail(location.search, null), hash: location.hash },
      { replace: true },
    );
  }

  const label = detailLabel(detail.kind);

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && close()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-gray-900/40" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-gray-50 sm:left-auto sm:w-full sm:max-w-2xl sm:border-l sm:border-gray-200"
        >
          <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 sm:px-4">
            <RadixDialog.Close
              aria-label="Schließen"
              className="flex min-h-touch min-w-touch items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 sm:order-last sm:-mr-2"
            >
              <ArrowLeft className="h-5 w-5 sm:hidden" aria-hidden="true" />
              <X className="hidden h-5 w-5 sm:block" aria-hidden="true" />
            </RadixDialog.Close>
            <RadixDialog.Title className="flex-1 truncate text-lg font-bold text-gray-900">
              {label}
            </RadixDialog.Title>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <Suspense fallback={<LoadingState rows={1} />}>
              {detail.kind === 'match' && <MatchDetail key={detail.id} matchId={detail.id} />}
              {detail.kind === 'training' && (
                <TrainingSessionDetail key={detail.id} sessionId={detail.id} />
              )}
              {detail.kind === 'event' && <EventDetail key={detail.id} eventId={detail.id} />}
            </Suspense>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
