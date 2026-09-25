import { useMemo } from 'react';
import { Copy, Mail } from 'lucide-react';
import { Button, Dialog, useToast } from '../../components/ui';
import { buildShareText } from '../../lib/lineupText';
import { formatVenueAddress } from '../venues/schemas';
import type { Venue } from '../venues/api';
import type { TeamWithRoster } from '../teams/api';
import { useShareLineupByEmail, type MatchRow, type Participation, type Volunteer } from './api';

export interface ShareLineupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchRow | null;
  team: TeamWithRoster | undefined;
  venue: Venue | undefined;
  participations: Participation[];
  volunteers: Volunteer[];
  nameOf: (profileId: string) => string;
}

/**
 * Der Textblock für den Messenger.
 *
 * Im TT-Planer offenbar die meistgenutzte Funktion überhaupt — die Kommunikation findet
 * ohnehin in WhatsApp statt. Wir ergänzen zwei Dinge, die dort fehlen: die Ankunftszeit
 * und den Standard-Hinweis der Mannschaft.
 */
export default function ShareLineupDialog({
  open,
  onOpenChange,
  match,
  team,
  venue,
  participations,
  volunteers,
  nameOf,
}: ShareLineupDialogProps) {
  const { toast } = useToast();
  const shareByEmail = useShareLineupByEmail();

  const text = useMemo(() => {
    if (!match) return '';

    const confirmed = participations
      .filter((entry) => entry.response === 'yes' && !entry.removed && entry.lineup_position !== null)
      .sort((a, b) => (a.lineup_position ?? 0) - (b.lineup_position ?? 0))
      .map((entry) => nameOf(entry.profile_id));

    const drivers = volunteers
      .filter((entry) => entry.kind === 'driver')
      .map((entry) => nameOf(entry.profile_id));

    const direct = volunteers
      .filter((entry) => entry.kind === 'direct')
      .map((entry) => nameOf(entry.profile_id));

    return buildShareText({
      teamName: team?.name ?? 'Mannschaft',
      opponent: match.opponent || 'unbekannt',
      league: match.league,
      isHome: match.is_home,
      startsAt: match.dtstart ?? new Date().toISOString(),
      venue: venue ? `${venue.name}, ${formatVenueAddress(venue)}` : match.location_text || null,
      requiredPlayers: match.required_players ?? 0,
      confirmedNames: confirmed,
      driverNames: drivers,
      directNames: direct,
      arrivalMinutes: match.is_home
        ? (team?.arrival_minutes_home ?? 60)
        : (team?.arrival_minutes_away ?? 30),
      note: match.comment || (match.is_home ? team?.comment_home_games : team?.comment_away_games),
    });
  }, [match, team, venue, participations, volunteers, nameOf]);

  async function onSendEmail() {
    if (!match) return;
    try {
      const count = await shareByEmail.mutateAsync({ matchId: match.id, text });
      toast(
        count === 1
          ? 'An ein Mitglied verschickt'
          : `An ${count} Mitglieder verschickt`,
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Versand fehlgeschlagen', 'error');
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Kopiert', 'success');
    } catch {
      toast('Kopieren hat nicht geklappt — bitte den Text von Hand markieren', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Aufstellung teilen"
      description="Text zum Kopieren (zum Beispiel für Messenger oder E-Mail)."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          <Button variant="primary" onClick={() => void onCopy()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            In Zwischenablage kopieren
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <pre
          aria-label="Aufstellungstext"
          className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 font-sans text-sm text-gray-800"
        >
          {text}
        </pre>

        <Button loading={shareByEmail.isPending} onClick={() => void onSendEmail()}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Per E-Mail an die Aufstellung senden
        </Button>
      </div>
    </Dialog>
  );
}
