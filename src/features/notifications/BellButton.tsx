import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, RefreshCw } from 'lucide-react';
import { Button, Dialog, useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import { detectPlatform, isInstalled } from '../../lib/pwa';
import { useSession } from '../auth/session';
import { blockedHelp, disablePush, enablePush, readPushState, type PushState } from './push';

/**
 * Die Glocke in der Kopfzeile (Aufgabe 8.3).
 *
 * Drei Zustände, wie im TT-Planer (Bestandsaufnahme B): **aktivieren** blau, **aktiv**
 * grün, **inaktiv** rot. Die Knopf-Kennungen sind dieselben — wer den TT-Planer kennt
 * oder eine Anleitung dazu liest, findet sich hier wieder.
 *
 * Eine abgelehnte Erlaubnis kann keine Website zurückholen, das geht nur in den
 * Einstellungen. Der rote Knopf erklärt deshalb, wo — passend zu Gerät und dazu, ob die
 * App installiert ist — und prüft beim Zurückkehren in die App von selbst, ob die
 * Sperre inzwischen aufgehoben ist. Vorher las die Glocke den Zustand nur einmal beim
 * Start und blieb rot, auch wenn die Erlaubnis längst erteilt war.
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
  const [helpOpen, setHelpOpen] = useState(false);

  const refresh = useCallback(async () => {
    const next = await readPushState();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    const update = () => {
      void readPushState().then((next) => {
        if (active) setState(next);
      });
    };
    update();

    // Wer die Erlaubnis in den Einstellungen ändert, verlässt dafür die App. Beim
    // Zurückkommen neu lesen — und dort, wo der Browser es meldet, sofort.
    const onVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', onVisible);

    let status: PermissionStatus | null = null;
    void navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((result) => {
        if (!active) return;
        status = result;
        status.addEventListener('change', update);
      })
      .catch(() => {});

    return () => {
      active = false;
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', onVisible);
      status?.removeEventListener('change', update);
    };
  }, []);

  if (state === 'unsupported' || !profile?.id) return null;

  const Icon = state === 'enabled' ? BellRing : state === 'denied' ? BellOff : Bell;
  const title = TITLES[state];

  async function enable() {
    const next = await enablePush(profile!.id);
    setState(next);
    if (next === 'enabled') {
      setHelpOpen(false);
      toast('Mitteilungen sind an', 'success');
    }
    return next;
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (state === 'enabled') {
        setState(await disablePush());
        toast('Mitteilungen sind aus', 'success');
        return;
      }

      // Rot heißt: beim letzten Blick gesperrt. Erst nachsehen, ob das noch stimmt.
      const current = state === 'denied' ? await refresh() : state;
      if (current === 'denied') {
        setHelpOpen(true);
        return;
      }

      const next = await enable();
      if (next === 'denied') setHelpOpen(true);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    setBusy(true);
    try {
      const current = await refresh();
      if (current === 'denied') {
        toast('Mitteilungen sind noch blockiert', 'error');
      } else if (current === 'available') {
        await enable();
      } else {
        setHelpOpen(false);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    } finally {
      setBusy(false);
    }
  }

  const help = blockedHelp(detectPlatform(navigator.userAgent), isInstalled());

  return (
    <>
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
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>

      <Dialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title="Mitteilungen sind blockiert"
        description="Das Gerät lässt für diese App gerade keine Mitteilungen zu. Freigeben lässt es sich nur in den Einstellungen."
        footer={
          <>
            <Button onClick={() => setHelpOpen(false)}>Schließen</Button>
            <Button variant="primary" disabled={busy} onClick={() => void recheck()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Erneut prüfen
            </Button>
          </>
        }
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          {help.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          Danach hierher zurückkehren — die Glocke prüft es von selbst oder mit „Erneut
          prüfen".
        </p>
      </Dialog>
    </>
  );
}
