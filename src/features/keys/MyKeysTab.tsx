import { useState } from 'react';
import { KeyRound, MapPin, Send } from 'lucide-react';
import { Badge, Button, Card, CardBody, EmptyState } from '../../components/ui';
import { useSession } from '../auth/session';
import { useKeys, type KeyRow } from './api';
import { holderText } from './schemas';
import HandoverDialog from './HandoverDialog';

/**
 * Reiter „Schlüssel" der Übersicht (Aufgabe 9.1, Bestandsaufnahme A).
 *
 * „Deine Schlüssel" heißt: die, die gerade bei mir liegen, und die, für die ich
 * geradestehe. Beides gehört hierher — der Verantwortliche muss sehen, wo sein
 * Schlüssel steckt, ohne die Verwaltung zu öffnen.
 */
export default function MyKeysTab() {
  const { profile } = useSession();
  const keys = useKeys();
  const [handing, setHanding] = useState<KeyRow | null>(null);

  const profileId = profile?.id ?? null;

  const mine = (keys.data ?? []).filter(
    (entry) =>
      entry.active !== false &&
      (entry.holder_id === profileId || entry.responsible_id === profileId),
  );

  if (mine.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Du hast keinen Schlüssel"
        description="Sobald dir jemand einen Hallenschlüssel übergibt, steht er hier — mitsamt der Möglichkeit, ihn weiterzugeben."
      />
    );
  }

  return (
    <div className="space-y-3">
      {mine.map((entry) => {
        const holding = entry.holder_id === profileId;

        return (
          <Card key={entry.id ?? ''}>
            <CardBody className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <span className="font-semibold text-gray-900">{entry.name}</span>
                {holding ? (
                  <Badge tone="yes">bei dir</Badge>
                ) : (
                  <Badge tone="neutral">du bist verantwortlich</Badge>
                )}
                {entry.no_forwarding && <Badge tone="no">keine Weitergabe</Badge>}
              </div>

              {entry.venue_name && (
                <p className="flex items-start gap-1.5 text-sm text-gray-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span>{entry.venue_name}</span>
                </p>
              )}

              {!holding && (
                <p className="text-sm text-gray-600">Aktuell bei: {holderText(entry)}</p>
              )}

              {entry.may_hand_over && (
                <Button size="sm" variant="primary" onClick={() => setHanding(entry)}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Schlüssel übergeben
                </Button>
              )}

              {holding && !entry.may_hand_over && (
                <p className="text-sm text-gray-500">
                  Diesen Schlüssel gibt nur {entry.responsible_name ?? 'der Verantwortliche'} weiter.
                </p>
              )}
            </CardBody>
          </Card>
        );
      })}

      <HandoverDialog
        open={handing !== null}
        onOpenChange={(next) => !next && setHanding(null)}
        entry={handing}
      />
    </div>
  );
}
