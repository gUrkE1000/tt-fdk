import { Card, CardBody, EmptyState, Table } from '../../components/ui';
import { Layers, Users } from 'lucide-react';
import { formatDate } from '../../lib/dates';
import { roleLabel } from '../../lib/labels';
import { useGroups, useMembers, type GroupWithMembers, type Member } from '../members/api';

/**
 * Die Vereinsübersicht des TT-Planers (Bestandsaufnahme I): eine Tabelle aller Mitglieder
 * mit ihren Zuordnungen, darunter die Gruppen.
 *
 * Die Spalten Training, Mannschaft und Ersatz stehen schon hier, obwohl sie erst in
 * Phase 6 und 3 gefüllt werden. Wer die Seite heute sieht, erkennt daran, was noch kommt —
 * und die Spaltenbreiten springen später nicht.
 */
export default function ClubOverviewTab() {
  const members = useMembers();
  const groups = useGroups();

  const rows = members.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 font-bold text-gray-900">Mitglieder</h3>
        <Table
          columns={[
            {
              key: 'name',
              header: 'Name',
              cell: (member: Member) => (
                <span className="font-semibold text-gray-900">{member.full_name}</span>
              ),
            },
            {
              key: 'number',
              header: 'Mitglieds-Nr.',
              cell: (member: Member) => member.member_number ?? '—',
            },
            {
              key: 'since',
              header: 'Zugang seit',
              cell: (member: Member) =>
                member.auth_linked_at ? formatDate(member.auth_linked_at) : '—',
            },
            { key: 'role', header: 'Rolle', cell: (member: Member) => roleLabel(member.role) },
            { key: 'training', header: 'Training', cell: () => '—' },
            { key: 'team', header: 'Mannschaft', cell: () => '—' },
            { key: 'sub', header: 'Ersatz', cell: () => '—' },
          ]}
          rows={rows}
          rowKey={(member) => member.id}
          mobileCard={(member) => (
            <Card>
              <CardBody>
                <p className="font-semibold text-gray-900">{member.full_name}</p>
                <p className="text-sm text-gray-500">
                  {roleLabel(member.role)}
                  {member.member_number && ` · Nr. ${member.member_number}`}
                  {member.auth_linked_at && ` · Zugang seit ${formatDate(member.auth_linked_at)}`}
                </p>
              </CardBody>
            </Card>
          )}
          empty={<EmptyState icon={Users} title="Noch keine Mitglieder" />}
        />
      </div>

      <div>
        <h3 className="mb-2 font-bold text-gray-900">Gruppen</h3>
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
              cell: (group: GroupWithMembers) =>
                memberNames(group, rows).join(', ') || 'noch niemand zugeordnet',
            },
          ]}
          rows={groups.data ?? []}
          rowKey={(group) => group.id}
          mobileCard={(group) => (
            <Card>
              <CardBody>
                <p className="font-semibold text-gray-900">{group.name}</p>
                <p className="text-sm text-gray-500">
                  {memberNames(group, rows).join(', ') || 'noch niemand zugeordnet'}
                </p>
              </CardBody>
            </Card>
          )}
          empty={<EmptyState icon={Layers} title="Noch keine Gruppen" />}
        />
      </div>
    </div>
  );
}

function memberNames(group: GroupWithMembers, members: Member[]): string[] {
  return members
    .filter((member) => group.memberIds.includes(member.id))
    .map((member) => member.full_name ?? '')
    .filter(Boolean);
}
