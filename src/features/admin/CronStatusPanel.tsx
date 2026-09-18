import { Clock } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState, Table } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { useCronStatus, type CronStatus } from './api';

/**
 * Wie alt ein letzter Lauf höchstens sein darf, bevor die Anzeige stutzig wird.
 *
 * 26 Stunden: Der seltenste Job läuft täglich; ein Tag plus zwei Stunden Luft fängt
 * Zeitumstellung und einen verspäteten Lauf ab, ohne einen ausgefallenen Job zu
 * beschönigen.
 */
export const STALE_HOURS = 26;

export function isStale(lastStart: string | null, now: Date = new Date()): boolean {
  if (!lastStart) return true;
  return now.getTime() - new Date(lastStart).getTime() > STALE_HOURS * 60 * 60 * 1000;
}

function statusBadge(job: CronStatus) {
  if (job.active === false) return <Badge tone="neutral">abgeschaltet</Badge>;
  if (job.last_status === 'failed') return <Badge tone="no">fehlgeschlagen</Badge>;
  if (!job.last_start) return <Badge tone="late">noch nie gelaufen</Badge>;
  if (isStale(job.last_start)) return <Badge tone="late">überfällig</Badge>;
  return <Badge tone="yes">läuft</Badge>;
}

/**
 * Die Jobs in der Datenbank.
 *
 * Ein Cron-Job, der nicht mehr läuft, meldet sich nicht — er hört einfach auf. Genau
 * deshalb steht hier nicht nur „aktiv", sondern wann er zuletzt lief: Ein Häkchen an
 * einem Job, dessen letzter Lauf drei Tage her ist, wäre eine falsche Beruhigung.
 */
export default function CronStatusPanel() {
  const jobs = useCronStatus();

  return (
    <Table
      columns={[
        {
          key: 'name',
          header: 'Job',
          cell: (job: CronStatus) => (
            <span className="font-semibold text-gray-900">{job.jobname ?? '—'}</span>
          ),
        },
        { key: 'schedule', header: 'Zeitplan', cell: (job: CronStatus) => job.schedule ?? '—' },
        { key: 'status', header: 'Zustand', cell: statusBadge },
        {
          key: 'last',
          header: 'Zuletzt',
          cell: (job: CronStatus) => (job.last_start ? formatDateTime(job.last_start) : '—'),
        },
        {
          key: 'message',
          header: 'Meldung',
          cell: (job: CronStatus) => (
            <span className="text-sm text-gray-600">{job.last_message || '—'}</span>
          ),
        },
      ]}
      rows={jobs.data ?? []}
      rowKey={(job) => String(job.jobid)}
      mobileCard={(job) => (
        <Card>
          <CardBody className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-900">{job.jobname ?? '—'}</span>
              {statusBadge(job)}
            </div>
            <p className="text-sm text-gray-500">
              {job.schedule ?? '—'} · zuletzt{' '}
              {job.last_start ? formatDateTime(job.last_start) : 'nie'}
            </p>
            {job.last_message && <p className="text-sm text-gray-600">{job.last_message}</p>}
          </CardBody>
        </Card>
      )}
      empty={
        <EmptyState
          icon={Clock}
          title="Keine Jobs eingeplant"
          description="pg_cron ist nicht eingerichtet — oder die Datenbank hat die Erweiterung nicht. Die Einrichtung steht in docs/einrichtung.md."
        />
      }
    />
  );
}
