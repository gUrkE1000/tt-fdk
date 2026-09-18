import { useState } from 'react';
import { KeyRound, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  Table,
  useToast,
} from '../../components/ui';
import { useDeleteKey, useKeys, type KeyRow } from './api';
import { holderText } from './schemas';
import HandoverDialog from './HandoverDialog';
import KeyDialog from './KeyDialog';

/**
 * Der Abschnitt „Schlüssel" unter Orte & Schlüssel (Aufgabe 9.1).
 *
 * Anlegen und Löschen kann nur der Administrator — das erzwingt die Policy, nicht
 * diese Datei. Übergeben darf jeder, der darf: Ob der Knopf erscheint, sagt
 * `may_hand_over` aus der View, also dieselbe Funktion, die auch die RPC prüft.
 */
export default function KeysPanel() {
  const { toast } = useToast();
  const keys = useKeys();
  const deleteKey = useDeleteKey();

  const [editing, setEditing] = useState<KeyRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [handing, setHanding] = useState<KeyRow | null>(null);

  async function remove(entry: KeyRow) {
    if (!entry.id) return;
    if (!window.confirm(`„${entry.name}" wirklich löschen? Das Protokoll verschwindet mit.`)) return;

    try {
      await deleteKey.mutateAsync(entry.id);
      toast('Schlüssel gelöscht', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    }
  }

  function actions(entry: KeyRow) {
    return (
      <div className="flex justify-end gap-1">
        {entry.may_hand_over && (
          <IconButton
            label="Übergeben"
            icon={Send}
            onClick={() => {
              setHanding(entry);
            }}
          />
        )}
        <IconButton
          label="Bearbeiten"
          icon={Pencil}
          onClick={() => {
            setEditing(entry);
            setDialogOpen(true);
          }}
        />
        <IconButton label="Löschen" icon={Trash2} tone="danger" onClick={() => void remove(entry)} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">Schlüssel</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Schlüssel anlegen
        </Button>
      </div>

      <Table
        columns={[
          {
            key: 'name',
            header: 'Name',
            cell: (entry: KeyRow) => (
              <span className="font-semibold text-gray-900">{entry.name}</span>
            ),
          },
          { key: 'venue', header: 'Ort', cell: (entry: KeyRow) => entry.venue_name ?? '—' },
          {
            key: 'responsible',
            header: 'Verantwortlicher',
            cell: (entry: KeyRow) => entry.responsible_name ?? '—',
          },
          {
            key: 'holder',
            header: 'Aktueller Inhaber',
            cell: (entry: KeyRow) => holderText(entry),
          },
          {
            key: 'forwarding',
            header: 'Weitergabe?',
            cell: (entry: KeyRow) =>
              entry.no_forwarding ? <Badge tone="no">gesperrt</Badge> : <Badge tone="yes">ja</Badge>,
          },
          { key: 'actions', header: 'Aktion', align: 'right', cell: actions },
        ]}
        rows={keys.data ?? []}
        rowKey={(entry) => entry.id ?? ''}
        mobileCard={(entry) => (
          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{entry.name}</p>
                  <p className="truncate text-sm text-gray-500">{entry.venue_name ?? 'ohne Ort'}</p>
                </div>
                {actions(entry)}
              </div>
              <p className="text-sm text-gray-700">Bei: {holderText(entry)}</p>
              {entry.no_forwarding && <Badge tone="no">keine Weitergabe</Badge>}
              {!entry.active && <Badge tone="removed">eingezogen</Badge>}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={KeyRound}
            title="Noch keine Schlüssel"
            description="Lege die Hallenschlüssel an, dann lässt sich nachvollziehen, wer gerade aufschließen kann."
          />
        }
      />

      <KeyDialog open={dialogOpen} onOpenChange={setDialogOpen} entry={editing} />
      <HandoverDialog
        open={handing !== null}
        onOpenChange={(next) => !next && setHanding(null)}
        entry={handing}
      />
    </div>
  );
}
