import { useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import {
  Button,
  DateInput,
  Dialog,
  EmptyState,
  FilterBar,
  PageHeader,
  Tabs,
  useToast,
} from '../../components/ui';
import { useSession } from '../auth/session';
import { useDeleteEvent, useEventParticipants, useEvents, type ClubEvent } from './api';
import {
  EMPTY_EVENT_FILTERS,
  filterEvents,
  hasActiveEventFilters,
  isFinishedEvent,
  type EventFilters,
} from './schemas';
import EventCard from './EventCard';
import EventDialog from './EventDialog';

export default function EventsPage() {
  const { profile, role } = useSession();
  const { toast } = useToast();

  const events = useEvents();
  const participants = useEventParticipants();
  const deleteEvent = useDeleteEvent();

  const [filters, setFilters] = useState<EventFilters>(EMPTY_EVENT_FILTERS);
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ClubEvent | null>(null);

  const canManage = role === 'admin' || role === 'organizer';

  const visible = useMemo(
    () => filterEvents(events.data ?? [], filters),
    [events.data, filters],
  );

  const open = visible.filter((event) => !isFinishedEvent(event));
  const finished = visible
    .filter((event) => isFinishedEvent(event))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await deleteEvent.mutateAsync(toDelete.id);
      toast(`${toDelete.name} wurde gelöscht`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  function list(rows: ClubEvent[], emptyText: string) {
    if (rows.length === 0) {
      return <EmptyState icon={CalendarDays} title="Keine Termine" description={emptyText} />;
    }

    return (
      <div className="space-y-3">
        {rows.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            participants={(participants.data ?? []).filter(
              (entry) => entry.event_id === event.id,
            )}
            profileId={profile?.id ?? null}
            canManage={canManage}
            onEdit={() => {
              setEditing(event);
              setDialogOpen(true);
            }}
            onDelete={() => setToDelete(event)}
          />
        ))}
      </div>
    );
  }

  const filterBar = (
    <FilterBar
      search={filters.search}
      onSearchChange={(search) => setFilters({ ...filters, search })}
      searchPlaceholder="Name oder Ort"
      onReset={() => setFilters(EMPTY_EVENT_FILTERS)}
      resetDisabled={!hasActiveEventFilters(filters)}
    >
      <DateInput
        aria-label="Von"
        value={filters.from}
        onChange={(event) => setFilters({ ...filters, from: event.target.value })}
      />
      <DateInput
        aria-label="Bis"
        value={filters.to}
        onChange={(event) => setFilters({ ...filters, to: event.target.value })}
      />
    </FilterBar>
  );

  return (
    <div>
      <PageHeader
        title="Vereinstermine"
        description="Plane hier zum Beispiel Clubmeisterschaften, Sommerfeste oder andere Vereinstermine."
        actions={
          canManage ? (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Termin anlegen
            </Button>
          ) : undefined
        }
      />

      {filterBar}

      <Tabs
        tabs={[
          {
            value: 'open',
            label: `Offene Termine (${open.length})`,
            content: list(open, 'Sobald etwas geplant ist, steht es hier.'),
          },
          {
            value: 'finished',
            label: `Beendete Termine (${finished.length})`,
            content: list(finished, 'Hier sammeln sich die Termine, die vorbei sind.'),
          },
        ]}
      />

      <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} event={editing} />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
        title={`${toDelete?.name ?? 'Termin'} löschen?`}
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => void onDeleteConfirmed()}>
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Mit dem Termin verschwinden auch alle Zu- und Absagen dazu.
        </p>
      </Dialog>
    </div>
  );
}
