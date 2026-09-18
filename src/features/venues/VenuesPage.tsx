import { useState } from 'react';
import { MapPin, Pencil, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  PageHeader,
  Table,
  useToast,
} from '../../components/ui';
import { useSetVenueActive, useVenues, type Venue } from './api';
import { formatVenueAddress } from './schemas';
import VenueDialog from './VenueDialog';
import KeysPanel from '../keys/KeysPanel';

export default function VenuesPage() {
  const { toast } = useToast();
  const venues = useVenues();
  const setActive = useSetVenueActive();
  const [editing, setEditing] = useState<Venue | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function onToggleActive(venue: Venue) {
    try {
      await setActive.mutateAsync({ id: venue.id, active: !venue.active });
      toast(venue.active ? `${venue.name} stillgelegt` : `${venue.name} wieder aktiv`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  function actions(venue: Venue) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          onClick={() => void onToggleActive(venue)}
          aria-label={venue.active ? `${venue.name} stilllegen` : `${venue.name} aktivieren`}
        >
          {venue.active ? 'Stilllegen' : 'Aktivieren'}
        </Button>
        <IconButton
          icon={Pencil}
          label={`${venue.name} bearbeiten`}
          onClick={() => {
            setEditing(venue);
            setDialogOpen(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Orte & Schlüssel"
          description="Hallen und Räume, in denen gespielt und trainiert wird."
          actions={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ort anlegen
            </Button>
          }
        />

        <Table
          columns={[
            {
              key: 'name',
              header: 'Name',
              cell: (venue: Venue) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-gray-900">{venue.name}</span>
                  {!venue.active && <Badge tone="removed">stillgelegt</Badge>}
                  {venue.training_only && <Badge tone="info">nur Training</Badge>}
                </div>
              ),
            },
            {
              key: 'address',
              header: 'Adresse',
              cell: (venue: Venue) => formatVenueAddress(venue) || '—',
            },
            {
              key: 'maxGames',
              header: 'Gleichzeitige Spiele',
              align: 'right',
              cell: (venue: Venue) => venue.max_games ?? 'unbegrenzt',
            },
            { key: 'actions', header: 'Aktion', align: 'right', cell: actions },
          ]}
          rows={venues.data ?? []}
          rowKey={(venue) => venue.id}
          mobileCard={(venue) => (
            <Card>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{venue.name}</p>
                    <p className="truncate text-sm text-gray-500">
                      {formatVenueAddress(venue) || 'ohne Adresse'}
                    </p>
                  </div>
                  {actions(venue)}
                </div>
                {!venue.active && <Badge tone="removed">stillgelegt</Badge>}
              </CardBody>
            </Card>
          )}
          empty={
            <EmptyState
              icon={MapPin}
              title="Noch keine Orte"
              description="Lege die Halle an, in der ihr spielt — Spieltermine und Trainings hängen daran."
            />
          }
        />
      </div>

      <KeysPanel />

      <VenueDialog open={dialogOpen} onOpenChange={setDialogOpen} venue={editing} />
    </div>
  );
}
