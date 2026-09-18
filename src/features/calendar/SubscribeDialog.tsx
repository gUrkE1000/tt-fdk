import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { Button, Dialog, Input, useToast } from '../../components/ui';
import { FUNCTIONS_URL, supabase } from '../../lib/supabaseClient';

export interface SubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HOWTO: { label: string; href: string }[] = [
  {
    label: 'Google Kalender',
    href: 'https://support.google.com/calendar/answer/37100',
  },
  {
    label: 'Outlook',
    href: 'https://support.microsoft.com/de-de/office/cff1429c-5af6-41ec-a5b4-74f2c278e98c',
  },
  {
    label: 'Apple Kalender',
    href: 'https://support.apple.com/de-de/guide/calendar/icl1022/mac',
  },
];

/**
 * Das Kalender-Abo.
 *
 * Der Link ist ein Dauerausweis: Wer ihn hat, liest die zugesagten Termine — ein
 * Kalenderprogramm kann sich nicht anmelden. Deshalb steht der Knopf „Link neu erzeugen"
 * gleichberechtigt daneben und nicht in einer Ecke.
 */
export default function SubscribeDialog({ open, onOpenChange }: SubscribeDialogProps) {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    setCopied(false);
    setLoading(true);
    void supabase
      .rpc('rpc_my_calendar_token')
      .then(({ data, error }) => {
        if (error) toast(error.message, 'error');
        else setToken(data as unknown as string);
        setLoading(false);
      });
  }, [open, toast]);

  const link = token ? `${FUNCTIONS_URL}/calendar-feed?token=${token}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast('Link kopiert', 'success');
    } catch {
      toast('Kopieren hat nicht geklappt — bitte von Hand markieren', 'error');
    }
  }

  async function reset() {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpc_reset_calendar_token');
    setLoading(false);

    if (error) {
      toast(error.message, 'error');
      return;
    }

    setToken(data as unknown as string);
    setCopied(false);
    toast('Der alte Link ist jetzt wertlos', 'success');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Kalender abonnieren"
      footer={<Button onClick={() => onOpenChange(false)}>Schließen</Button>}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Kopiere diesen Link und trage ihn in deinem Kalenderprogramm als Abo ein. Dort
          erscheinen dann alle Termine, zu denen du zugesagt hast — Spiele, Trainings und
          Vereinstermine. Der Kalender aktualisiert sich etwa stündlich von selbst.
        </p>

        <div className="flex flex-wrap gap-2">
          <Input readOnly value={link} aria-label="Kalender-Link" className="min-w-[12rem] flex-1" />
          <Button onClick={() => void copy()} disabled={!link}>
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-gray-900">Anleitungen</p>
          <ul className="flex flex-wrap gap-3 text-sm">
            {HOWTO.map((entry) => (
              <li key={entry.label}>
                <a
                  className="text-primary underline"
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-sm text-gray-600">
            Wer den Link hat, sieht deine zugesagten Termine — auch ohne Anmeldung.
            Versehentlich weitergegeben? Dann erzeuge einen neuen; der alte funktioniert
            danach nicht mehr.
          </p>
          <Button className="mt-2" loading={loading} onClick={() => void reset()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Link neu erzeugen
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
