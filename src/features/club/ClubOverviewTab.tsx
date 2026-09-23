import { useMemo } from 'react';
import { Card, CardBody, EmptyState, Table } from '../../components/ui';
import { Layers, Users } from 'lucide-react';
import { formatDate } from '../../lib/dates';
import { roleLabel } from '../../lib/labels';
import { useAdminMembers, useGroups, type GroupWithMembers, type Member } from '../members/api';
import { useKeys } from '../keys/api';
import { useTeams } from '../teams/api';
import { useTrainings } from '../trainings/api';
import { assignmentText, memberAssignments, NO_ASSIGNMENTS } from './assignments';

/**
 * Die Vereinsübersicht des TT-Planers (Bestandsaufnahme I): eine Tabelle aller Mitglieder
 * mit ihren Zuordnungen, darunter die Gruppen.
 *
 * Training, Mannschaft, Ersatz und Schlüssel stehen für jedes Mitglied nebeneinander.
 * Genau das ist der Zweck der Seite: Sie beantwortet Fragen, für die man sonst vier
 * Listen öffnen müsste — etwa „wer hat einen Schlüssel und trainiert donnerstags?".
 */
export default function ClubOverviewTab() {
  const members = useAdminMembers();
  const groups = useGroups();
  const trainings = useTrainings();
  const teams = useTeams();
  const keys = useKeys();

  const rows = members.data ?? [];

  const assignments = useMemo(
    () =>
      memberAssignments({
        trainings: trainings.data ?? [],
        teams: teams.data ?? [],
        keys: keys.data ?? [],
      }),
    [trainings.data, teams.data, keys.data],
  );

  const forMember = (id: string) => assignments.get(id) ?? NO_ASSIGNMENTS;

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
            {
              key: 'training',
              header: 'Training',
              cell: (member: Member) => assignmentText(forMember(member.id).trainings),
            },
            {
              key: 'team',
              header: 'Mannschaft',
              cell: (member: Member) => assignmentText(forMember(member.id).teams),
            },
            {
              key: 'sub',
              header: 'Ersatz',
              cell: (member: Member) => assignmentText(forMember(member.id).substituteFor),
            },
            {
              key: 'keys',
              header: 'Schlüssel',
              cell: (member: Member) => assignmentText(forMember(member.id).keys),
            },
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
