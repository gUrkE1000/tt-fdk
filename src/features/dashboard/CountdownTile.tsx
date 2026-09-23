import { Link } from 'react-router-dom';
import { CalendarClock, MapPin } from 'lucide-react';
import { Badge } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import type { MatchCountdown } from './summary';
import { matchPath } from '../matches/paths';

export interface CountdownTileProps {
  countdown: MatchCountdown;
  /** Name der Mannschaft des nächsten Spiels, falls bekannt. */
  teamName?: string;
  /** Ort des nächsten Spiels, falls bekannt. */
  location?: string;
  /** Solange die Spiele laden, steht hier nichts Falsches wie „Kein Spiel angesetzt". */
  loading?: boolean;
  /** Laden gescheitert — auch dann kein „Kein Spiel angesetzt". */
  error?: boolean;
}

/** „heute", „morgen", „in 5 Tagen" — Zahlen liest niemand gern, wenn es ein Wort tut. */
export function countdownLabel(days: number | null): string {
  if (days === null) return 'Kein Spiel angesetzt';
  if (days <= 0) return 'Heute';
  if (days === 1) return 'Morgen';
  return `In ${days} Tagen`;
}

/**
 * Die Countdown-Kachel der Übersicht (Zielbild 4, Aufgabe 8.1).
 *
 * Sie beantwortet die eine Frage, mit der die meisten die Startseite öffnen: wann muss ich
 * das nächste Mal in der Halle sein? Der Rest der Seite kommt danach.
 */
export default function CountdownTile({
  countdown,
  teamName,
  location,
  loading = false,
  error = false,
}: CountdownTileProps) {
  const { next, days, within30 } = countdown;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Mannschaftsspiele
      </div>

      <p className="mt-2 text-2xl font-black text-gray-900">
        {loading || error ? (
          <span className="text-gray-300">{error ? '—' : '…'}</span>
        ) : (
          countdownLabel(days)
        )}
      </p>

      {error ? (
        <p className="mt-1 text-sm text-status-no">Die Spiele ließen sich gerade nicht laden.</p>
      ) : next ? (
        <div className="mt-1 space-y-0.5 text-sm text-gray-600">
          <Link
            to={matchPath(next.id)}
            className="block font-semibold text-gray-800 underline-offset-2 hover:text-primary hover:underline"
          >
            {teamName ? `${teamName} gegen ` : ''}
            {next.opponent || 'unbekannt'}
          </Link>
          <p>{next.dtstart ? formatDateTime(next.dtstart) : '—'}</p>
          {location && (
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <span>{location}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-sm text-gray-500">
          Sobald du im Kader eines Spiels stehst, zählt hier der Countdown.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          {within30} {within30 === 1 ? 'Spiel' : 'Spiele'} in den nächsten 30 Tagen
        </Badge>
        <Link
          to="/my-games"
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Meine Spiele
        </Link>
      </div>
    </div>
  );
}
