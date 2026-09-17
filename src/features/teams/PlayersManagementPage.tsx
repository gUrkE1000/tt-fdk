import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import {
  Button,
  buttonClasses,
  Card,
  CardBody,
  EmptyState,
  FormField,
  PageHeader,
  PersonPicker,
  useToast,
} from '../../components/ui';
import { useMembers } from '../members/api';
import { useSaveRoster, useTeams, type TeamWithRoster } from './api';

interface Draft {
  regularIds: string[];
  substituteIds: string[];
}

/**
 * Alle Kader auf einer Seite. Im Alltag ändert sich zu Saisonbeginn die Aufteilung
 * mehrerer Mannschaften gleichzeitig; dafür jedes Mal einen Dialog zu öffnen und wieder
 * zu schließen wäre Arbeit ohne Ertrag.
 */
export default function PlayersManagementPage() {
  const { toast } = useToast();
  const teams = useTeams();
  const members = useMembers();
  const saveRoster = useSaveRoster();

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);

  // Die Entwürfe entstehen aus den geladenen Daten und bleiben danach in der Hand des
  // Benutzers, bis er speichert.
  useEffect(() => {
    if (!teams.data) return;
    setDrafts(
      Object.fromEntries(
        teams.data.map((team) => [
          team.id,
          { regularIds: team.regularIds, substituteIds: team.substituteIds },
        ]),
      ),
    );
  }, [teams.data]);

  const memberList = members.data ?? [];
  const people = memberList.map((member) => ({
    id: member.id,
    name: member.full_name ?? '',
    detail: member.qttr != null ? `${member.qttr} QTTR` : undefined,
  }));

  function update(teamId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [teamId]: { ...current[teamId], ...patch } }));
  }

  async function onSave() {
    setSaving(true);
    try {
      for (const team of teams.data ?? []) {
        const draft = drafts[team.id];
        if (!draft) continue;
        if (
          sameIds(draft.regularIds, team.regularIds) &&
          sameIds(draft.substituteIds, team.substituteIds)
        ) {
          continue;
        }

        await saveRoster.mutateAsync({
          teamId: team.id,
          leaderIds: team.leaderIds,
          regularIds: draft.regularIds,
          substituteIds: draft.substituteIds,
        });
      }
      toast('Kader gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  }

  const rows = teams.data ?? [];

  return (
    <div>
      <PageHeader
        title="Mannschaften bearbeiten"
        description="Stamm- und Ersatzspieler aller Mannschaften nebeneinander."
        actions={
          <>
            <Link to="/teams" className={buttonClasses()}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Zurück
            </Link>
            <Button variant="primary" loading={saving} onClick={() => void onSave()}>
              Speichern
            </Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="Noch keine Mannschaften" />
      ) : (
        <div className="space-y-3">
          {rows.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              people={people}
              draft={drafts[team.id] ?? { regularIds: [], substituteIds: [] }}
              onChange={(patch) => update(team.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRow({
  team,
  people,
  draft,
  onChange,
}: {
  team: TeamWithRoster;
  people: { id: string; name: string; detail?: string }[];
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const tooMany = draft.regularIds.length > team.size;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <h3 className="font-bold text-gray-900">{team.name}</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label={`Stammspieler (${draft.regularIds.length}/${team.size})`}
            error={tooMany ? `Maximal ${team.size} Stammspieler` : undefined}
          >
            {(p) => (
              <PersonPicker
                {...p}
                people={people.filter((person) => !draft.substituteIds.includes(person.id))}
                value={draft.regularIds}
                onChange={(ids) => onChange({ regularIds: ids })}
                max={team.size}
              />
            )}
          </FormField>

          <FormField label="Ersatzspieler" hint="Reihenfolge bearbeitest du im Mannschaftsdialog.">
            {(p) => (
              <PersonPicker
                {...p}
                people={people.filter((person) => !draft.regularIds.includes(person.id))}
                value={draft.substituteIds}
                onChange={(ids) => onChange({ substituteIds: ids })}
              />
            )}
          </FormField>
        </div>
      </CardBody>
    </Card>
  );
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
