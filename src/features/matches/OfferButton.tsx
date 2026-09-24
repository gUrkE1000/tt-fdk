import { Hand } from 'lucide-react';
import { Button, useToast } from '../../components/ui';
import { useMatchOffers, useOfferMatch, useWithdrawOffer } from './api';

export interface OfferButtonProps {
  matchId: string;
  profileId: string;
  /** Wer das Spiel verwaltet, fragt sich selbst an, statt sich zu melden. */
  canManage?: boolean;
  disabled?: boolean;
}

/**
 * Für die, die zur Mannschaft gehören, aber für dieses Spiel nicht angefragt sind:
 * „Ich hätte Zeit" meldet dem Mannschaftsführer, dass man einspringen könnte. Zusagen
 * kann nur, wer angefragt ist.
 */
export default function OfferButton({ matchId, profileId, canManage, disabled }: OfferButtonProps) {
  const { toast } = useToast();
  const offers = useMatchOffers();
  const offer = useOfferMatch();
  const withdraw = useWithdrawOffer();

  if (canManage) {
    return (
      <p className="text-sm text-gray-600">
        Du bist für dieses Spiel nicht angefragt. In „Spieler verwalten" kannst du dich selbst
        anfragen oder aufstellen.
      </p>
    );
  }

  const offered = (offers.data ?? []).some(
    (entry) => entry.match_id === matchId && entry.profile_id === profileId,
  );

  async function onOffer() {
    try {
      await offer.mutateAsync({ matchId });
      toast('Der Mannschaftsführer weiß jetzt, dass du Zeit hättest', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function onWithdraw() {
    try {
      await withdraw.mutateAsync({ matchId });
      toast('Meldung zurückgezogen', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  if (offered) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-gray-700">
          Du hast dich als verfügbar gemeldet. Der Mannschaftsführer entscheidet.
        </p>
        <Button
          size="sm"
          disabled={disabled || withdraw.isPending}
          onClick={() => void onWithdraw()}
        >
          Zurückziehen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-gray-600">Du bist für dieses Spiel nicht angefragt.</p>
      {!disabled && (
        <Button size="sm" disabled={offer.isPending} onClick={() => void onOffer()}>
          <Hand className="h-4 w-4" aria-hidden="true" />
          Ich hätte Zeit
        </Button>
      )}
    </div>
  );
}
