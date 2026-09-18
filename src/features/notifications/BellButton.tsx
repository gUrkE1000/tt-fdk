import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useSession } from '../auth/session';
import { disablePush, enablePush, readPushState, type PushState } from './push';

/**
 * Die Glocke in der Kopfzeile (Aufgabe 8.3).
 *
 * Drei Zustände, wie im TT-Planer (Bestandsaufnahme B): **aktivieren** blau, **aktiv**
 * grün, **inaktiv** rot. Die Knopf-Kennungen sind dieselben — wer den TT-Planer kennt
 * oder eine Anleitung dazu liest, findet sich hier wieder.
 *
 * Der rote Zustand ist bewusst nicht klickbar: Eine abgelehnte Erlaubnis kann keine
 * Website zurückholen, das geht nur in den Browsereinstellungen. Ein Knopf, der nichts
 * täte, wäre eine Lüge; der Hinweistext sagt stattdessen, wo es geht.
 */

const STYLES: Record<Exclude<PushState, 'unsupported'>, string> = {
  available: 'bg-primary-soft text-primary hover:bg-primary-border',
  enabled: 'bg-status-yes-soft text-status-yes',
  denied: 'bg-status-no-soft text-status-no',
};

const TITLES: Record<Exclude<PushState, 'unsupported'>, string> = {
  available: 'aktivieren',
  enabled: 'aktiv',
  denied: 'inaktiv',
};

const IDS: Record<Exclude<PushState, 'unsupported'>, string> = {
  available: 'enableNotificationsButton',
  enabled: 'enabledNotificationsButton',
  denied: 'deniedNotificationsButton',
};

export default function BellButton() {
  const { profile } = useSession();
  const { toast } = useToast();
  const [state, setState] = useState<PushState>('unsupported');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void readPushState().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'unsupported' || !profile?.id) return null;

  const Icon = state === 'enabled' ? BellRing : state === 'denied' ? BellOff : Bell;
  const title = TITLES[state];

  async function toggle() {
    if (state === 'denied' || busy) {
      if (state === 'denied') {
        toast(
          'Mitteilungen sind für diese Seite blockiert. Das lässt sich nur in den Einstellungen des Browsers ändern.',
          'error',
        );
      }
      return;
    }

    setBusy(true);
    try {
      if (state === 'enabled') {
        setState(await disablePush());
        toast('Mitteilungen sind aus', 'success');
      } else {
        const next = await enablePush(profile!.id);
        setState(next);
        if (next === 'enabled') toast('Mitteilungen sind an', 'success');
        else if (next === 'denied') toast('Du hast Mitteilungen abgelehnt', 'error');
      }
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Das hat nicht geklappt',
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      id={IDS[state]}
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={state === 'enabled'}
      aria-label={`Mitteilungen ${title}`}
      title={`Mitteilungen ${title}`}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-60',
        STYLES[state],
        state === 'denied' && 'cursor-not-allowed',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
