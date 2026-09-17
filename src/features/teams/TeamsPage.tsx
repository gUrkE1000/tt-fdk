import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, Users, SlidersHorizontal } from 'lucide-react';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  Table,
  useToast,
} from '../../components/ui';
import { rankingTypeLabel } from '../../lib/labels';
import { useMembers } from '../members/api';
import { useDeleteTeam, useTeams, type TeamWithRoster } from './api';
import { teamSubtitle } from './schemas';
import TeamDialog from './TeamDialog';

export default function TeamsPage() {
  const { toast } = useToast();
  const teams = useTeams();
  const members = useMembers();
  const deleteTeam = useDeleteTeam();

  const [editing, setEditing] = useState<TeamWithRoster | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TeamWithRoster | null>(null);

  const memberList = members.data ?? [];
  const nameOf = (id: string) =>
    memberList.find((member) => member.id === id)?.full_name ?? 'Unbekannt';

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await deleteTeam.mutateAsync(toDelete.id);
      toast(`${toDelete.name} wurde gelöscht`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  function actions(team: TeamWithRoster) {
    return (
      <div className="flex items-center justify-end gap-1">
        <IconButton
          icon={Pencil}
          label={`${team.name} bearbeiten`}
          onClick={() => {
            setEditing(team);
            setDialogOpen(true);
          }}
        />
        <IconButton
          icon={Trash2}
          label={`${team.name} löschen`}
          tone="danger"
          onClick={() => setToDelete(team)}
        />
      </div>
    );
  }

  function nameCell(team: TeamWithRoster) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <span className="font-semibold text-gray-900">{team.name}</span>
          {!team.active && <Badge tone="removed">inaktiv</Badge>}
        </div>
        <p className="text-xs text-gray-500">
          {teamSubtitle({
            size: team.size,
            ranking: team.ranking,
            rankingTypeLabel: rankingTypeLabel(team.ranking_type),
          })}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Mannschaften"
        description="Kader, Ersatzreihenfolge und Spielplan-Abgleich."
        actions={
          <>
            {/* Ein Link, der wie ein Button aussieht — kein Button, der navigiert.
                Mit der Tastatur und im neuen Tab verhält er sich dann richtig. */}
            <Link to="/teams/players-management" className={buttonClasses()}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Mannschaften bearbeiten
            </Link>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Mannschaft anlegen
            </Button>
          </>
        }
      />

      <Table
        columns={[
          { key: 'name', header: 'Name', cell: nameCell },
          {
            key: 'leaders',
            header: 'Mannschaftsführer',
            cell: (team: TeamWithRoster) => team.leaderIds.map(nameOf).join(', ') || '—',
          },
          {
            key: 'players',
            header: 'Spieler',
            cell: (team: TeamWithRoster) => `${team.regularIds.length} / ${team.size}`,
          },
          {
            key: 'substitutes',
            header: 'Ersatzspieler',
            cell: (team: TeamWithRoster) => `${team.substituteIds.length}`,
          },
          {
            key: 'leagues',
            header: 'Ligen',
            cell: (team: TeamWithRoster) => (team.leagues ?? []).join(', ') || '—',
          },
          { key: 'actions', header: 'Aktion', align: 'right', cell: actions },
        ]}
        rows={teams.data ?? []}
        rowKey={(team) => team.id}
        mobileCard={(team) => (
          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                {nameCell(team)}
                {actions(team)}
              </div>
              <p className="text-sm text-gray-500">
                {team.regularIds.length} von {team.size} Stammspielern ·{' '}
                {team.substituteIds.length} Ersatz
              </p>
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={Users}
            title="Noch keine Mannschaften"
            description="Lege eine Mannschaft an, um Spieltermine und Aufstellungen zu verwalten."
          />
        }
      />

      <TeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        team={editing}
        members={memberList}
      />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`${toDelete?.name ?? 'Mannschaft'} löschen?`}
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
          Mit der Mannschaft verschwinden auch ihre Spieltermine und alle Rückmeldungen dazu.
          Soll die Mannschaft nur nicht mehr auftauchen, setze sie stattdessen auf „inaktiv“.
        </p>
      </Dialog>
    </div>
  );
}
