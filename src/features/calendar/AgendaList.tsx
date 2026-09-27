import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Ban, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatTime, todayInBerlin } from '../../lib/dates';
import { agendaForMonth } from './agenda';
import { detailPath, type CalendarKind, type DisplayEvent } from './events';

const KIND_LABELS: Record<CalendarKind, string> = {
  training: 'Training',
  match: 'Spiel',
  event: 'Vereinstermin',
  key_duty: 'Schlüsseldienst',
  venue_blocked: 'Halle gesperrt',
};

export interface AgendaListProps {
  events: readonly DisplayEvent[];
  /** Der gezeigte Monat als `yyyy-MM`. */
  month: string;
}

/**
 * Die Listenansicht des Kalenders: ein Tag links als Datum, rechts seine Termine als
 * Karten.
 *
 * Statt der Listenansicht von FullCalendar, weil deren Tabelle für jeden Tag eine graue
 * Kopfzeile über die volle Breite zeichnet („28. September 2026 — Montag") und die
 * Termine darunter nur als Punkt und Titel. Auf dem Telefon war das mehr Kopfzeile als
 * Inhalt. Hier trägt jede Karte Uhrzeit, Titel und Art, und die Farbe der Kategorie
 * steht als Streifen am Rand.
 *
 * Im laufenden Monat sind die vergangenen Tage eingeklappt: Wer den Kalender öffnet,
 * will wissen, was ansteht — nicht, was vor drei Wochen war.
 */
export default function AgendaList({ events, month }: AgendaListProps) {
  const today = todayInBerlin();
  const days = useMemo(() => agendaForMonth(events, month), [events, month]);
  const [showPast, setShowPast] = useState(false);

  const pastCount = days.filter((entry) => entry.day < today).length;
  const collapsePast = today.startsWith(`${month}-`) && pastCount > 0 && !showPast;
  const visible = collapsePast ? days.filter((entry) => entry.day >= today) : days;

  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Keine Termine"
        description="In diesem Monat steht nichts an — oder die Filter blenden es aus."
      />
    );
  }

  return (
    <div className="space-y-4">
      {collapsePast && (
        <button
          type="button"
          onClick={() => setShowPast(true)}
          className={cn(
            'flex min-h-touch w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          )}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
          {pastCount === 1 ? 'Einen früheren Tag anzeigen' : `${pastCount} frühere Tage anzeigen`}
        </button>
      )}

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">
          Für den Rest des Monats steht nichts mehr an.
        </p>
      )}

      <ol className="space-y-4">
        {visible.map((entry) => {
          const date = new Date(`${entry.day}T12:00:00`);
          const isToday = entry.day === today;
          const isPast = entry.day < today;

          return (
            <li key={entry.day} className={cn('flex gap-3', isPast && 'opacity-60')}>
              <div className="w-11 shrink-0 pt-1 text-center" aria-hidden="true">
                <div
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-wide',
                    isToday ? 'text-primary' : 'text-gray-500',
                  )}
                >
                  {format(date, 'EEEEEE', { locale: de })}
                </div>
                <div
                  className={cn(
                    'mx-auto mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold tabular-nums',
                    isToday ? 'bg-primary text-white' : 'text-gray-900',
                  )}
                >
                  {format(date, 'd')}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="sr-only">
                  {format(date, 'EEEE, d. MMMM yyyy', { locale: de })}
                  {isToday && ' (heute)'}
                </h3>
                <ul className="space-y-2">
                  {entry.events.map((event) => (
                    <li key={event.id}>
                      <AgendaEntry event={event} />
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AgendaEntry({ event }: { event: DisplayEvent }) {
  const { kind, cancelled, targetId } = event.extendedProps;
  const blocked = kind === 'venue_blocked';
  const path = detailPath(kind, targetId);
  const label = KIND_LABELS[kind];
  // Warnzeichen und „(fällt aus)" sind fürs Monatsraster; hier stehen dafür ein Symbol
  // und ein Hinweis in der zweiten Zeile.
  const title = event.title.replace(/^⛔\s*/, '').replace(/\s*\(fällt aus\)$/, '');

  const meta = [
    event.allDay ? 'Ganztägig' : `${formatTime(event.start)} Uhr`,
    // „Schlüsseldienst · Schlüsseldienst: Adam P." wäre doppelt.
    title.startsWith(label) ? null : label,
  ].filter(Boolean);

  const body = (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: event.backgroundColor }}
      />
      {blocked && <Ban className="h-5 w-5 shrink-0 text-status-no" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[15px] font-semibold leading-snug',
            blocked ? 'text-status-no' : 'text-gray-900',
            cancelled && 'text-gray-500 line-through decoration-gray-400',
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
          {meta.map((part, index) => (
            <span key={part} className="inline-flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">·</span>}
              {part}
            </span>
          ))}
          {cancelled && (
            <span className="rounded-full bg-status-no-soft px-1.5 py-px font-semibold text-status-no">
              fällt aus
            </span>
          )}
        </p>
      </div>
      {path && <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />}
    </>
  );

  const classes = cn(
    'relative flex min-h-touch items-center gap-3 overflow-hidden rounded-xl border py-2.5 pl-4 pr-3 shadow-sm',
    blocked ? 'border-status-no/30 bg-status-no-soft' : 'border-gray-200 bg-white',
    cancelled && 'shadow-none',
  );

  if (!path) return <div className={classes}>{body}</div>;

  return (
    <Link
      to={path}
      className={cn(
        classes,
        'transition-colors hover:border-gray-300 hover:bg-gray-50',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      )}
    >
      {body}
    </Link>
  );
}
