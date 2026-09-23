import { useState } from 'react';
import { Check, HelpCircle, MessageSquare, X } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { Button, Textarea, useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import type { Enums } from '../../lib/database.types';
import { useSetResponse, type Participation } from './api';

export interface ResponseButtonsProps {
  matchId: string;
  /** Die eigene Zeile, falls es schon eine gibt. */
  participation: Participation | null;
  disabled?: boolean;
  disabledReason?: string;
}

const CHOICES: {
  value: Enums<'participation_response'>;
  label: string;
  icon: typeof Check;
  active: string;
}[] = [
  { value: 'yes', label: 'Zusage', icon: Check, active: 'bg-status-yes text-white border-status-yes' },
  {
    value: 'unclear',
    label: 'Unsicher',
    icon: HelpCircle,
    active: 'bg-status-unclear text-white border-status-unclear',
  },
  { value: 'no', label: 'Absage', icon: X, active: 'bg-status-no text-white border-status-no' },
];

/**
 * Die eigene Rückmeldung zu einem Spiel.
 *
 * Drei Knöpfe statt einer Auswahlliste: das ist die häufigste Handlung der Anwendung und
 * soll auf dem Smartphone ein Tippen kosten, nicht drei.
 */
export default function ResponseButtons({
  matchId,
  participation,
  disabled,
  disabledReason,
}: ResponseButtonsProps) {
  const { toast } = useToast();
  const setResponse = useSetResponse();
  const [comment, setComment] = useState(participation?.comment ?? '');
  const [commentOpen, setCommentOpen] = useState(false);

  const current = participation?.response ?? 'none';

  async function choose(value: Enums<'participation_response'>) {
    try {
      await setResponse.mutateAsync({ matchId, response: value, comment });
      toast(
        value === 'yes' ? 'Zusage gespeichert' : value === 'no' ? 'Absage gespeichert' : 'Gespeichert',
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function saveComment() {
    // Ohne Antwort gibt es nichts, woran die Bemerkung hängen könnte. Früher wurde
    // daraus stillschweigend „Unsicher" — jetzt wartet sie auf den nächsten Knopfdruck,
    // der sie mitschickt.
    if (current === 'none') {
      setCommentOpen(false);
      return;
    }

    try {
      await setResponse.mutateAsync({
        matchId,
        response: current,
        comment,
      });
      setCommentOpen(false);
      toast('Bemerkung gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {CHOICES.map((choice) => {
          const isActive = current === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              disabled={disabled || setResponse.isPending}
              aria-pressed={isActive}
              onClick={() => void choose(choice.value)}
              className={cn(
                'inline-flex min-h-touch items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isActive ? choice.active : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              <choice.icon className="h-4 w-4" aria-hidden="true" />
              {choice.label}
            </button>
          );
        })}

        <Popover.Root open={commentOpen} onOpenChange={setCommentOpen}>
          <Popover.Trigger
            disabled={disabled}
            aria-label="Bemerkung zur Rückmeldung"
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="z-50 w-72 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg"
            >
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Bemerkung
              </label>
              <Textarea
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Komme etwas später"
              />
              {current === 'none' && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Wähle danach Zusage, Unsicher oder Absage — die Bemerkung wird mitgespeichert.
                </p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" onClick={() => setCommentOpen(false)}>
                  Abbrechen
                </Button>
                <Button size="sm" variant="primary" onClick={() => void saveComment()}>
                  {current === 'none' ? 'Übernehmen' : 'Speichern'}
                </Button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {disabled && disabledReason && <p className="text-xs text-gray-500">{disabledReason}</p>}

      {participation?.comment && !disabled && (
        <p className="text-xs text-gray-500">Deine Bemerkung: {participation.comment}</p>
      )}
    </div>
  );
}
