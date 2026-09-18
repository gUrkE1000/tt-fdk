import { useMemo } from 'react';
import { DoorOpen } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Table,
  useToast,
} from '../../components/ui';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { useVenues } from '../venues/api';
import {
  useJoinTraining,
  useLeaveTraining,
  useTrainings,
  type TrainingWithPeople,
} from './api';
import { RHYTHM_LABELS, formatSchedule } from './schemas';

/**
 * „Offene Trainings": die Liste zum Selbst-Eintragen.
 *
 * Wer beitritt, landet in `training_members` — und bekommt damit ab dem nächsten Termin
 * die Erinnerung. Ohne Eintrag sieht man das Training zwar, wird aber nicht gefragt.
 */
export default function OpenTrainingsList() {
  const { profile } = useSession();
  const { toast } = useToast();

  const trainings = useTrainings();
  const venues = useVenues();
  const members = useMembers();
  const join = useJoinTraining();
  const leave = useLeaveTraining();

  const venueList = venues.data ?? [];

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const open = (trainings.data ?? []).filter(
    (training) => training.active && training.is_open && !training.trainer_invites_only,
  );

  async function toggle(training: TrainingWithPeople, joined: boolean) {
    if (!profile?.id) return;
    try {
      if (joined) {
        await leave.mutateAsync({ trainingId: training.id, profileId: profile.id });
        toast(`Du nimmst an ${training.name} nicht mehr teil`, 'success');
      } else {
        await join.mutateAsync({ trainingId: training.id, profileId: profile.id });
        toast(`Du nimmst jetzt an ${training.name} teil`, 'success');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  function participationCell(training: TrainingWithPeople) {
    const joined = profile?.id ? training.memberIds.includes(profile.id) : false;
    return (
      <Button
        size="sm"
        variant={joined ? 'secondary' : 'primary'}
        onClick={() => void toggle(training, joined)}
      >
        {joined ? 'Nicht mehr teilnehmen' : 'Teilnehmen'}
      </Button>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-600">
        An diesen Trainings ist jedes Vereinsmitglied herzlich eingeladen teilzunehmen. Klicke auf
        „Teilnehmen“, dann erscheint das Training in deiner Terminliste.
      </p>

      <Table
        columns={[
          {
            key: 'name',
            header: 'Name',
            cell: (training: TrainingWithPeople) => (
              <span className="font-semibold text-gray-900">{training.name}</span>
            ),
          },
          {
            key: 'when',
            header: 'Zeitpunkt',
            cell: (training: TrainingWithPeople) => formatSchedule(training),
          },
          {
            key: 'rhythm',
            header: 'Rhythmus',
            cell: (training: TrainingWithPeople) => RHYTHM_LABELS[training.rhythm],
          },
          {
            key: 'venue',
            header: 'Ort',
            cell: (training: TrainingWithPeople) =>
              venueList.find((venue) => venue.id === training.venue_id)?.name ?? '—',
          },
          {
            key: 'trainers',
            header: 'Trainer',
            cell: (training: TrainingWithPeople) =>
              training.trainerIds.map(nameOf).join(', ') || '—',
          },
          { key: 'participation', header: 'Teilnahme', align: 'right', cell: participationCell },
        ]}
        rows={open}
        rowKey={(training) => training.id}
        mobileCard={(training) => (
          <Card>
            <CardBody className="space-y-2">
              <div>
                <p className="font-semibold text-gray-900">{training.name}</p>
                <p className="text-sm text-gray-500">
                  {formatSchedule(training)} · {RHYTHM_LABELS[training.rhythm]}
                </p>
              </div>
              {participationCell(training)}
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={DoorOpen}
            title="Keine offenen Trainings"
            description="Sobald ein Training für alle geöffnet ist, steht es hier."
          />
        }
      />
    </div>
  );
}
