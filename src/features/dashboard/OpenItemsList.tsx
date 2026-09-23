import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Check, CheckCircle2, Clock, Share2, Users, Vote, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  LoadingState,
  buttonClasses,
  useToast,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/dates';
import { useSession } from '../auth/session';
import {
  useAllParticipations,
  useAllVolunteers,
  useMatches,
  type MatchRow,
  type Participation,
} from '../matches/api';
import { useCanManageMatch } from '../matches/canManage';
import MatchDialogs, { type OpenMatchDialog } from '../matches/MatchDialogs';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useMembers } from '../members/api';
import ResponseButtons from '../matches/ResponseButtons';
import { useSetAttendance, type AttendanceStatus } from '../trainings/api';
import { useSetEventParticipation, type EventStatus } from '../events/api';
import { useMyOpenItems, type OpenItem, type OpenKind } from './openItems';

const KIND_LABELS: Record<OpenKind, string> = {
  match: 'Spiel',
  training: 'Training',
  event: 'Vereinstermin',
  poll: 'Umfrage',
};

/** Wo die vollständige Karte steht — mit Teilnehmern, Nachrichten, Gästen. */
const DETAIL_LINKS: Record<OpenKind, string> = {
  match: '/my-games',
  training: '/my-club?tab=trainings',
  event: '/my-club?tab=events',
  poll: '/votes',
};

const EVENT_REFUSALS: Record<string, string> = {
  closed: 'Die Anmeldefrist ist vorbei.',
  full: 'Der Termin ist voll.',
  gone: 'Diesen Termin gibt es nicht mehr.',
};

export interface OpenItemsListProps {
  /** Höchstens so viele Einträge, darunter ein Hinweis auf den Rest. */
  limit?: number;
}

/**
 * „Offen für dich": Spiele, Trainings, Vereinstermine und Umfragen, bei denen die eigene
 * Antwort fehlt — mit den Knöpfen direkt an der Zeile. Wer antwortet, sieht die Zeile
 * verschwinden; wer mehr wissen will, kommt über den Titel zur vollständigen Karte.
 */
export default function OpenItemsList({ limit }: OpenItemsListProps) {
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const items = useMyOpenItems(profileId);
  const participations = useAllParticipations();

  // Für Spiele der eigenen Mannschaft (oder als Admin) stehen hier auch die Knöpfe des
  // Mannschaftsführers — sonst müsste man für die Aufstellung erst die Seite wechseln.
  const canManage = useCanManageMatch();
  const matches = useMatches();
  const teams = useTeams();
  const venues = useVenues();
  const volunteers = useAllVolunteers();
  const members = useMembers();
  const [dialog, setDialog] = useState<OpenMatchDialog | null>(null);

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  const all = items.data ?? [];
  const shown = limit === undefined ? all : all.slice(0, limit);

  if (items.isLoading) return <LoadingState />;
  if (items.isError) return <ErrorState onRetry={() => void items.refetch()} />;

  if (all.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Alles beantwortet"
        description="Bei keinem Spiel, Training, Vereinstermin und keiner Umfrage fehlt gerade deine Antwort."
      />
    );
  }

  return (
    <div className="space-y-3">
      {shown.map((item) => (
        <Card key={`${item.kind}:${item.id}`}>
          <CardBody className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{KIND_LABELS[item.kind]}</Badge>
              {item.date && (
                <span className="text-sm font-semibold text-gray-900">
                  {item.kind === 'poll' ? `bis ${formatDateTime(item.date)}` : formatDateTime(item.date)}
                </span>
              )}
            </div>
            <Link
              to={DETAIL_LINKS[item.kind]}
              className="block font-semibold text-gray-900 underline-offset-2 hover:text-primary hover:underline"
            >
              {item.title}
            </Link>
            <OpenItemActions
              item={item}
              participation={
                item.kind === 'match'
                  ? ((participations.data ?? []).find(
                      (entry) => entry.match_id === item.id && entry.profile_id === profileId,
                    ) ?? null)
                  : null
              }
            />
            {item.kind === 'match' && (
              <ManagerButtons
                match={(matches.data ?? []).find((match) => match.id === item.id)}
                canManage={canManage}
                onOpen={setDialog}
              />
            )}
          </CardBody>
        </Card>
      ))}

      <MatchDialogs
        open={dialog}
        onClose={() => setDialog(null)}
        teams={teams.data ?? []}
        venues={venues.data ?? []}
        participations={participations.data ?? []}
        volunteers={volunteers.data ?? []}
        members={members.data ?? []}
        nameOf={nameOf}
      />

      {limit !== undefined && all.length > limit && (
        <p className="text-sm text-gray-600">
          Und {all.length - limit} weitere —{' '}
          <Link to="/my-dates?tab=open" className="font-semibold text-primary hover:underline">
            alle anzeigen
          </Link>
        </p>
      )}
    </div>
  );
}

