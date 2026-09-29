import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useOpenDetail } from '../../app/detail/useDetail';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import deLocale from '@fullcalendar/core/locales/de';
import { addMonths, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Home, Rss } from 'lucide-react';
import { Button, ErrorState, IconButton, LoadingState, Segmented } from '../../components/ui';
import { cn } from '../../lib/cn';
import { toBerlin } from '../../lib/dates';
import { useIsCompact } from '../../lib/useIsCompact';
import { useCalendarItems } from './api';
import AgendaList from './AgendaList';
import SubscribeDialog from './SubscribeDialog';
import {
  CATEGORIES,
  DEFAULT_CALENDAR_FILTERS,
  detailPath,
  type CalendarKind,
  toDisplayEvents,
  toggleKind,
  type CalendarFilters,
} from './events';

type CalendarView = 'list' | 'dayGridMonth' | 'timeGridWeek';

/**
 * Der Vereinskalender.
 *
 * Die Kategorien sind Chips zum Ein- und Ausblenden, wie im TT-Planer. Was sie zeigen,
 * rechnet `toDisplayEvents` — die Kalender-Bibliothek bekommt fertige Einträge und
 * kennt keine Regel des Vereins.
 *
 * Die Kopfleiste (Monat, Pfeile, Ansicht) ist eine eigene und nicht die von
 * FullCalendar: Die Liste ist keine FullCalendar-Ansicht mehr (siehe `AgendaList`), und
 * die Schaltflächen der Bibliothek sahen neben dem Rest der App aus wie aus einem
 * anderen Programm.
 */
