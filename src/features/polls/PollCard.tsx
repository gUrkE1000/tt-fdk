import { useEffect, useState } from 'react';
import { EyeOff, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  ProgressBar,
  RichText,
  useToast,
} from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { hasRichText } from '../../lib/richText';
import {
  useRetractPollVote,
  useVotePoll,
  type PollResult,
  type PollVoter,
  type PollWithDetails,
} from './api';
import { POLL_TYPE_LABELS, isExpired, resultBars } from './schemas';

export interface PollCardProps {
  poll: PollWithDetails;
  results: PollResult[];
  voters: PollVoter[];
  profileId: string | null;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const REFUSALS: Record<string, string> = {
  expired: 'Diese Umfrage ist abgelaufen.',
  not_invited: 'Diese Umfrage ist nicht an dich gerichtet.',
  too_many: 'Du hast mehr Antworten gewählt als erlaubt.',
  gone: 'Diese Umfrage gibt es nicht mehr.',
  unknown_option: 'Bitte mindestens eine Antwort wählen.',
  mixed_polls: 'Das hat nicht geklappt.',
};

export default function PollCard({
  poll,
  results,
  voters,
  profileId,
  canManage,
  onEdit,
  onDelete,
}: PollCardProps) {
  const { toast } = useToast();
  const vote = useVotePoll();
  const retract = useRetractPollVote();

  const mine = voters
    .filter((entry) => entry.poll_id === poll.id && entry.profile_id === profileId)
    .map((entry) => entry.option_id as string);

  const [chosen, setChosen] = useState<string[]>(mine);

  useEffect(() => {
    setChosen(mine);
    // Nur bei einer Änderung der eigenen Stimme neu setzen, nicht bei jedem Rendern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.join('|')]);

  const expired = isExpired(poll);
  const bars = resultBars(results.filter((row) => row.poll_id === poll.id));
  const single = poll.max_answers === 1;

  function toggle(optionId: string) {
    setChosen((current) => {
      if (single) return current.includes(optionId) ? [] : [optionId];
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      if (current.length >= poll.max_answers) return current;
      return [...current, optionId];
    });
  }

  async function save() {
    try {
      const result =
        chosen.length === 0
          ? await retract.mutateAsync(poll.id)
          : await vote.mutateAsync(chosen);

      if (result.status === 'ok') {
        toast(chosen.length === 0 ? 'Stimme zurückgezogen' : 'Stimme gespeichert', 'success');
      } else {
        toast(REFUSALS[result.status] ?? 'Das hat nicht geklappt', 'error');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-gray-900">{poll.title}</span>
              {poll.type === 'persons' && <Badge tone="neutral">{POLL_TYPE_LABELS.persons}</Badge>}
              {expired && <Badge tone="removed">abgelaufen</Badge>}
              {poll.hide_results && (
                <Badge tone="neutral">
                  <EyeOff className="mr-1 inline h-3 w-3" aria-hidden="true" />
                  Ergebnisse verborgen
                </Badge>
              )}
            </div>
            {poll.expires_at && (
              <p className="mt-0.5 text-sm text-gray-500">
                {expired ? 'Abgelaufen am' : 'Läuft bis'} {formatDateTime(poll.expires_at)}
              </p>
            )}
          </div>

          {canManage && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="text-sm font-semibold text-primary underline"
              >
                Bearbeiten
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-sm font-semibold text-status-no underline"
              >
                Löschen
              </button>
            </div>
          )}
        </div>

        {hasRichText(poll.details_html) && <RichText html={poll.details_html} />}

        {!single && (
          <p className="text-sm text-gray-600">
            Bis zu {poll.max_answers} Antworten wählbar.
          </p>
        )}

        <ul className="space-y-2">
          {poll.options.map((option) => {
            const bar = bars.find((entry) => entry.optionId === option.id);
            const names = voters.filter((entry) => entry.option_id === option.id);

            return (
              <li key={option.id} className="rounded-xl border border-gray-200 p-3">
                <Checkbox
                  checked={chosen.includes(option.id)}
                  onCheckedChange={() => toggle(option.id)}
                  disabled={expired || !profileId}
                  label={option.text}
                />

                {bar && (
                  <div className="mt-2">
                    <ProgressBar value={bar.percent} max={100} />
                    <p className="mt-0.5 text-xs tabular-nums text-gray-500">
                      {bar.votes} {bar.votes === 1 ? 'Stimme' : 'Stimmen'}
                    </p>
                  </div>
                )}

                {/* Beim Typ „Personen" ist die Namensliste die eigentliche Antwort. */}
                {poll.type === 'persons' && names.length > 0 && (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    <span>{names.map((entry) => entry.full_name).join(', ')}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {profileId && !expired && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              loading={vote.isPending || retract.isPending}
              onClick={() => void save()}
            >
              {chosen.length === 0 ? 'Stimme zurückziehen' : 'Stimme abgeben'}
            </Button>
            {mine.length > 0 && (
              <span className="text-sm text-gray-500">Du hast schon abgestimmt.</span>
            )}
          </div>
        )}

        {poll.hide_results && bars.length === 0 && (
          <p className="text-sm text-gray-500">
            Die Ergebnisse dieser Umfrage sieht nur, wer sie führt.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
