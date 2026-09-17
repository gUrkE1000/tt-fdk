import { CheckCircle2, Pencil, Trash2, Users } from 'lucide-react';
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  Table,
  type TableColumn,
} from '../../components/ui';
import { RANKING_TYPE_LABELS, formatRanking, roleLabel, statusLabel } from '../../lib/labels';
import type { BadgeTone } from '../../components/ui';
import type { Enums } from '../../lib/database.types';
import type { GroupWithMembers, Member, MemberRanking } from './api';

const STATUS_TONE: Record<Enums<'member_status'>, BadgeTone> = {
  active: 'yes',
  pending_approval: 'late',
  unconfirmed: 'open',
};

export interface MemberTableProps {
  members: Member[];
  rankings: MemberRanking[];
  groups: GroupWithMembers[];
  onEdit: (member: Member) => void;
  onActivate: (member: Member) => void;
  onDelete: (member: Member) => void;
}

export default function MemberTable({
  members,
  rankings,
  groups,
  onEdit,
  onActivate,
  onDelete,
}: MemberTableProps) {
  const columns: TableColumn<Member>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (member) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900">{member.full_name}</span>
          {member.qttr != null && <Badge tone="primary">{member.qttr} QTTR</Badge>}
          {member.no_games && <Badge tone="neutral">kein Spielbetrieb</Badge>}
        </div>
      ),
    },
    { key: 'email', header: 'E-Mail', cell: (member) => member.email ?? '—' },
    { key: 'role', header: 'Rolle', cell: (member) => roleLabel(member.role) },
    {
      key: 'status',
      header: 'Status',
      cell: (member) => <Badge tone={STATUS_TONE[member.status]}>{statusLabel(member.status)}</Badge>,
    },
    {
      key: 'ranking',
      header: 'Ränge',
      cell: (member) => rankingSummary(member.id, rankings) || '—',
    },
    {
      key: 'groups',
      header: 'Gruppen',
      cell: (member) => groupNames(member.id, groups).join(', ') || '—',
    },
    {
      key: 'actions',
      header: 'Aktion',
      align: 'right',
      cell: (member) => <RowActions member={member} onEdit={onEdit} onActivate={onActivate} onDelete={onDelete} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={members}
      rowKey={(member) => member.id}
      mobileCard={(member) => (
        <Card>
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{member.full_name}</p>
                <p className="truncate text-sm text-gray-500">{member.email ?? 'ohne E-Mail'}</p>
              </div>
              <RowActions
                member={member}
                onEdit={onEdit}
                onActivate={onActivate}
                onDelete={onDelete}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={STATUS_TONE[member.status]}>{statusLabel(member.status)}</Badge>
              <Badge tone="neutral">{roleLabel(member.role)}</Badge>
              {member.qttr != null && <Badge tone="primary">{member.qttr} QTTR</Badge>}
            </div>
          </CardBody>
        </Card>
      )}
      empty={
        <EmptyState
          icon={Users}
          title="Keine Mitglieder gefunden"
          description="Setze die Filter zurück oder lege ein neues Mitglied an."
        />
      }
    />
  );
}

function RowActions({
  member,
  onEdit,
  onActivate,
  onDelete,
}: {
  member: Member;
  onEdit: (member: Member) => void;
  onActivate: (member: Member) => void;
  onDelete: (member: Member) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {member.status === 'pending_approval' && (
        <IconButton
          icon={CheckCircle2}
          label={`${member.full_name} freischalten`}
          tone="primary"
          onClick={() => onActivate(member)}
        />
      )}
      <IconButton icon={Pencil} label={`${member.full_name} bearbeiten`} onClick={() => onEdit(member)} />
      <IconButton
        icon={Trash2}
        label={`${member.full_name} löschen`}
        tone="danger"
        onClick={() => onDelete(member)}
      />
    </div>
  );
}

/** „Erwachsene 1.2 · Senioren 40 2.1" — kurz genug für eine Tabellenspalte. */
export function rankingSummary(profileId: string, rankings: MemberRanking[]): string {
  return rankings
    .filter((ranking) => ranking.profile_id === profileId)
    .map(
      (ranking) =>
        `${RANKING_TYPE_LABELS[ranking.ranking_type]} ${formatRanking(
          ranking.team_number,
          ranking.position_number,
        )}`,
    )
    .join(' · ');
}

export function groupNames(profileId: string, groups: GroupWithMembers[]): string[] {
  return groups.filter((group) => group.memberIds.includes(profileId)).map((group) => group.name);
}
