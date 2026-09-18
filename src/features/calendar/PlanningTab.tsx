import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import deLocale from '@fullcalendar/core/locales/de';
import { Checkbox } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useCalendarItems } from './api';
import {
  CATEGORIES,
  DEFAULT_CALENDAR_FILTERS,
  toDisplayEvents,
  toggleKind,
  type CalendarFilters,
} from './events';

/**
 * Der Vereinskalender.
 *
 * Die Kategorien sind Chips zum Ein- und Ausblenden, wie im TT-Planer. Was sie zeigen,
 * rechnet `toDisplayEvents` — die Kalender-Bibliothek bekommt fertige Einträge und
 * kennt keine Regel des Vereins.
 */
export default function PlanningTab() {
  const items = useCalendarItems();
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_CALENDAR_FILTERS);

  const events = useMemo(
    () => toDisplayEvents(items.data ?? [], filters),
    [items.data, filters],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((category) => {
          const active = filters.kinds.includes(category.kind);
          return (
            <button
              key={category.kind}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters(toggleKind(filters, category.kind))}
              className={cn(
                'inline-flex min-h-touch items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active ? 'border-transparent text-white' : 'border-gray-300 bg-white text-gray-500',
              )}
              style={active ? { backgroundColor: category.color } : undefined}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: active ? 'rgba(255,255,255,.8)' : category.color }}
              />
              {category.label}
            </button>
          );
        })}
      </div>

      <Checkbox
        checked={filters.homeOnly}
        onCheckedChange={(value) => setFilters({ ...filters, homeOnly: value })}
        label="Nur Heimspiele anzeigen"
        hint="Betrifft nur Spiele; alles andere bleibt sichtbar."
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          locale={deLocale}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth',
          }}
          buttonText={{
            today: 'Heute',
            month: 'Monat',
            week: 'Woche',
            list: 'Liste',
          }}
          weekNumbers
          weekNumberFormat={{ week: 'numeric' }}
          firstDay={1}
          height="auto"
          events={events}
          noEventsText="In diesem Zeitraum steht nichts an."
        />
      </div>
    </div>
  );
}