export default function PlanningTab() {
  const items = useCalendarItems();
  const compact = useIsCompact();
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_CALENDAR_FILTERS);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  // Ein Termin öffnet als Blatt über dem Kalender; der Monat bleibt, wo er war.
  const openDetail = useOpenDetail();
  const calendarRef = useRef<FullCalendar>(null);

  /*
    Am Telefon ist die **Liste** die Startansicht. Ein Monatsraster mit sieben Spalten
    zeigt auf 360 Pixeln von jedem Termin einen Streifen und sonst nichts; die Liste zeigt
    Uhrzeit, Titel und Art. Die **Wochenansicht** gibt es dort nicht: Sieben Spalten mal
    vierundzwanzig Stunden sind auf dem Telefon nicht knapp, sondern unbrauchbar.
  */
  const [chosenView, setChosenView] = useState<CalendarView | null>(null);
  const view: CalendarView =
    chosenView === 'timeGridWeek' && compact ? 'list' : (chosenView ?? (compact ? 'list' : 'dayGridMonth'));

  /** Ein Tag im gezeigten Zeitraum; die Liste zeigt dessen Monat. */
  const [anchor, setAnchor] = useState(() => new Date());
  /** Die Überschrift, die FullCalendar für Monat und Woche selbst ausrechnet. */
  const [gridTitle, setGridTitle] = useState('');

  const events = useMemo(
    () => toDisplayEvents(items.data ?? [], filters),
    [items.data, filters],
  );

  const month = format(toBerlin(anchor), 'yyyy-MM');
  const title =
    view === 'list' || !gridTitle ? format(toBerlin(anchor), 'MMMM yyyy', { locale: de }) : gridTitle;

  function step(direction: -1 | 1) {
    if (view === 'list') {
      setAnchor((current) => addMonths(current, direction));
      return;
    }
    const api = calendarRef.current?.getApi();
    if (direction < 0) api?.prev();
    else api?.next();
  }

  function goToday() {
    if (view === 'list') setAnchor(new Date());
    else calendarRef.current?.getApi().today();
  }

  const views: [CalendarView, string][] = [
    ['list', 'Liste'],
    ['dayGridMonth', 'Monat'],
    ...(compact ? [] : ([['timeGridWeek', 'Woche']] as [CalendarView, string][])),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Welche Termine"
          value={filters.mineOnly}
          onChange={(mineOnly) => setFilters({ ...filters, mineOnly })}
          options={[
            [true, 'Für mich relevant'],
            [false, 'Alle Termine'],
          ]}
        />

        {/* Dieselbe Frage stellt sich hier wie unter „Meine Termine": Wie kommen die
            Termine in den eigenen Kalender? */}
        <Button size="sm" onClick={() => setSubscribeOpen(true)}>
          <Rss className="h-4 w-4" aria-hidden="true" />
          Kalender abonnieren
        </Button>
      </div>

      {/*
        Am Telefon eine Zeile zum Wischen statt zweier Zeilen voller Chips: Die Filter
        sind Nebensache, die Termine darunter die Hauptsache.
      */}
      <div
        role="group"
        aria-label="Kategorien"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {CATEGORIES.map((category) => {
          const active = filters.kinds.includes(category.kind);
          return (
            <FilterChip
              key={category.kind}
              active={active}
              onClick={() => setFilters(toggleKind(filters, category.kind))}
              tint={category.color}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2"
                style={{
                  borderColor: category.color,
                  backgroundColor: active ? category.color : 'transparent',
                }}
              />
              {category.label}
            </FilterChip>
          );
        })}

        <span aria-hidden="true" className="my-1.5 w-px shrink-0 bg-gray-200" />

        <FilterChip
          active={filters.homeOnly}
          onClick={() => setFilters({ ...filters, homeOnly: !filters.homeOnly })}
          title="Betrifft nur Spiele; alles andere bleibt sichtbar."
        >
          <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Nur Heimspiele
        </FilterChip>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="min-w-0 flex-1 truncate text-xl font-bold capitalize text-gray-900">
          {title}
        </h2>
        <div className="flex items-center">
          <Button size="sm" variant="ghost" onClick={goToday}>
            Heute
          </Button>
          <IconButton icon={ChevronLeft} label="Zurück" onClick={() => step(-1)} />
          <IconButton icon={ChevronRight} label="Weiter" onClick={() => step(1)} />
        </div>
        <Segmented
          label="Ansicht"
          value={view}
          onChange={setChosenView}
          options={views}
          className={compact ? 'w-full' : undefined}
        />
      </div>

      {items.isLoading ? (
        <LoadingState />
      ) : items.isError ? (
        <ErrorState onRetry={() => void items.refetch()} />
      ) : view === 'list' ? (
        <AgendaList key={month} events={events} month={month} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {/*
            `key` erzwingt einen Neuaufbau beim Wechsel von Ansicht oder Breite:
            FullCalendar übernimmt eine geänderte `initialView` sonst nicht. Den Tag
            bringt `initialDate` mit, so bleibt man beim Wechsel im selben Monat.
          */}
          <FullCalendar
            key={`${view}:${compact ? 'schmal' : 'breit'}`}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin]}
            locale={deLocale}
            initialView={view}
            initialDate={anchor}
            headerToolbar={false}
            datesSet={(arg) => {
              setGridTitle(arg.view.title);
              // Mitte des Zeitraums: Im Monatsraster beginnt er oft im Vormonat.
              const middle = new Date(
                (arg.view.currentStart.getTime() + arg.view.currentEnd.getTime()) / 2,
              );
              setAnchor(middle);
            }}
            // Wochennummern kosten am Telefon eine ganze Spalte für eine Zahl, die dort
            // niemand sucht.
            weekNumbers={!compact}
            weekNumberFormat={{ week: 'numeric' }}
            firstDay={1}
            height="auto"
            // Im Hochformat sonst überhohe Zeilen: das Raster war höher als der Bildschirm.
            aspectRatio={compact ? 0.9 : 1.35}
            dayMaxEvents={compact ? 2 : false}
            /*
              Ein Termin ist ein farbiger Block, kein Punkt.

              FullCalendar zeichnet Termine mit Uhrzeit im Monatsraster als Punkt, Uhrzeit
              und Titel — in dieser Reihenfolge. In einer Spalte von fünfzig Pixeln bleibt
              davon „● 20 Uhr" übrig und der Titel wird abgeschnitten. Als Block trägt der
              Eintrag die Farbe seiner Kategorie und beginnt mit dem Titel. Am Telefon fällt
              die Uhrzeit ganz weg: „Erwachsene IV" sagt mehr als „20 Uhr".
            */
            eventDisplay="block"
            displayEventTime={!compact}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventClassNames={(arg) => [
              ...(arg.event.extendedProps.cancelled === true ? ['vp-event-cancelled'] : []),
              ...(arg.event.extendedProps.kind === 'venue_blocked' && arg.event.display !== 'background'
                ? ['vp-event-blocked']
                : []),
              ...(detailPath(arg.event.extendedProps.kind as CalendarKind) ? ['cursor-pointer'] : []),
            ]}
            eventClick={(arg) => {
              const path = detailPath(
                arg.event.extendedProps.kind as CalendarKind,
                arg.event.extendedProps.targetId as string,
              );
              if (!path) return;
              arg.jsEvent.preventDefault();
              openDetail(path);
            }}
            events={events}
          />
        </div>
      )}

      <SubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />
    </div>
  );
}

/**
 * Ein Filter-Chip. Angewählt in der Farbe seiner Kategorie, aber nur als Hauch: Die
 * kräftige Farbe gehört den Terminen, nicht den Schaltflächen darüber.
 */
function FilterChip({
  active,
  onClick,
  tint,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Kategoriefarbe (CSS-Farbe oder Variable); ohne sie ist der Chip in der Hausfarbe. */
  tint?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={cn(
        // Sichtbar 36 Pixel hoch, die Trefferfläche reicht über `after` auf 44.
        'relative inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition-colors',
        "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active
          ? tint
            ? 'text-gray-900'
            : 'border-primary bg-primary-soft text-primary'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700',
      )}
      style={
        active && tint
          ? {
              borderColor: `color-mix(in srgb, ${tint} 40%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${tint} 12%, transparent)`,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
