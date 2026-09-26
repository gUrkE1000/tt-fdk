import { useEffect, useState } from 'react';
import { CalendarPlus, Check, Copy, RefreshCw } from 'lucide-react';
import { Button, buttonClasses, Checkbox, Dialog, Input, useToast } from '../../components/ui';
import { FUNCTIONS_URL, supabase } from '../../lib/supabaseClient';

export interface SubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface CalendarGuide {
  label: string;
  steps: string[];
  /** Offizielle Hilfeseite, falls es eine gibt. */
  href?: string;
}

/**
 * Schritt für Schritt je Kalender. Der Samsung Kalender kann einen Abo-Link nicht
 * selbst einlesen — der Weg führt über ein Google-Konto, das auf dem Handy
 * eingerichtet ist.
 */
export const GUIDES: CalendarGuide[] = [
  {
    label: 'iPhone / iPad',
    steps: [
      'Tippe oben auf „In Kalender-App öffnen“ — oder:',
      'Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → „Kalenderabo hinzufügen“.',
      'Den kopierten Link einfügen, „Weiter“ und „Sichern“.',
    ],
    href: 'https://support.apple.com/de-de/102301',
  },
  {
    label: 'Samsung Kalender',
    steps: [
      'Der Samsung Kalender kann den Link nicht selbst abonnieren — das geht über Google.',
      'Am Computer calendar.google.com öffnen, mit dem Google-Konto, das auch auf dem Handy eingerichtet ist.',
      'Links bei „Weitere Kalender“ auf + → „Per URL“ → Link einfügen → „Kalender hinzufügen“.',
      'Am Handy: Einstellungen → Konten und Sicherung → Konten verwalten → dein Google-Konto → Konto synchronisieren → „Kalender“ einschalten.',
      'Im Samsung Kalender: Menü (☰) → Kalender verwalten → unter dem Google-Konto den neuen Kalender einschalten.',
      'Taucht er nicht auf: in der Google-Kalender-App → Einstellungen → den Kalender antippen → „Synchronisieren“ einschalten.',
    ],
  },
  {
    label: 'Google Kalender / Android',
    steps: [
      'Am Computer calendar.google.com öffnen (in der Handy-App geht das Abonnieren nicht).',
      'Links bei „Weitere Kalender“ auf + → „Per URL“ → Link einfügen → „Kalender hinzufügen“.',
      'Der Kalender erscheint danach auch in der Handy-App.',
    ],
    href: 'https://support.google.com/calendar/answer/37100',
  },
  {
    label: 'Outlook',
    steps: [
      'Im Kalender: „Kalender hinzufügen“ → „Aus dem Internet abonnieren“.',
      'Den Link einfügen, einen Namen vergeben und „Importieren“.',
    ],
    href: 'https://support.microsoft.com/de-de/office/cff1429c-5af6-41ec-a5b4-74f2c278e98c',
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
  // webcal:// öffnet auf iPhone, iPad und Mac direkt den Abo-Dialog der Kalender-App.
  const webcal = link.replace(/^https?:\/\//, 'webcal://');

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
            Abgesagte Spiele bleiben als „fällt aus" stehen. Änderungen kommen von selbst
            nach — wie schnell, bestimmt dein Kalender: Apple und Outlook etwa stündlich,
            Google (und damit Samsung) oft erst nach einigen Stunden.
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
          {link && (
            <a className={buttonClasses({ variant: 'ghost' })} href={webcal}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              In Kalender-App öffnen
            </a>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-gray-900">Anleitungen</p>
          <div className="space-y-1.5">
            {GUIDES.map((guide) => (
              <details key={guide.label} className="rounded-xl border border-gray-200 px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                  {guide.label}
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {guide.href && (
                  <a
                    className="mt-2 inline-block text-sm text-primary underline"
                    href={guide.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Offizielle Anleitung
                  </a>
                )}
              </details>
            ))}
          </div>
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
