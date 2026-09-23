import { AlertTriangle, CalendarClock, KeyRound, MapPin, Navigation, Share2, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  ProgressBar,
} from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { isFinished } from './filters';
import { mapsUrl } from '../../lib/maps';
import { formatVenueAddress } from '../venues/schemas';
import type { Venue } from '../venues/api';
import type { TeamWithRoster } from '../teams/api';
import type { MatchRow, Participation, Volunteer } from './api';
import ResponseButtons from './ResponseButtons';
import VolunteerToggles from './VolunteerToggles';
import RescheduleVotePanel from './RescheduleVotePanel';
import MessagesPanel from '../messages/MessagesPanel';
import { groupResponses } from './responseGroups';

export interface GameCardProps {
  match: MatchRow;
  team: TeamWithRoster | undefined;
  venue: Venue | undefined;
  participations: Participation[];
  volunteers: Volunteer[];
  /** Namen zu den Profil-IDs, für die Avatare der Aufstellung. */
  nameOf: (profileId: string) => string;
  profileId: string | null;
  /** Zeigt die Leiste des Mannschaftsführers. */
  canManage?: boolean;
  onManagePlayers?: () => void;
  onShareLineup?: () => void;
  onReschedule?: () => void;
}

export default function GameCard({
  match,
  team,
  venue,
  participations,
  volunteers,
  nameOf,
  profileId,
  canManage,
  onManagePlayers,
  onShareLineup,
  onReschedule,
}: GameCardProps) {
  const mine = participations.find((entry) => entry.profile_id === profileId) ?? null;

  const lineup = participations
    .filter((entry) => entry.lineup_position !== null && entry.response === 'yes' && !entry.removed)
    .sort((a, b) => (a.lineup_position ?? 0) - (b.lineup_position ?? 0));

  const required = match.required_players ?? 0;

  // Der Termin hat sich geändert, nachdem diese Person geantwortet hat. Ihre Zusage gilt
  // damit nicht mehr — und das muss sie sehen, nicht nur die Datenbank wissen.
  const stale =
    mine != null &&
    mine.response !== 'none' &&
    (mine.version_responded ?? 0) < (match.version ?? 1);

  const address = venue ? `${venue.name}, ${formatVenueAddress(venue)}` : match.location_text;
  const route = mapsUrl(venue ? formatVenueAddress(venue) : match.location_text);

  const groups = groupResponses(match, participations, nameOf);

  // Code und PIN für den Spielbericht in nuScore: nur für die, die am Spiel beteiligt
  // sind oder es führen — für alle anderen ist das bloß ein Zugangscode.
  const showNuscore =
    (mine !== null || canManage) && Boolean(match.nuscore_code || match.nuscore_pin);

  const blockedUntil = team?.block_participants_after ?? null;
  const blocked = blockedUntil !== null && new Date(blockedUntil) < new Date();
  const finished = isFinished(match);

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-gray-900">
                {match.dtstart ? formatDateTime(match.dtstart) : '—'}
              </span>
              <Badge tone={match.is_home ? 'primary' : 'neutral'}>
                {match.is_home ? 'Heim' : 'Auswärts'}
              </Badge>
              {!match.active && <Badge tone="removed">entfällt</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-gray-700">
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{ backgroundColor: team?.color ?? '#999' }}
                aria-hidden="true"
              />
              {team?.name ?? 'Mannschaft'} gegen {match.opponent || 'unbekannt'}
              {match.league && ` · ${match.league}`}
            </p>
          </div>
        </div>

        {address && (
          <p className="flex flex-wrap items-start gap-x-1.5 text-sm text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">{address}</span>
            {route && (
              <a
                href={route}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                Route
              </a>
            )}
          </p>
        )}

        {showNuscore && (
          <p className="flex items-start gap-1.5 text-sm text-gray-600">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span>
              nuScore
              {match.nuscore_code && (
                <>
                  {' '}· Code <span className="font-mono font-semibold text-gray-900">{match.nuscore_code}</span>
                </>
              )}
              {match.nuscore_pin && (
                <>
                  {' '}· PIN <span className="font-mono font-semibold text-gray-900">{match.nuscore_pin}</span>
                </>
              )}
            </span>
          </p>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-gray-900">
              {`${lineup.length} / ${required} Spieler besetzt`}
            </span>
          </div>
          <ProgressBar value={lineup.length} max={required} />
          {lineup.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {lineup.map((entry) => (
                <Avatar key={entry.profile_id} size="sm" name={nameOf(entry.profile_id)} />
              ))}
            </div>
          )}

          {participations.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer select-none text-gray-600 hover:text-gray-900">
                Rückmeldungen: {groups.yes.length} zu · {groups.unclear.length} unsicher ·{' '}
                {groups.no.length} ab · {groups.open.length} offen
              </summary>
              <dl className="mt-1.5 space-y-1">
                {(
                  [
                    ['Zusage', groups.yes, 'text-status-yes'],
                    ['Unsicher', groups.unclear, 'text-status-unclear'],
                    ['Absage', groups.no, 'text-status-no'],
                    ['Noch offen', groups.open, 'text-gray-500'],
                  ] as const
                )
                  .filter(([, names]) => names.length > 0)
                  .map(([label, names, tone]) => (
                    <div key={label} className="flex flex-wrap gap-x-1.5">
                      <dt className={`font-semibold ${tone}`}>{label}:</dt>
                      <dd className="text-gray-700">{names.join(', ')}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          )}
        </div>

        {stale && (
          <p className="flex items-start gap-1.5 rounded-xl bg-status-late-soft p-2.5 text-sm text-status-late">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Der Termin hat sich geändert, seit du geantwortet hast. Bitte melde dich erneut
              zurück.
            </span>
          </p>
        )}

        <RescheduleVotePanel matchId={match.id} />

        {profileId && (
          <ResponseButtons
            matchId={match.id}
            participation={mine}
            disabled={blocked || !match.active || finished}
            disabledReason={
              !match.active
                ? 'Dieses Spiel entfällt.'
                : finished
                  ? 'Dieses Spiel ist vorbei.'
                  : blocked
                  ? 'Die Rückmeldung ist für diese Mannschaft geschlossen. Wende dich an deinen Mannschaftsführer.'
                  : undefined
            }
          />
        )}

        {profileId && !finished && (
          <VolunteerToggles
            matchId={match.id}
            profileId={profileId}
            volunteers={volunteers}
            hidden={team?.hide_drivers_catering ?? false}
          />
        )}

        {match.comment && <p className="text-sm text-gray-600">{match.comment}</p>}

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <Button size="sm" onClick={onManagePlayers}>
              <Users className="h-4 w-4" aria-hidden="true" />
              Spieler verwalten
            </Button>
            <Button size="sm" onClick={onShareLineup}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Aufstellung teilen
            </Button>
            <Button size="sm" onClick={onReschedule}>
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Spielverlegung
            </Button>
          </div>
        )}
        <MessagesPanel type="match" objectId={match.id} />

      </CardBody>
    </Card>
  );
}
