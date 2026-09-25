import { useEffect, useMemo, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Button, PersonPicker, useToast } from '../../components/ui';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useSetSessionAssignees, type TrainingSession, type TrainingWithPeople } from './api';

export interface SessionAssigneesPanelProps {
  session: TrainingSession;
  training: TrainingWithPeople;
  /** Die Zugeteilten dieses Termins. */
  assigneeIds: string[];
  nameOf: (profileId: string) => string;
}

/**
 * Systemtraining: wer zu genau diesem Termin kommt.
 *
 * Trainer und Administrator teilen zu; die Zugeteilten bekommen eine Nachricht und
 * können dann zu- oder absagen. Alle anderen sehen nur, wer eingeteilt ist.
 */
export default function SessionAssigneesPanel({
  session,
  training,
  assigneeIds,
  nameOf,
}: SessionAssigneesPanelProps) {
  const { profile, role } = useSession();
  const { toast } = useToast();
  const members = useMembers();
  const save = useSetSessionAssignees();

  const canAssign =
    role === 'admin' || (profile?.id != null && training.trainerIds.includes(profile.id));
  const past = new Date(session.starts_at) <= new Date();

  const [draft, setDraft] = useState<string[]>(assigneeIds);
  const key = assigneeIds.join(',');
  useEffect(() => {
    setDraft(key === '' ? [] : key.split(','));
  }, [key]);

  const people = useMemo(
    () =>
      (members.data ?? [])
        .filter((member) => member.status === 'active' && member.role !== 'guest')
        .map((member) => ({ id: member.id, name: member.full_name ?? '' })),
    [members.data],
  );

  const changed = draft.slice().sort().join(',') !== assigneeIds.slice().sort().join(',');

  async function onSave() {
    try {
      const added = await save.mutateAsync({ sessionId: session.id, profileIds: draft });
      toast(
        added > 0
          ? `Zuteilung gespeichert — ${added === 1 ? 'eine Person' : `${added} Personen`} benachrichtigt`
          : 'Zuteilung gespeichert',
        'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-600">
        <UserCheck className="h-4 w-4" aria-hidden="true" />
        Eingeteilt für diesen Termin
      </h4>

      {canAssign && !past && !session.cancelled ? (
        <>
          <PersonPicker
            people={people}
            value={draft}
            onChange={setDraft}
            placeholder="Teilnehmer auswählen"
          />
          <Button
            size="sm"
            variant="primary"
            disabled={!changed || save.isPending}
            onClick={() => void onSave()}
          >
            Zuteilung speichern
          </Button>
        </>
      ) : (
        <p className="text-sm text-gray-700">
          {assigneeIds.length > 0 ? assigneeIds.map(nameOf).join(', ') : 'Noch niemand eingeteilt.'}
        </p>
      )}
    </section>
  );
}
