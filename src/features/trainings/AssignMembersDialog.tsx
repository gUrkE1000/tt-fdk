import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  FormField,
  MultiSelect,
  PersonPicker,
  Select,
  useToast,
} from '../../components/ui';
import type { GroupWithMembers, MemberSummary as Member } from '../members/api';
import type { TeamWithRoster } from '../teams/api';
import { useAssignTrainingMembers, type TrainingWithPeople } from './api';
import { resolveAssignment, type AssignSource } from './schemas';

export interface AssignMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainings: TrainingWithPeople[];
  teams: TeamWithRoster[];
  groups: GroupWithMembers[];
  members: Member[];
  /** Vorauswahl, wenn der Dialog aus einer Zeile heraus geöffnet wird. */
  trainingId?: string | null;
}

/**
 * „Mitglieder zuweisen“: ein Training, dazu Mannschaften, Gruppen und einzelne
 * Mitglieder in einem Rutsch. Wer zwanzig Jugendliche einem Training zuordnen will,
 * soll nicht zwanzigmal klicken.
 */
export default function AssignMembersDialog({
  open,
  onOpenChange,
  trainings,
  teams,
  groups,
  members,
  trainingId,
}: AssignMembersDialogProps) {
  const { toast } = useToast();
  const assign = useAssignTrainingMembers();

  const [selected, setSelected] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [replace, setReplace] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(trainingId ?? trainings[0]?.id ?? '');
    setTeamIds([]);
    setGroupIds([]);
    setMemberIds([]);
    setReplace(false);
  }, [open, trainingId, trainings]);

  const training = trainings.find((entry) => entry.id === selected) ?? null;

  const source: AssignSource = {
    teams: Object.fromEntries(
      teams.map((team) => [team.id, [...team.regularIds, ...team.substituteIds]]),
    ),
    groups: Object.fromEntries(groups.map((group) => [group.id, group.memberIds])),
  };

  const preview = training
    ? resolveAssignment({
        source,
        teamIds,
        groupIds,
        memberIds,
        current: training.memberIds,
        replace,
      })
    : [];

  async function onSave() {
    if (!training) return;
    try {
      await assign.mutateAsync({ trainingId: training.id, memberIds: preview });
      toast(`${preview.length} Mitglieder sind ${training.name} zugeordnet`, 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mitglieder zuweisen"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            variant="primary"
            loading={assign.isPending}
            disabled={training === null}
            onClick={() => void onSave()}
          >
            Zuweisen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Training" required>
          {(p) => (
            <Select
              {...p}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              options={trainings.map((entry) => ({ value: entry.id, label: entry.name }))}
            />
          )}
        </FormField>

        <FormField label="Mannschaften" hint="Kader und Ersatzspieler zusammen.">
          {(p) => (
            <MultiSelect
              {...p}
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
              value={teamIds}
              onChange={setTeamIds}
              placeholder="Keine Mannschaft"
            />
          )}
        </FormField>

        <FormField label="Gruppen">
          {(p) => (
            <MultiSelect
              {...p}
              options={groups.map((group) => ({ value: group.id, label: group.name }))}
              value={groupIds}
              onChange={setGroupIds}
              placeholder="Keine Gruppe"
            />
          )}
        </FormField>

        <FormField label="Einzelne Mitglieder">
          {(p) => (
            <PersonPicker
              {...p}
              people={members.map((member) => ({ id: member.id, name: member.full_name ?? '' }))}
              value={memberIds}
              onChange={setMemberIds}
              placeholder="Niemand ausgewählt"
            />
          )}
        </FormField>

        <Checkbox
          checked={replace}
          onCheckedChange={setReplace}
          label="Bisherige Zuordnung überschreiben"
          hint="Ohne Haken kommen die Ausgewählten zu den bisherigen dazu."
        />

        {training && (
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            Danach sind <span className="font-semibold tabular-nums">{preview.length}</span>{' '}
            Mitglieder zugeordnet, bisher waren es {training.memberIds.length}.
          </p>
        )}
      </div>
    </Dialog>
  );
}
