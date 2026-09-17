import { Users } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, EmptyState } from '../../components/ui';
import { rankingTypeLabel } from '../../lib/labels';
import { useMembers } from '../members/api';
import { useTeams } from '../teams/api';
import { teamSubtitle } from '../teams/schemas';

/**
 * Die Mannschaften aus Sicht eines Mitglieds: wer spielt wo, wer führt die Mannschaft.
 * Ohne Bearbeitung — dafür gibt es `/teams` für Administratoren.
 */
export default function ClubTeamsTab() {
  const teams = useTeams();
  const members = useMembers();

  const nameOf = (id: string) =>
    (members.data ?? []).find((member) => member.id === id)?.full_name ?? 'Unbekannt';

  const rows = (teams.data ?? []).filter((team) => team.active);

  if (rows.length === 0) {
    return <EmptyState icon={Users} title="Noch keine Mannschaften" />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((team) => (
        <Card key={team.id}>
          <CardHeader>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <h3 className="font-bold text-gray-900">{team.name}</h3>
              </div>
              <p className="text-xs text-gray-500">
                {teamSubtitle({
                  size: team.size,
                  ranking: team.ranking,
                  rankingTypeLabel: rankingTypeLabel(team.ranking_type),
                })}
              </p>
            </div>
          </CardHeader>

          <CardBody className="space-y-2 text-sm">
            {(team.leagues ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(team.leagues ?? []).map((league) => (
                  <Badge key={league} tone="neutral">
                    {league}
                  </Badge>
                ))}
              </div>
            )}

            <Line label="Mannschaftsführer" names={team.leaderIds.map(nameOf)} />
            <Line label="Stammspieler" names={team.regularIds.map(nameOf)} />
            <Line label="Ersatzspieler" names={team.substituteIds.map(nameOf)} ordered />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function Line({
  label,
  names,
  ordered,
}: {
  label: string;
  names: string[];
  /** Bei Ersatzspielern ist die Reihenfolge die Aussage, deshalb nummeriert. */
  ordered?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-gray-800">
        {names.length === 0
          ? '—'
          : ordered
            ? names.map((name, index) => `${index + 1}. ${name}`).join(', ')
            : names.join(', ')}
      </p>
    </div>
  );
}
