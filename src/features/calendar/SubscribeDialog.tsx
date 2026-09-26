import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { Button, Checkbox, Dialog, Input, useToast } from '../../components/ui';
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
 * Inhalt (Migration calendar_subscription): die Heim- und Auswärtsspiele der eigenen
 * Mannschaften und Spiele mit Anfrage, jede Hallensperre — und auf Wunsch die eigenen
 * Trainings. Der Schalter wirkt auf denselben Link; man muss nicht neu abonnieren.
 *
 * Der Link ist ein Dauerausweis: Wer ihn hat, liest diese Termine — ein
 * Kalenderprogramm kann sich nicht anmelden. Deshalb steht der Knopf „Link neu erzeugen"
 * gleichberechtigt daneben und nicht in einer Ecke.
 */
export default function SubscribeDialog({ open, onOpenChange }: SubscribeDialogProps) {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [trainings, setTrainings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    setCopied(false);
    setLoading(true);
    void supabase
      .rpc('rpc_my_calendar_subscription')
      .then(({ data, error }) => {
        if (error) {
          toast(error.message, 'error');
        } else {
          const subscription = data as unknown as { token: string; include_trainings: boolean };
          setToken(subscription.token);
          setTrainings(subscription.include_trainings === true);
        }
        setLoading(false);
      });
  }, [open, toast]);

  async function toggleTrainings(value: boolean) {
    setSaving(true);
    setTrainings(value);
    const { error } = await supabase.rpc('rpc_set_calendar_trainings', { p_include: value });
    setSaving(false);

    if (error) {
      setTrainings(!value);
      toast(error.message, 'error');
      return;
    }
    toast(
      value
        ? 'Deine Trainings kommen mit ins Abo'
        : 'Trainings sind nicht mehr im Abo',
      'success',
    );
  }

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
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            Kopiere diesen Link und trage ihn in deinem Kalenderprogramm als Abo ein. Dort
            erscheinen dann:
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>die Heim- und Auswärtsspiele deiner Mannschaften — und Spiele, zu denen du angefragt bist,</li>
            <li>jede Hallensperrung, ganztägig.</li>
          </ul>
          <p>
            Abgesagte Spiele bleiben als „fällt aus" stehen. Der Kalender aktualisiert sich
            etwa stündlich von selbst.
          </p>
        </div>

        <Checkbox
          checked={trainings}
          disabled={loading || saving}
          onCheckedChange={(value) => void toggleTrainings(value)}
          label="Auch meine Trainings abonnieren"
          hint="Offene Trainings, Trainings, denen du zugeordnet bist oder die du leitest. Gilt für denselben Link — du musst nicht neu abonnieren."
        />

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
            Wer den Link hat, sieht diese Termine — auch ohne Anmeldung.
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
