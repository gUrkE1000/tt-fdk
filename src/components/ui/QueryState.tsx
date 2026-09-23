import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '../../lib/cn';
import Button from './Button';

export interface LoadingStateProps {
  /** Wie viele Platzhalter-Karten. */
  rows?: number;
  /** Für Screenreader — sehen tut man die grauen Blöcke. */
  label?: string;
  className?: string;
}

/**
 * Platzhalter, solange Daten laden.
 *
 * Früher stand an dieser Stelle der Leerzustand („Keine Spiele"), bis die Daten da
 * waren — für ein, zwei Sekunden eine falsche Auskunft, auf dem Handy im Mobilnetz auch
 * länger. Graue Blöcke in Kartenform sagen „gleich", ohne etwas zu behaupten.
 */
export function LoadingState({ rows = 3, label = 'Wird geladen …', className }: LoadingStateProps) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4"
          aria-hidden="true"
        >
          <div className="h-3 w-1/3 rounded bg-gray-200" />
          <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Laden ist gescheitert. Wichtig ist, dass es **nicht** wie eine leere Liste aussieht:
 * „Keine offenen Spiele" nach einem Netzfehler ist eine falsche Auskunft, die niemand
 * als Fehler erkennt.
 */
export function ErrorState({
  title = 'Das ließ sich gerade nicht laden',
  description = 'Vermutlich ist die Verbindung weg oder der Server antwortet nicht. Was hier steht, ist nicht vollständig.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-status-no bg-status-no-soft px-6 py-8 text-center',
        className,
      )}
    >
      <AlertTriangle className="mb-3 h-7 w-7 text-status-no" aria-hidden="true" />
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-600">{description}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}
