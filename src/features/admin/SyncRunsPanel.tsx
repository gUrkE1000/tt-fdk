import { RefreshCw } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState, Table } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { useSyncRuns, type SyncRun } from './api';
import { summaryText } from './syncSummary';

const STATUS_TONES: Record<string, 'yes' | 'no' | 'late' | 'neutral'> = {
  success: 'yes',
  warning: 'late',
  failed: 'no',
  pending: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  success: 'erfolgreich',
  warning: 'mit Warnung',
  failed: 'fehlgeschlagen',
  pending: 'läuft',
};

/**
 * Die letzten Läufe des Kalenderabgleichs.
 *
 * Die wichtigste Zeile ist die oberste: Steht dort ein Datum von vorgestern, läuft der
 * nächtliche Job nicht mehr — und niemand hätte es sonst bemerkt, weil ein ausbleibender
 * Abgleich keine Fehlermeldung erzeugt, sondern nur veraltete Spielpläne.
 */
export default function SyncRunsPanel() {
  const runs = useSyncRuns();

  return (
    <Table
      columns={[
        {
          key: 'started',
          header: 'Start',
          cell: (run: SyncRun) => formatDateTime(run.started_at),
        },
        {
          key: 'status',
          header: 'Ergebnis',
          cell: (run: SyncRun) => (
            <Badge tone={STATUS_TONES[run.status] ?? 'neutral'}>
              {STATUS_LABELS[run.status] ?? run.status}
            </Badge>
          ),
        },
        { key: 'summary', header: 'Änderungen', cell: (run: SyncRun) => summaryText(run.summary) },
      ]}
      rows={runs.data ?? []}
      rowKey={(run) => run.id}
      mobileCard={(run) => (
        <Card>
          <CardBody className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{formatDateTime(run.started_at)}</span>
              <Badge tone={STATUS_TONES[run.status] ?? 'neutral'}>
                {STATUS_LABELS[run.status] ?? run.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{summaryText(run.summary)}</p>
          </CardBody>
        </Card>
      )}
      empty={
        <EmptyState
          icon={RefreshCw}
          title="Noch kein Abgleich gelaufen"
          description="Sobald der nächtliche Job das erste Mal läuft, steht er hier. Wie er eingerichtet wird, steht in docs/betrieb.md."
        />
      }
    />
  );
}
