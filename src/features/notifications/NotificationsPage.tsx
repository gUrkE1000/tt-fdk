import { Link } from 'react-router-dom';
import { Bell, Mail, Smartphone } from 'lucide-react';
import { Card, CardBody, EmptyState, PageHeader } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { notificationTarget } from '../../lib/notificationTarget';
import { useSession } from '../auth/session';
import { useMyNotifications, HISTORY_LIMIT } from './history';

/**
 * Verlauf der Mitteilungen.
 *
 * Eine Push-Nachricht, die man weggewischt hat, ist sonst weg — und mit ihr die
 * Information, welches Spiel verlegt wurde oder wer als Ersatz gefragt ist. Hier steht
 * alles noch einmal, was die Anwendung an dieses Mitglied geschickt hat.
 */
export default function NotificationsPage() {
  const { profile } = useSession();
  const history = useMyNotifications(profile?.id ?? null);
  const entries = history.data ?? [];

  return (
    <div>
      <PageHeader
        title="Mitteilungen"
        description={`Was dir die App zuletzt geschickt hat — die letzten ${HISTORY_LIMIT}.`}
        actions={
          <Link
            to="/profile?tab=notifications"
            className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Einstellungen
          </Link>
        }
      />

      {entries.length === 0 && !history.isLoading ? (
        <EmptyState
          icon={Bell}
          title="Noch keine Mitteilungen"
          description="Sobald dir die App etwas schickt — eine Erinnerung, eine Ersatzanfrage, eine neue Umfrage —, steht es auch hier."
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            // Nur Adressen der eigenen App werden zu Links; alles andere bleibt Text.
            const target = entry.link
              ? notificationTarget(entry.link, window.location.origin, '')
              : '';
            return (
              <Card key={entry.id}>
                <CardBody className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{formatDateTime(entry.at)}</span>
                    {entry.channels.includes('push') && (
                      <Smartphone className="h-3.5 w-3.5" aria-label="per App" />
                    )}
                    {entry.channels.includes('email') && (
                      <Mail className="h-3.5 w-3.5" aria-label="per E-Mail" />
                    )}
                  </div>
                  <p className="font-semibold text-gray-900">{entry.subject}</p>
                  <details className="text-sm text-gray-600">
                    <summary className="cursor-pointer select-none">Text anzeigen</summary>
                    <p className="mt-1 whitespace-pre-wrap">{entry.body}</p>
                  </details>
                  {target && target !== '/' && (
                    <Link
                      to={target}
                      className="inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      Öffnen
                    </Link>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
