import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Pencil, Plus, Trash2 } from 'lucide-react';
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
  Textarea,
  useToast,
} from '../../components/ui';
import { useMembers } from '../members/api';
import {
  dutiesToText,
  parseDuties,
  useClubRoles,
  useDeleteClubRole,
  useSaveClubRole,
  type ClubRoleWithMembers,
} from './rolesApi';

/**
 * Reiter „Ämter" unter Verein (Aufgabe 9.6).
 *
 * Ein Amt ist eine Auskunft, keine Berechtigung: Wer ist Jugendwart, wer macht die Kasse?
 * Im TT-Planer schalten Ämter zusätzlich Inventar und Bekleidung frei — beide Module sind
 * hier gestrichen, und damit fällt die einzige Rechtewirkung weg. Das ist kein Verlust:
 * Rechte an einem frei benannten Posten festzumachen ist ohnehin eine Einladung dazu,
 * versehentlich jemandem zu viel zu geben.
 */
export default function ClubRolesTab() {
  const { toast } = useToast();
  const roles = useClubRoles();
  const members = useMembers();
  const saveRole = useSaveClubRole();
  const deleteRole = useDeleteClubRole();

  const [editing, setEditing] = useState<ClubRoleWithMembers | null>(null);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duties, setDuties] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setDuties(dutiesToText(editing?.duties));
    setMemberIds(editing?.memberIds ?? []);
    setError(null);
  }, [open, editing]);

  const people = useMemo(
    () =>
      (members.data ?? [])
        .filter((member) => member.status === 'active')
        .map((member) => ({ id: member.id, name: member.full_name ?? '' })),
    [members.data],
  );

  async function submit() {
    if (name.trim() === '') {
      setError('Das Amt braucht einen Namen');
      return;
    }

    try {
      await saveRole.mutateAsync({
        id: editing?.id ?? null,
        values: {
          name,
          description,
          duties: parseDuties(duties),
          sort_order: editing?.sort_order ?? (roles.data ?? []).length + 1,
          memberIds,
        },
      });
      toast(editing ? 'Amt gespeichert' : 'Amt angelegt', 'success');
      setOpen(false);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  async function remove(role: ClubRoleWithMembers) {
    if (!window.confirm(`Das Amt „${role.name}" wirklich löschen?`)) return;

    try {
      await deleteRole.mutateAsync(role.id);
      toast('Amt gelöscht', 'success');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Löschen fehlgeschlagen', 'error');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Ämter sind Posten im Verein — sie geben keine Rechte in der Anwendung.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Amt anlegen
        </Button>
      </div>

      {(roles.data ?? []).length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Noch keine Ämter"
          description="Jugendwart, Kassier, Pressewart — wer im Verein wofür zuständig ist, steht danach unter „Mein Verein“ für alle nachlesbar."
        />
      ) : (
        <div className="space-y-3">
          {(roles.data ?? []).map((role) => (
            <Card key={role.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{role.name}</p>
                    <p className="text-sm text-gray-600">
                      {role.memberNames.length > 0
                        ? role.memberNames.join(', ')
                        : 'niemand zugeordnet'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton
                      label="Bearbeiten"
                      icon={Pencil}
                      onClick={() => {
                        setEditing(role);
                        setOpen(true);
                      }}
                    />
                    <IconButton
                      label="Löschen"
                      icon={Trash2}
                      tone="danger"
                      onClick={() => void remove(role)}
                    />
                  </div>
                </div>

                {role.description && <p className="text-sm text-gray-700">{role.description}</p>}

                {role.duties.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-gray-600">
                    {role.duties.map((duty) => (
                      <li key={duty}>{duty}</li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? `${editing.name} bearbeiten` : 'Amt anlegen'}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button variant="primary" loading={saveRole.isPending} onClick={() => void submit()}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" required error={error ?? undefined}>
            {(p) => (
              <Input
                {...p}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="z. B. Jugendwart"
              />
            )}
          </FormField>

          <FormField label="Beschreibung">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Kurzbeschreibung der Rolle"
              />
            )}
          </FormField>

          <FormField label="Tätigkeiten" hint="Eine pro Zeile oder durch Komma getrennt.">
            {(p) => (
              <Textarea
                {...p}
                rows={4}
                value={duties}
                onChange={(event) => setDuties(event.target.value)}
                placeholder={'Training organisieren\nPressearbeit\nMaterialpflege'}
              />
            )}
          </FormField>

          <FormField label="Wer hat das Amt?">
            {(p) => (
              <PersonPicker
                {...p}
                people={people}
                value={memberIds}
                onChange={setMemberIds}
                placeholder="Mitglieder auswählen"
              />
            )}
          </FormField>
        </div>
      </Dialog>
    </div>
  );
}
