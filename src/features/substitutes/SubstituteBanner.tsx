import { Check, HelpCircle, X } from 'lucide-react';
import { Button, Card, CardBody, useToast } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { useSession } from '../auth/session';
import {
  pendingForMe,
  useAnswerSubstituteRequest,
  useSubstituteRequests,
  type SubstituteRequest,
} from './api';

export interface SubstituteBannerProps {
  /** Beschreibung des Spiels je Anfrage; kommt von der Seite, die die Spiele ohnehin lädt. */
  describe: (request: SubstituteRequest) => string;
}

/**
 * „Du wurdest als Ersatz angefragt."
 *
 * Oben auf der Startseite und unter „Meine Spiele", weil eine Ersatzanfrage die
 * dringendste Sache ist, die jemand in dieser Anwendung vorfinden kann: Sie hat eine
 * Frist, und läuft sie ab, rückt die Kette weiter.
 */
export default function SubstituteBanner({ describe }: SubstituteBannerProps) {
  const { profile } = useSession();
  const { toast } = useToast();
  const requests = useSubstituteRequests();
  const answer = useAnswerSubstituteRequest();

  const mine = pendingForMe(requests.data ?? [], profile?.id ?? null);

  if (mine.length === 0) return null;

  async function reply(requestId: string, value: 'yes' | 'no') {
    try {
      const status = await answer.mutateAsync({ requestId, answer: value });

      if (status === 'ok') {
        toast(value === 'yes' ? 'Danke, du bist dabei' : 'Absage gespeichert', 'success');
      } else if (status === 'expired') {
        toast('Die Frist für diese Anfrage ist abgelaufen', 'error');
      } else if (status === 'stale') {
        toast('Der Termin hat sich geändert — die Anfrage gilt nicht mehr', 'error');
      } else {
        toast('Diese Anfrage wurde schon beantwortet', 'error');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <div className="mb-4 space-y-2">
      {mine.map((request) => (
        <Card key={request.id} className="border-status-late">
          <CardBody className="space-y-2">
            <div className="flex items-start gap-2">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-late" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">Kannst du Ersatz spielen?</p>
                <p className="text-sm text-gray-700">{describe(request)}</p>
                {request.expires_at && (
                  <p className="text-xs text-gray-500">
                    Bitte antworte bis {formatDateTime(request.expires_at)}.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={answer.isPending}
                onClick={() => void reply(request.id!, 'yes')}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Ja, ich spiele
              </Button>
              <Button
                disabled={answer.isPending}
                onClick={() => void reply(request.id!, 'no')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Nein, geht nicht
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
