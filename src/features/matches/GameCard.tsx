import { AlertTriangle, MapPin, Share2, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  ProgressBar,
} from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { formatVenueAddress } from '../venues/schemas';
import type { Venue } from '../venues/api';
import type { TeamWithRoster } from '../teams/api';
import type { MatchRow, Participation, Volunteer } from './api';
import ResponseButtons from './ResponseButtons';
import VolunteerToggles from './VolunteerToggles';

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

  const blockedUntil = team?.block_participants_after ?? null;
  const blocked = blockedUntil !== null && new Date(blockedUntil) < new Date();

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

        {(venue || match.location_text) && (
          <p className="flex items-start gap-1.5 text-sm text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span>
              {venue ? `${venue.name}, ${formatVenueAddress(venue)}` : match.location_text}
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

        {profileId && (
          <ResponseButtons
            matchId={match.id}
            participation={mine}
            disabled={blocked || !match.active}
            disabledReason={
              !match.active
                ? 'Dieses Spiel entfällt.'
                : blocked
                  ? 'Die Rückmeldung ist für diese Mannschaft geschlossen. Wende dich an deinen Mannschaftsführer.'
                  : undefined
            }
          />
        )}

        {profileId && (
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
          </div>
        )}
      </CardBody>
    </Card>
  );
}
