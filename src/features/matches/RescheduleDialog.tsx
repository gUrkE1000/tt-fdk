import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DateInput,
  Dialog,
  FormField,
  IconButton,
  TimeInput,
  useToast,
} from '../../components/ui';
import { formatDateTime, fromBerlin } from '../../lib/dates';
import type { MatchRow } from './api';
import {
  myVotes,
  pollFor,
  useApplyReschedule,
  useReschedulePolls,
  useRescheduleResults,
  useRescheduleVotes,
  useStartReschedulePoll,
} from './rescheduleApi';

interface OptionDraft {
  date: string;
  time: string;
}

export interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchRow | null;
}

/**
 * Spielverlegung als Terminumfrage.
 *
 * Der Mannschaftsführer schlägt bis zu drei Termine vor, der Kader sagt zu jedem „kann"
 * oder „kann nicht", und am Ende wählt der Mannschaftsführer. Kein Termin wird verlegt,
 * ohne dass klar ist, wer dann kann — das ist der ganze Zweck.
 */
export default function RescheduleDialog({ open, onOpenChange, match }: RescheduleDialogProps) {
  const { toast } = useToast();
  const polls = useReschedulePolls();
  const results = useRescheduleResults();
  const votes = useRescheduleVotes();
  const startPoll = useStartReschedulePoll();
  const applyPoll = useApplyReschedule();

  const [options, setOptions] = useState<OptionDraft[]>([{ date: '', time: '19:00' }]);

  useEffect(() => {
    if (open) setOptions([{ date: '', time: '19:00' }]);
  }, [open, match?.id]);

  if (!match) return null;

  const poll = pollFor(polls.data ?? [], match.id);
  const pollResults = (results.data ?? []).filter((row) => row.poll_id === poll?.id);
  const voteCount = (votes.data ?? []).filter((vote) => vote.poll_id === poll?.id).length;

  async function onStart() {
    const filled = options.filter((option) => option.date);
    if (filled.length === 0) {
      toast('Bitte mindestens einen Terminvorschlag angeben', 'error');
      return;
    }

    try {
      await startPoll.mutateAsync({
        matchId: match!.id,
        options: filled.map((option) =>
          fromBerlin(`${option.date}T${option.time}:00`).toISOString(),
        ),
      });
      toast('Umfrage gestartet', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function onApply(optionIndex: number) {
    if (!poll) return;
    try {
      await applyPoll.mutateAsync({ pollId: poll.id, optionIndex });
      toast('Der neue Termin ist gesetzt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Spielverlegung"
      description={`Bisher: ${match.dtstart ? formatDateTime(match.dtstart) : ''}`}
      footer={<Button onClick={() => onOpenChange(false)}>Schließen</Button>}
    >
      {poll && poll.status !== 'applied' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Die Umfrage läuft. {voteCount === 0 ? 'Noch niemand' : `${voteCount} Stimmen`} hat
            abgestimmt.
          </p>

          <ul className="space-y-2">
            {pollResults.map((row) => (
              <li
                key={row.option_index}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-3"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {row.option_at ? formatDateTime(row.option_at) : '—'}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <Badge tone="yes">{row.available_count ?? 0} können</Badge>
                    <Badge tone="no">{row.unavailable_count ?? 0} können nicht</Badge>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={applyPoll.isPending}
                  onClick={() => void onApply(row.option_index ?? 0)}
                >
                  Diesen Termin nehmen
                </Button>
              </li>
            ))}
          </ul>

          <p className="text-xs text-gray-500">
            Der gewählte Termin gilt zunächst nur bei uns. Der Verband weiß noch nichts davon;
            bis click-TT nachzieht, steht am Spiel „verlegt".
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Schlage bis zu drei Termine vor. Der Kader sagt zu jedem, ob er kann.
          </p>

          {options.map((option, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <FormField label={`Vorschlag ${index + 1}`} className="min-w-[9rem] flex-1">
                {(p) => (
                  <DateInput
                    {...p}
                    value={option.date}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, date: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                )}
              </FormField>
              <FormField label="Uhrzeit" className="w-28">
                {(p) => (
                  <TimeInput
                    {...p}
                    value={option.time}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, time: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                )}
              </FormField>
              {options.length > 1 && (
                <IconButton
                  icon={Trash2}
                  label={`Vorschlag ${index + 1} entfernen`}
                  tone="danger"
                  onClick={() =>
                    setOptions((current) => current.filter((_, i) => i !== index))
                  }
                />
              )}
            </div>
          ))}

          {options.length < 3 && (
            <Button
              onClick={() => setOptions((current) => [...current, { date: '', time: '19:00' }])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Weiterer Vorschlag
            </Button>
          )}

          <Button variant="primary" loading={startPoll.isPending} onClick={() => void onStart()}>
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Umfrage jetzt starten
          </Button>
        </div>
      )}
    </Dialog>
  );
}

export { myVotes };
