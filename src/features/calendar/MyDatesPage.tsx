import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, CalendarX, MapPin, Rss } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Tabs,
} from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { useSession } from '../auth/session';
import { useMyUpcoming, type MyDate } from './api';
import SubscribeDialog from './SubscribeDialog';
import OpenItemsList from '../dashboard/OpenItemsList';
import { useMyOpenItems } from '../dashboard/openItems';

const KIND_LABELS: Record<string, string> = {
  match: 'Spiel',
  training: 'Training',
  event: 'Vereinstermin',
};

const STATUS_LABELS: Record<string, string> = {
  yes: 'Zusage',
  late: 'Komme später',
  no: 'Absage',
  unclear: 'Unsicher',
  none: 'offen',
};

/**
 * Meine Termine (Aufgabe 7.5).
 *
 * Spiele, Trainings und Vereinstermine gemischt und chronologisch — die Frage ist
 * „was steht an", nicht „welcher Art ist es". Die Art steht als Badge daneben.
 */
export default function MyDatesPage() {
  const { profile } = useSession();
  const dates = useMyUpcoming(profile?.id ?? null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const open = useMyOpenItems(profile?.id ?? null);
  const [search, setSearch] = useSearchParams();

  const { attending, declined } = useMemo(() => {
    // Die Sicht liefert auch Vergangenes (der Kalender-Feed braucht es). Hier geht es
    // um das, was ansteht: Ein Termin bleibt stehen, bis er vorbei ist.
    const now = Date.now();
    const rows = (dates.data ?? [])
      .filter((row) => row.active !== false)
      .filter((row) => new Date(row.ends_at ?? row.starts_at ?? 0).getTime() >= now);

    return {
      attending: rows.filter((row) => row.my_status === 'yes' || row.my_status === 'late'),
      declined: rows.filter((row) => row.my_status === 'no'),
    };
  }, [dates.data]);

  function list(rows: MyDate[], empty: string, icon: typeof CalendarCheck) {
    if (dates.isLoading) return <LoadingState />;
    if (dates.isError) return <ErrorState onRetry={() => void dates.refetch()} />;
    if (rows.length === 0) {
      return <EmptyState icon={icon} title="Nichts eingetragen" description={empty} />;
    }

    return (
      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={`${row.kind}:${row.id}`}>
            <CardBody className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-gray-900">
                  {row.starts_at ? formatDateTime(row.starts_at) : '—'}
                </span>
                <Badge tone="neutral">{KIND_LABELS[row.kind ?? ''] ?? 'Termin'}</Badge>
                <Badge tone={row.my_status === 'no' ? 'no' : 'yes'}>
                  {STATUS_LABELS[row.my_status ?? ''] ?? row.my_status}
                </Badge>
              </div>
              <p className="text-sm text-gray-700">{row.title}</p>
              {row.location && (
                <p className="flex items-start gap-1.5 text-sm text-gray-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <span>{row.location}</span>
                </p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Meine Termine"
        description="Spiele, Trainings und Vereinstermine — wo du noch antworten solltest und wozu du dich gemeldet hast."
        actions={
          <Button variant="primary" onClick={() => setSubscribeOpen(true)}>
            <Rss className="h-4 w-4" aria-hidden="true" />
            Kalender abonnieren
          </Button>
        }
      />

      <Tabs
        value={search.get('tab') ?? 'open'}
        onValueChange={(value) => setSearch({ tab: value }, { replace: true })}
        tabs={[
          {
            value: 'open',
            label: `Offen (${open.data?.length ?? 0})`,
            content: <OpenItemsList />,
          },
          {
            value: 'attending',
            label: `Zugesagte Termine (${attending.length})`,
            content: list(
              attending,
              'Sobald du irgendwo zusagst, steht der Termin hier.',
              CalendarCheck,
            ),
          },
          {
            value: 'declined',
            label: `Abgesagte Termine (${declined.length})`,
            content: list(declined, 'Du hast nichts abgesagt.', CalendarX),
          },
        ]}
      />

      <SubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />
    </div>
  );
}
