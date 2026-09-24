import { Trash2, UserPlus } from 'lucide-react';
import { Badge, Button, IconButton, useToast } from '../../components/ui';
import type { BadgeTone } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import {
  chainFor,
  useCancelSubstituteRequest,
  type SubstituteRequest,
} from './api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'wartet',
  accepted: 'zugesagt',
  declined: 'abgesagt',
  expired: 'Frist abgelaufen',
  cancelled: 'zurückgezogen',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'open',
  accepted: 'yes',
  declined: 'no',
  expired: 'late',
  cancelled: 'removed',
};

export interface ChainStepperProps {
  matchId: string;
  requests: SubstituteRequest[];
  /** Ohne Rückruf entfällt der Knopf „Ersatz anfragen". */
  onAskSomeone?: () => void;
}

/**
 * Die Ersatzkette als Schrittleiste.
 *
 * Für den Mannschaftsführer ist das die Antwort auf die Frage „passiert eigentlich
 * gerade etwas?". Im TT-Planer ist die Kette unsichtbar: Man sieht nur das Ergebnis und
 * weiß nicht, ob noch jemand gefragt wird oder ob alle schon abgesagt haben.
 */
export default function ChainStepper({ matchId, requests, onAskSomeone }: ChainStepperProps) {
  const { toast } = useToast();
  const cancelRequest = useCancelSubstituteRequest();

  const chain = chainFor(requests, matchId);

  async function onCancel(requestId: string) {
    try {
      await cancelRequest.mutateAsync(requestId);
      toast('Anfrage zurückgezogen', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Ersatzkette</h4>
        {onAskSomeone && (
          <Button size="sm" onClick={onAskSomeone}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Ersatz anfragen
          </Button>
        )}
      </div>

      {chain.length === 0 ? (
        <p className="text-sm text-gray-500">
          Noch keine Ersatzanfrage.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {chain.map((request) => (
            <li
              key={request.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {request.rank != null && (
                    <span className="text-xs font-bold tabular-nums text-gray-400">
                      {request.rank}.
                    </span>
                  )}
                  <span className="truncate text-sm font-medium text-gray-900">
                    {request.full_name}
                  </span>
                  <Badge tone={STATUS_TONE[request.status ?? 'pending'] ?? 'neutral'}>
                    {STATUS_LABEL[request.status ?? 'pending'] ?? request.status}
                  </Badge>
                  {request.created_by === 'leader' && <Badge tone="neutral">von Hand</Badge>}
                </div>
                {request.status === 'pending' && request.expires_at && (
                  <p className="text-xs text-gray-500">
                    Frist: {formatDateTime(request.expires_at)}
                  </p>
                )}
              </div>

              {request.status === 'pending' && (
                <IconButton
                  icon={Trash2}
                  label={`Anfrage an ${request.full_name} zurückziehen`}
                  tone="danger"
                  onClick={() => void onCancel(request.id!)}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