function ManagerButtons({
  match,
  canManage,
  onOpen,
}: {
  match: MatchRow | undefined;
  canManage: (teamId: string | null | undefined) => boolean;
  onOpen: (dialog: OpenMatchDialog) => void;
}) {
  if (!match || !canManage(match.team_id)) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-2">
      <Button size="sm" onClick={() => onOpen({ kind: 'manage', match })}>
        <Users className="h-4 w-4" aria-hidden="true" />
        Spieler verwalten
      </Button>
      <Button size="sm" onClick={() => onOpen({ kind: 'share', match })}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Aufstellung teilen
      </Button>
      <Button size="sm" onClick={() => onOpen({ kind: 'reschedule', match })}>
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Spielverlegung
      </Button>
    </div>
  );
}

function OpenItemActions({
  item,
  participation,
}: {
  item: OpenItem;
  participation: Participation | null;
}) {
  if (item.kind === 'match') {
    return <ResponseButtons matchId={item.id} participation={participation} />;
  }
  if (item.kind === 'training') return <TrainingChoices sessionId={item.id} />;
  if (item.kind === 'event') return <EventChoices eventId={item.id} />;

  return (
    <Link to="/votes" className={buttonClasses({ size: 'sm' })}>
      <Vote className="h-4 w-4" aria-hidden="true" />
      Zur Abstimmung
    </Link>
  );
}

interface Choice<T extends string> {
  value: T;
  label: string;
  icon: typeof Check;
}

function ChoiceRow<T extends string>({
  choices,
  busy,
  onChoose,
}: {
  choices: Choice<T>[];
  busy: boolean;
  onChoose: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          disabled={busy}
          onClick={() => onChoose(choice.value)}
          className={cn(
            'inline-flex min-h-touch items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <choice.icon className="h-4 w-4" aria-hidden="true" />
          {choice.label}
        </button>
      ))}
    </div>
  );
}

const TRAINING_CHOICES: Choice<AttendanceStatus>[] = [
  { value: 'yes', label: 'Bin dabei', icon: Check },
  { value: 'late', label: 'Komme später', icon: Clock },
  { value: 'no', label: 'Bin nicht dabei', icon: X },
];

function TrainingChoices({ sessionId }: { sessionId: string }) {
  const { toast } = useToast();
  const { profile } = useSession();
  const setAttendance = useSetAttendance();

  async function choose(status: AttendanceStatus) {
    if (setAttendance.isPending) return;
    try {
      await setAttendance.mutateAsync({ sessionId, status, self: profile?.id ?? null });
      toast(status === 'no' ? 'Absage gespeichert' : 'Zusage gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <ChoiceRow
      choices={TRAINING_CHOICES}
      busy={setAttendance.isPending}
      onChoose={(value) => void choose(value)}
    />
  );
}

const EVENT_CHOICES: Choice<EventStatus>[] = [
  { value: 'yes', label: 'Zusage', icon: Check },
  { value: 'no', label: 'Absage', icon: X },
];

function EventChoices({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const { profile } = useSession();
  const setParticipation = useSetEventParticipation();

  async function choose(status: EventStatus) {
    if (setParticipation.isPending) return;
    try {
      const result = await setParticipation.mutateAsync({
        eventId,
        status,
        self: profile?.id ?? null,
      });
      if (result.status === 'ok') {
        toast(status === 'yes' ? 'Zusage gespeichert' : 'Absage gespeichert', 'success');
      } else {
        toast(EVENT_REFUSALS[result.status] ?? 'Das hat nicht geklappt', 'error');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <ChoiceRow
      choices={EVENT_CHOICES}
      busy={setParticipation.isPending}
      onChoose={(value) => void choose(value)}
    />
  );
}
