import { useState } from 'react';
import { BarChart3, Plus } from 'lucide-react';
import {
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  Tabs,
  useToast,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { queryStatus } from '../../lib/queryStatus';
import { useSession } from '../auth/session';
import { useGroups } from '../members/api';
import { useTeams } from '../teams/api';
import {
  useDeletePoll,
  usePollResults,
  usePollVoters,
  usePolls,
  type PollWithDetails,
} from './api';
import { isExpired } from './schemas';
import PollCard from './PollCard';
import PollDialog from './PollDialog';

export default function PollsPage() {
  const { profile, role } = useSession();
  const { toast } = useToast();

  const polls = usePolls();
  const results = usePollResults();
  const voters = usePollVoters();
  const teams = useTeams();
  const groups = useGroups();
  const deletePoll = useDeletePoll();

  const [editing, setEditing] = useState<PollWithDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PollWithDetails | null>(null);

  const canManage = role === 'admin' || role === 'organizer';

  const all = polls.data ?? [];
  const open = all.filter((poll) => !isExpired(poll));
  const expired = all.filter((poll) => isExpired(poll));

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await deletePoll.mutateAsync(toDelete.id);
      toast(`${toDelete.title} wurde gelöscht`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  const status = queryStatus(polls, voters);

  function list(rows: PollWithDetails[], emptyText: string) {
    if (status.loading) return <LoadingState />;
    if (status.error) return <ErrorState onRetry={status.retry} />;
    if (rows.length === 0) {
      return <EmptyState icon={BarChart3} title="Keine Umfragen" description={emptyText} />;
    }

    return (
      <div className="space-y-3">
        {rows.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            results={results.data ?? []}
            voters={voters.data ?? []}
            profileId={profile?.id ?? null}
            canManage={canManage}
            onEdit={() => {
              setEditing(poll);
              setDialogOpen(true);
            }}
            onDelete={() => setToDelete(poll)}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Umfragen"
        description="Abstimmungen und Helferlisten für den Verein."
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
              Umfrage anlegen
            </Button>
          ) : undefined
        }
      />

      <Tabs
        tabs={[
          {
            value: 'open',
            label: `Offene Umfragen (${open.length})`,
            content: list(open, 'Sobald eine Umfrage läuft, steht sie hier.'),
          },
          {
            value: 'expired',
            label: `Abgelaufene (${expired.length})`,
            content: list(expired, 'Hier sammeln sich die Umfragen, die vorbei sind.'),
          },
        ]}
      />

      <PollDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        poll={editing}
        teams={teams.data ?? []}
        groups={groups.data ?? []}
      />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
        title={`${toDelete?.title ?? 'Umfrage'} löschen?`}
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
          Mit der Umfrage verschwinden auch alle abgegebenen Stimmen.
        </p>
      </Dialog>
    </div>
  );
}
