import { CalendarClock } from 'lucide-react';
import { useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/dates';
import { useSession } from '../auth/session';
import {
  myVotes,
  pollFor,
  useReschedulePolls,
  useRescheduleVotes,
  useVoteReschedule,
} from './rescheduleApi';

export interface RescheduleVotePanelProps {
  matchId: string;
}

/**
 * Das Abstimmungsfeld auf der Spielkarte.
 *
 * Je Vorschlag zwei Knöpfe. Bewusst keine Auswahlliste und kein „mein bester Termin":
 * Die Frage ist nicht, was jemand bevorzugt, sondern wann er kann — und das lässt sich
 * nicht in eine Reihenfolge bringen.
 */
export default function RescheduleVotePanel({ matchId }: RescheduleVotePanelProps) {
  const { profile } = useSession();
  const { toast } = useToast();
  const polls = useReschedulePolls();
  const votes = useRescheduleVotes();
  const vote = useVoteReschedule();

  const poll = pollFor(polls.data ?? [], matchId);
  if (!poll || poll.status !== 'open') return null;

  const mine = myVotes(votes.data ?? [], poll.id, profile?.id ?? null);

  async function choose(optionIndex: number, available: boolean) {
    try {
      await vote.mutateAsync({ pollId: poll!.id, optionIndex, available });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <div className="rounded-xl bg-status-late-soft p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-status-late">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Dieses Spiel soll verlegt werden. Wann kannst du?
      </p>

      <ul className="space-y-2">
        {(poll.options ?? []).map((option, index) => (
          <li key={option} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-800">{formatDateTime(option)}</span>
            <div className="flex gap-1.5">
              <VoteButton
                label="Kann ich"
                active={mine[index] === true}
                tone="yes"
                onClick={() => void choose(index, true)}
              />
              <VoteButton
                label="Kann ich nicht"
                active={mine[index] === false}
                tone="no"
                onClick={() => void choose(index, false)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VoteButton({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'yes' | 'no';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-touch rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active
          ? tone === 'yes'
            ? 'border-status-yes bg-status-yes text-white'
            : 'border-status-no bg-status-no text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      {label}
    </button>
  );
}
