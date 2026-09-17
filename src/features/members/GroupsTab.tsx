import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Layers, Pencil, Plus, Trash2, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  FormField,
  IconButton,
  Input,
  PersonPicker,
  Table,
  useToast,
} from '../../components/ui';
import {
  useCreateGroup,
  useDeleteGroup,
  useGroups,
  useMembers,
  useRenameGroup,
  useSetGroupMembers,
  type GroupWithMembers,
} from './api';
import { groupSchema, type GroupValues } from './schemas';

/**
 * Gruppen sind die zweite Adressierungsdimension neben den Mannschaften: „Jugend",
 * „Montagstraining", „Vorstand". Eine Gruppe hat, wie im TT-Planer, nur einen Namen —
 * alles Weitere ergibt sich aus der Zuordnung.
 */
export default function GroupsTab() {
  const { toast } = useToast();
  const groups = useGroups();
  const members = useMembers();
  const createGroup = useCreateGroup();
  const renameGroup = useRenameGroup();
  const deleteGroup = useDeleteGroup();
  const setGroupMembers = useSetGroupMembers();

  const [editing, setEditing] = useState<GroupWithMembers | null>(null);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState<GroupWithMembers | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<GroupWithMembers | null>(null);

  const form = useForm<GroupValues>({ resolver: zodResolver(groupSchema) });

  const rows = groups.data ?? [];
  const people = (members.data ?? []).map((member) => ({
    id: member.id,
    name: member.full_name ?? '',
    detail: member.qttr != null ? `${member.qttr} QTTR` : undefined,
  }));

  function openNameDialog(group: GroupWithMembers | null) {
    setEditing(group);
    form.reset({ name: group?.name ?? '' });
    setNameDialogOpen(true);
  }

  async function onSubmitName(values: GroupValues) {
    try {
      if (editing) await renameGroup.mutateAsync({ id: editing.id, name: values.name });
      else await createGroup.mutateAsync(values.name);
      toast(editing ? 'Gruppe umbenannt' : 'Gruppe angelegt', 'success');
      setNameDialogOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  async function onSaveAssignment() {
    if (!assigning) return;
    try {
      await setGroupMembers.mutateAsync({ groupId: assigning.id, memberIds: selected });
      toast('Zuordnung gespeichert', 'success');
      setAssigning(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await deleteGroup.mutateAsync(toDelete.id);
      toast('Gruppe gelöscht', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  function actions(group: GroupWithMembers) {
    return (
      <div className="flex items-center justify-end gap-1">
        <IconButton
          icon={Users}
          label={`Mitglieder der Gruppe ${group.name} zuweisen`}
          tone="primary"
          onClick={() => {
            setAssigning(group);
            setSelected(group.memberIds);
          }}
        />
        <IconButton
          icon={Pencil}
          label={`Gruppe ${group.name} umbenennen`}
          onClick={() => openNameDialog(group)}
        />
        <IconButton
          icon={Trash2}
          label={`Gruppe ${group.name} löschen`}
          tone="danger"
          onClick={() => setToDelete(group)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-gray-600">
          Gruppen bündeln Mitglieder unabhängig von den Mannschaften — für Trainings,
          Umfragen und Termineinladungen.
        </p>
        <Button variant="primary" onClick={() => openNameDialog(null)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Gruppe anlegen
        </Button>
      </div>

      <Table
        columns={[
          {
            key: 'name',
            header: 'Name',
            cell: (group: GroupWithMembers) => (
              <span className="font-semibold text-gray-900">{group.name}</span>
            ),
          },
          {
            key: 'members',
            header: 'Mitglieder',
            cell: (group: GroupWithMembers) => `${group.memberIds.length}`,
          },
          { key: 'actions', header: 'Aktion', align: 'right', cell: actions },
        ]}
        rows={rows}
        rowKey={(group) => group.id}
        mobileCard={(group) => (
          <Card>
            <CardBody className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{group.name}</p>
                <p className="text-sm text-gray-500">{group.memberIds.length} Mitglieder</p>
              </div>
              {actions(group)}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={Layers}
            title="Noch keine Gruppen"
            description="Lege eine Gruppe an, um Mitglieder unabhängig von den Mannschaften zusammenzufassen."
          />
        }
      />

      <Dialog
        open={nameDialogOpen}
        onOpenChange={setNameDialogOpen}
        title={editing ? 'Gruppe umbenennen' : 'Gruppe anlegen'}
        footer={
          <>
            <Button onClick={() => setNameDialogOpen(false)}>Abbrechen</Button>
            <Button
              variant="primary"
              loading={form.formState.isSubmitting}
              onClick={form.handleSubmit(onSubmitName)}
            >
              Speichern
            </Button>
          </>
        }
      >
        <form noValidate>
          <FormField label="Name" required error={form.formState.errors.name?.message}>
            {(p) => <Input {...p} {...form.register('name')} placeholder="Jugend" />}
          </FormField>
        </form>
      </Dialog>

      <Dialog
        open={assigning !== null}
        onOpenChange={(open) => !open && setAssigning(null)}
        title={`Mitglieder der Gruppe ${assigning?.name ?? ''}`}
        footer={
          <>
            <Button onClick={() => setAssigning(null)}>Abbrechen</Button>
            <Button variant="primary" onClick={() => void onSaveAssignment()}>
              Speichern
            </Button>
          </>
        }
      >
        <FormField label="Mitglieder">
          {(p) => <PersonPicker {...p} people={people} value={selected} onChange={setSelected} />}
        </FormField>
      </Dialog>

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Gruppe ${toDelete?.name ?? ''} löschen?`}
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
          Die Mitglieder bleiben erhalten, nur die Zuordnung verschwindet.
        </p>
      </Dialog>
    </div>
  );
}
