import { ExternalLink } from 'lucide-react';
import { Badge, type BadgeTone } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatShortDayDate, formatTime, formatDate } from '../../lib/dates';
import { roleLabel, statusLabel } from '../../lib/labels';
import { highlightParts } from '../../lib/search';
import type { Enums } from '../../lib/database.types';
import { KINDS, type SearchHit } from './types';

/** Hebt die gefundenen Wortanfänge hervor. */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, index) =>
        part.hit ? (
          <mark key={index} className="rounded-sm bg-transparent font-bold text-gray-900">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

const STATUS: Record<string, [string, BadgeTone]> = {
  yes: ['Zugesagt', 'yes'],
  late: ['Komme später', 'late'],
  unclear: ['Unsicher', 'unclear'],
  no: ['Abgesagt', 'no'],
  none: ['Antwort offen', 'open'],
  open: ['Offen', 'open'],
  voted: ['Abgestimmt', 'yes'],
  closed: ['Beendet', 'neutral'],
};

/** Der Status-Badge rechts: eigene Rückmeldung, Umfrage offen, Entwurf, … */
export function hitBadge(hit: SearchHit): [string, BadgeTone] | null {
  if (hit.kind === 'news' && hit.meta.scheduled === true) return ['Geplant', 'info'];
  if (hit.kind === 'match' && hit.meta.active === false) return ['Abgesagt', 'removed'];
  if (hit.kind === 'session' && hit.meta.cancelled === true) return ['Fällt aus', 'removed'];
  if (hit.kind === 'member' && typeof hit.meta.status === 'string' && hit.meta.status !== 'active') {
    return [statusLabel(hit.meta.status as Enums<'member_status'>), 'warning'];
  }
  if (!hit.myStatus) return null;
  // Eine offene Rückmeldung an etwas Vergangenem ist keine Aufforderung mehr.
  if (hit.myStatus === 'none' && hit.startsAt && new Date(hit.startsAt) < new Date()) return null;
  return STATUS[hit.myStatus] ?? null;
}

/** Die zweite Zeile: Datum, Rolle, Ort … */
export function hitMetaLine(hit: SearchHit): string {
  const parts: string[] = [];
  if (hit.startsAt && ['match', 'session', 'event'].includes(hit.kind)) {
    const allDay = hit.kind === 'event' && hit.meta.full_day === true;
    parts.push(
      allDay
        ? formatShortDayDate(hit.startsAt)
        : `${formatShortDayDate(hit.startsAt)} ${formatTime(hit.startsAt)}`,
    );
  }
  if (hit.startsAt && ['message', 'notification'].includes(hit.kind)) {
    parts.push(formatDate(hit.startsAt));
  }
  if (hit.kind === 'member') {
    if (typeof hit.meta.role === 'string') parts.push(roleLabel(hit.meta.role as Enums<'user_role'>));
    if (typeof hit.meta.offices === 'string') parts.push(hit.meta.offices);
  }
  // Bei Trainings steht die Regel („Di 19:00 · Halle") in der Unterzeile, dahinter nur das
  // Datum des nächsten Termins — die Uhrzeit stünde sonst zweimal da.
  if (hit.subtitle) parts.push(hit.subtitle);
  if (hit.kind === 'training' && hit.startsAt) {
    parts.push(`nächster Termin ${formatShortDayDate(hit.startsAt)}`);
  }
  return parts.join(' · ');
}

export interface HitRowProps {
  hit: SearchHit;
  query: string;
  active?: boolean;
}

/** Inhalt einer Trefferzeile — ohne den umgebenden Link, den stellen Liste und Seite. */
export default function HitRow({ hit, query, active }: HitRowProps) {
  const Icon = KINDS[hit.kind].icon;
  const badge = hitBadge(hit);
  const color =
    (hit.kind === 'match' || hit.kind === 'team') && typeof hit.meta.color === 'string'
      ? hit.meta.color
      : null;

  return (
    <div className={cn('flex min-h-touch items-center gap-3 px-3 py-2', active && 'bg-primary-soft')}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600"
        aria-hidden="true"
        style={color ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-gray-800">
          <Highlight text={hit.title} query={query} />
          {hit.external && (
            <ExternalLink className="ml-1 inline h-3 w-3 text-gray-400" aria-label="öffnet Karte" />
          )}
        </span>
        {hitMetaLine(hit) && (
          <span className="block truncate text-xs text-gray-500">{hitMetaLine(hit)}</span>
        )}
      </span>

      {badge && (
        <Badge tone={badge[1]} className="shrink-0">
          {badge[0]}
        </Badge>
      )}
    </div>
  );
}
