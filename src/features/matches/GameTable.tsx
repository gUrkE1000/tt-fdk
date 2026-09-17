import { CalendarClock, CalendarDays, Pencil, RefreshCw, Share2, Trash2, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  ProgressBar,
  Table,
  type TableColumn,
} from '../../components/ui';
import { formatDateTime, formatShortDayDate, formatTime } from '../../lib/dates';
import type { TeamWithRoster } from '../teams/api';
import type { Venue } from '../venues/api';
import type { MatchRow } from './api';

export interface GameTableProps {
  matches: MatchRow[];
  teams: TeamWithRoster[];
  venues: Venue[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onEdit: (match: MatchRow) => void;
  onDelete: (match: MatchRow) => void;
  onManagePlayers: (match: MatchRow) => void;
  onShareLineup: (match: MatchRow) => void;
  onReschedule: (match: MatchRow) => void;
}

export default function GameTable({
  matches,
  teams,
  venues,
  selected,
  onSelectedChange,
  onEdit,
  onDelete,
  onManagePlayers,
  onShareLineup,
  onReschedule,
}: GameTableProps) {
  const teamOf = (id: string) => teams.find((team) => team.id === id);
  const venueOf = (id: string | null) => venues.find((venue) => venue.id === id);

  function toggle(id: string) {
    onSelectedChange(
      selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
    );
  }

  function dateCell(match: MatchRow) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900">
            {match.dtstart ? formatDateTime(match.dtstart) : '—'}
          </span>
          {match.source === 'ics' && (
            <RefreshCw
              className="h-3.5 w-3.5 text-gray-400"
              aria-label="Kommt aus dem Verbandskalender"
            />
          )}
        </div>
        {match.dtstart_override && (
          <Badge tone="warning">
            verlegt, ursprünglich {formatShortDayDate(match.dtstart_external)}{' '}
            {formatTime(match.dtstart_external)}
          </Badge>
        )}
        {!match.active && <Badge tone="removed">entfällt</Badge>}
      </div>
    );
  }

  function opponentCell(match: MatchRow) {
    const venue = venueOf(match.venue_id);
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={match.is_home ? 'primary' : 'neutral'}>
            {match.is_home ? 'Heim' : 'Auswärts'}
          </Badge>
          <span className="font-medium text-gray-900">{match.opponent || '—'}</span>
        </div>
        <p className="text-xs text-gray-500">
          {[match.league, venue?.name ?? match.location_text].filter(Boolean).join(' · ')}
        </p>
      </div>
    );
  }

  function lineupCell(match: MatchRow) {
    const required = match.required_players ?? 0;
    return (
      <div className="min-w-[8rem]">
        <p className="text-sm font-semibold tabular-nums text-gray-900">
          {`${match.confirmedCount} / ${required}`}
        </p>
        <ProgressBar value={match.confirmedCount} max={required} />
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Button size="sm" onClick={() => onManagePlayers(match)}>
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Spieler verwalten
          </Button>
          <Button size="sm" onClick={() => onShareLineup(match)}>
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Aufstellung teilen
          </Button>
          <Button size="sm" onClick={() => onReschedule(match)}>
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Spielverlegung
          </Button>
        </div>
      </div>
    );
  }

  function actions(match: MatchRow) {
    return (
      <div className="flex items-center justify-end gap-1">
        <IconButton icon={Pencil} label="Spieltermin bearbeiten" onClick={() => onEdit(match)} />
        <IconButton
          icon={Trash2}
          label="Spieltermin löschen"
          tone="danger"
          onClick={() => onDelete(match)}
        />
      </div>
    );
  }

  const columns: TableColumn<MatchRow>[] = [
    {
      key: 'select',
      header: '',
      cell: (match) => (
        <input
          type="checkbox"
          checked={selected.includes(match.id)}
          onChange={() => toggle(match.id)}
          aria-label={`${match.opponent || 'Spieltermin'} auswählen`}
          className="h-4 w-4 rounded border-gray-300"
        />
      ),
    },
    { key: 'date', header: 'Termin', cell: dateCell },
    {
      key: 'team',
      header: 'Mannschaft',
      cell: (match) => teamOf(match.team_id)?.name ?? '—',
    },
    { key: 'opponent', header: 'Gegner', cell: opponentCell },
    { key: 'lineup', header: 'Aufstellung', cell: lineupCell },
    { key: 'actions', header: 'Aktion', align: 'right', cell: actions },
  ];

  return (
    <Table
      columns={columns}
      rows={matches}
      rowKey={(match) => match.id}
      mobileCard={(match) => (
        <Card>
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">{dateCell(match)}</div>
              {actions(match)}
            </div>
            {opponentCell(match)}
            <p className="text-sm text-gray-500">{teamOf(match.team_id)?.name}</p>
            {lineupCell(match)}
          </CardBody>
        </Card>
      )}
      empty={
        <EmptyState
          icon={CalendarDays}
          title="Keine Spieltermine"
          description="Importiere den Spielplan aus myTischtennis oder lege ein Spiel von Hand an."
        />
      }
    />
  );
}
