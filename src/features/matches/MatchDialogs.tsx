import type { ComponentProps } from 'react';
import type { TeamWithRoster } from '../teams/api';
import type { Venue } from '../venues/api';
import type { MatchRow, Participation, Volunteer } from './api';
import ManagePlayersDialog from './ManagePlayersDialog';
import RescheduleDialog from './RescheduleDialog';
import ShareLineupDialog from './ShareLineupDialog';

export type MatchDialogKind = 'manage' | 'share' | 'reschedule';

export interface OpenMatchDialog {
  kind: MatchDialogKind;
  match: MatchRow;
}

export interface MatchDialogsProps {
  open: OpenMatchDialog | null;
  onClose: () => void;
  teams: TeamWithRoster[];
  venues: Venue[];
  participations: Participation[];
  volunteers: Volunteer[];
  members: ComponentProps<typeof ManagePlayersDialog>['members'];
  nameOf: (profileId: string) => string;
}

/**
 * Die drei Dialoge hinter den Knöpfen des Mannschaftsführers an der Spielkarte.
 *
 * Eine Stelle für alle Listen mit Spielkarten (Spieltermine, Meine Spiele, Übersicht,
 * Mein Verein). Vorher schloss nur „Spieltermine" alle drei an; anderswo zeigte die
 * Karte „Spieler verwalten" und „Aufstellung teilen", und ein Tipp darauf tat nichts.
 */
export default function MatchDialogs({
  open,
  onClose,
  teams,
  venues,
  participations,
  volunteers,
  members,
  nameOf,
}: MatchDialogsProps) {
  const match = open?.match ?? null;
  const team = teams.find((entry) => entry.id === match?.team_id);
  const close = (next: boolean) => {
    if (!next) onClose();
  };

  return (
    <>
      <ManagePlayersDialog
        open={open?.kind === 'manage'}
        onOpenChange={close}
        match={open?.kind === 'manage' ? match : null}
        team={team}
        members={members}
      />

      <ShareLineupDialog
        open={open?.kind === 'share'}
        onOpenChange={close}
        match={open?.kind === 'share' ? match : null}
        team={team}
        venue={venues.find((venue) => venue.id === match?.venue_id)}
        participations={participations.filter((entry) => entry.match_id === match?.id)}
        volunteers={volunteers.filter((entry) => entry.match_id === match?.id)}
        nameOf={nameOf}
      />

      <RescheduleDialog
        open={open?.kind === 'reschedule'}
        onOpenChange={close}
        match={open?.kind === 'reschedule' ? match : null}
      />
    </>
  );
}
