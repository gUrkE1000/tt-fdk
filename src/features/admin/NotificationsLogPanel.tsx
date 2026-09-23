import { useState } from 'react';
import { MailCheck, RotateCcw } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Table,
  useToast,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/dates';
import {
  useNotificationLog,
  useRetryNotification,
  type NotificationFilter,
  type NotificationRow,
} from './api';

const STATUS_TONES: Record<string, 'yes' | 'no' | 'late' | 'neutral'> = {
  sent: 'yes',
  failed: 'no',
  skipped: 'late',
  pending: 'neutral',
  sending: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  sent: 'verschickt',
  failed: 'fehlgeschlagen',
  skipped: 'übersprungen',
  pending: 'wartet',
  // Vom Versandlauf beansprucht; bleibt eine Zeile länger als 30 Minuten hier stehen,
  // nimmt der nächste Lauf sie wieder auf.
  sending: 'wird versendet',
};

const CHIPS: { value: NotificationFilter; label: string }[] = [
  { value: 'problems', label: 'Nur Probleme' },
  { value: 'all', label: 'Alle' },
];

/**
 * Das Postfach von außen betrachtet.
 *
 * Voreinstellung sind die Problemfälle — wer hier nachsieht, sucht die eine Nachricht,
 * die nicht ankam, nicht die hundert, die es taten. Der Knopf „Nochmal versuchen" stellt
 * eine Zeile zurück auf `pending`; der nächste Lauf nimmt sie dann mit. Das ist der
 * einzige Eingriff, den ein Mensch am Postfach vornehmen kann, und er ist gedacht für
 * genau einen Fall: Die Adresse war falsch, sie ist korrigiert, die Nachricht soll doch
 * noch raus.
 */
export default function NotificationsLogPanel() {
  const [filter, setFilter] = useState<NotificationFilter>('problems');
  const log = useNotificationLog(filter);
  const retry = useRetryNotification();
  const { toast } = useToast();

  async function retryOne(row: NotificationRow) {
    try {
      const done = await retry.mutateAsync(row.id);
      toast(
        done ? 'Die Nachricht geht beim nächsten Lauf raus' : 'Diese Nachricht lässt sich nicht wiederholen',
        done ? 'success' : 'error',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  function retryCell(row: NotificationRow) {
    if (row.status !== 'failed' && row.status !== 'skipped') return null;

    return (
      <Button size="sm" variant="secondary" onClick={() => void retryOne(row)}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Nochmal versuchen
      </Button>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={filter === chip.value}
            onClick={() => setFilter(chip.value)}
            className={cn(
              'min-h-touch rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              filter === chip.value
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <Table
        columns={[
          {
            key: 'created',
            header: 'Erstellt',
            cell: (row: NotificationRow) => formatDateTime(row.created_at),
          },
          { key: 'type', header: 'Art', cell: (row: NotificationRow) => row.type },
          {
            key: 'channel',
            header: 'Kanal',
            cell: (row: NotificationRow) => (row.channel === 'push' ? 'App' : 'E-Mail'),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (row: NotificationRow) => (
              <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            ),
          },
          {
            key: 'error',
            header: 'Grund',
            cell: (row: NotificationRow) => (
              <span className="text-sm text-gray-600">{row.error ?? '—'}</span>
            ),
          },
          { key: 'retry', header: '', align: 'right', cell: retryCell },
        ]}
        rows={log.data ?? []}
        rowKey={(row) => row.id}
        mobileCard={(row) => (
          <Card>
            <CardBody className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-900">{row.type}</span>
                <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {formatDateTime(row.created_at)} · {row.channel === 'push' ? 'App' : 'E-Mail'}
              </p>
              {row.error && <p className="text-sm text-gray-600">{row.error}</p>}
              {retryCell(row)}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={MailCheck}
            title={filter === 'problems' ? 'Nichts liegen geblieben' : 'Noch nichts verschickt'}
            description={
              filter === 'problems'
                ? 'Keine Nachricht ist fehlgeschlagen oder wurde übersprungen.'
                : 'Sobald die erste Benachrichtigung entsteht, steht sie hier.'
            }
          />
        }
      />
    </div>
  );
}
