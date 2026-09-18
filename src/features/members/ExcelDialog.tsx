import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Tabs,
  useToast,
} from '../../components/ui';
import { useGroups, useMembers, useRankings } from './api';
import { useTrainings } from '../trainings/api';
import { formatRanking } from '../../lib/labels';
import {
  HEADERS,
  memberToRow,
  parseMemberRows,
  planImport,
  TEMPLATE_EXAMPLE,
  type ImportPlan,
  type RowProblem,
} from './excel';
import { summarizeImport, useRunImport, type ImportOutcome } from './importApi';
import { buildWorkbook, downloadBlob, exportFilename, readWorkbook } from './workbook';

export interface ExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * „Excel Import & Update" (Aufgabe 9.5, Bestandsaufnahme G).
 *
 * Drei Wege, aber nur ein Dateiformat: Die Vorlage, der Export und der Upload haben
 * dieselben Spalten. Deshalb ist „herunterladen, bearbeiten, hochladen" kein eigener
 * Weg, sondern derselbe — was den Umzug aus dem TT-Planer und die jährliche Pflege
 * gleichermaßen abdeckt.
 *
 * Hochgeladen wird nichts blind: Erst zeigt der Dialog, was passieren würde.
 */
export default function ExcelDialog({ open, onOpenChange }: ExcelDialogProps) {
  const { toast } = useToast();
  const members = useMembers();
  const rankings = useRankings();
  const groups = useGroups();
  const trainings = useTrainings();
  const runImport = useRunImport();

  const fileInput = useRef<HTMLInputElement>(null);

  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [problems, setProblems] = useState<RowProblem[]>([]);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const [invite, setInvite] = useState(true);
  const [reading, setReading] = useState(false);

  const memberList = members.data ?? [];

  const exportContext = useMemo(() => {
    const rankingMap = new Map<string, string>();
    for (const row of rankings.data ?? []) {
      // Ein Mitglied kann mehrere Ränge haben; die Datei hat eine Spalte. Der erste
      // gefundene gewinnt — mehr wäre eine Vorlage, die niemand ausfüllt.
      if (!rankingMap.has(row.profile_id)) {
        rankingMap.set(row.profile_id, formatRanking(row.team_number, row.position_number));
      }
    }

    const groupMap = new Map<string, string[]>();
    for (const group of groups.data ?? []) {
      for (const id of group.memberIds) {
        groupMap.set(id, [...(groupMap.get(id) ?? []), group.name]);
      }
    }

    const trainingMap = new Map<string, string[]>();
    for (const training of trainings.data ?? []) {
      for (const id of training.memberIds) {
        trainingMap.set(id, [...(trainingMap.get(id) ?? []), training.name]);
      }
    }

    return { rankings: rankingMap, groups: groupMap, trainings: trainingMap };
  }, [rankings.data, groups.data, trainings.data]);

  async function downloadTemplate() {
    try {
      const blob = await buildWorkbook([TEMPLATE_EXAMPLE]);
      downloadBlob(blob, 'mitglieder-vorlage.xlsx');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Die Vorlage ließ sich nicht bauen', 'error');
    }
  }

  async function downloadMembers() {
    try {
      const rows = memberList.map((member) => memberToRow(member, exportContext));
      const blob = await buildWorkbook(rows);
      downloadBlob(blob, exportFilename('mitglieder'));
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Der Export ließ sich nicht bauen', 'error');
    }
  }

  async function onFile(file: File) {
    setReading(true);
    setOutcomes(null);

    try {
      const rows = await readWorkbook(await file.arrayBuffer());
      const parsed = parseMemberRows(rows);

      setProblems(parsed.problems);
      setPlan(
        planImport(
          parsed.members,
          memberList.map((member) => ({
            id: member.id,
            email: member.email,
            member_number: member.member_number,
            full_name: member.full_name,
          })),
        ),
      );
    } catch (error) {
      setPlan(null);
      setProblems([]);
      toast(error instanceof Error ? error.message : 'Die Datei ließ sich nicht lesen', 'error');
    } finally {
      setReading(false);
    }
  }

  async function apply() {
    if (!plan) return;

    try {
      const result = await runImport.mutateAsync({
        create: plan.create,
        update: plan.update,
        groupIds: new Map(
          (groups.data ?? []).map((group) => [group.name.toLowerCase(), group.id]),
        ),
        trainingIds: new Map(
          (trainings.data ?? []).map((training) => [training.name.toLowerCase(), training.id]),
        ),
        invite,
      });

      setOutcomes(result);
      setPlan(null);

      const summary = summarizeImport(result);
      toast(
        `${summary.created} angelegt, ${summary.updated} aktualisiert` +
          (summary.failed > 0 ? `, ${summary.failed} fehlgeschlagen` : ''),
        summary.failed > 0 ? 'error' : 'success',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Der Import brach ab', 'error');
    }
  }

  function reset() {
    setPlan(null);
    setProblems([]);
    setOutcomes(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  const uploadTab = (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx"
        aria-label="Excel-Datei"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
        className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-touch file:rounded-xl file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-white"
      />

      {reading && <p className="text-sm text-gray-500">Die Datei wird gelesen …</p>}

      {problems.length > 0 && (
        <div className="rounded-xl border border-status-no-soft bg-status-no-soft p-3">
          <p className="text-sm font-semibold text-status-no">
            {problems.length} {problems.length === 1 ? 'Zeile stimmt' : 'Zeilen stimmen'} nicht
          </p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-gray-700">
            {problems.slice(0, 20).map((problem) => (
              <li key={`${problem.row}:${problem.column}`}>
                Zeile {problem.row}, {problem.column}: {problem.message}
              </li>
            ))}
          </ul>
          {problems.length > 20 && (
            <p className="mt-1 text-xs text-gray-500">… und {problems.length - 20} weitere.</p>
          )}
          <p className="mt-2 text-sm text-gray-700">
            Diese Zeilen bleiben liegen. Der Rest lässt sich trotzdem übernehmen.
          </p>
        </div>
      )}

      {plan && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-900">Das würde passieren:</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="yes">{plan.create.length} neu anlegen</Badge>
            <Badge tone="info">{plan.update.length} aktualisieren</Badge>
            {plan.ambiguous.length > 0 && (
              <Badge tone="late">{plan.ambiguous.length} unklar</Badge>
            )}
          </div>

          {plan.ambiguous.length > 0 && (
            <p className="text-sm text-gray-700">
              Bei {plan.ambiguous.length}{' '}
              {plan.ambiguous.length === 1 ? 'Zeile passt' : 'Zeilen passen'} der Name auf mehrere
              Mitglieder. Sie bleiben unangetastet — trage dort eine E-Mail oder Mitgliedsnummer
              ein, dann ist es eindeutig.
            </p>
          )}

          <Checkbox
            checked={invite}
            onCheckedChange={setInvite}
            label="Neue Mitglieder mit E-Mail einladen"
            hint="Sie bekommen sofort einen Anmeldelink. Ohne Haken lassen sie sich später einzeln einladen."
          />

          <div className="flex gap-2">
            <Button variant="primary" loading={runImport.isPending} onClick={() => void apply()}>
              Übernehmen
            </Button>
            <Button onClick={reset}>Verwerfen</Button>
          </div>
        </div>
      )}

      {outcomes && (
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-900">Ergebnis</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-gray-700">
            {outcomes.map((entry, index) => (
              <li key={`${entry.name}:${index}`}>
                {entry.name}:{' '}
                {entry.action === 'created'
                  ? `angelegt${entry.invited ? ' und eingeladen' : ''}`
                  : entry.action === 'updated'
                    ? 'aktualisiert'
                    : `fehlgeschlagen — ${entry.detail}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Excel-Import und -Update"
      footer={<Button onClick={() => onOpenChange(false)}>Schließen</Button>}
    >
      <Tabs
        tabs={[
          {
            value: 'import',
            label: 'Import',
            content: (
              <div className="space-y-4">
                <ol className="space-y-1.5 text-sm text-gray-700">
                  <li>1. Vorlage herunterladen.</li>
                  <li>2. Mitglieder eintragen — eine Zeile je Person.</li>
                  <li>3. Datei hier hochladen.</li>
                </ol>

                <Button onClick={() => void downloadTemplate()}>
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                  Vorlage herunterladen
                </Button>

                <p className="text-sm text-gray-600">
                  Spalten: {HEADERS.join(' · ')}. Rolle, Geschlecht und Geburtstag stehen deutsch in
                  der Datei („Mannschaftsführer", „weiblich", „06.05.1988"), der Rang als „1.2".
                </p>

                {uploadTab}
              </div>
            ),
          },
          {
            value: 'update',
            label: 'Update',
            content: (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Die aktuelle Mitgliederliste herunterladen, in Excel bearbeiten und wieder
                  hochladen. Zugeordnet wird über E-Mail, sonst Mitgliedsnummer, sonst den Namen —
                  neue Zeilen legen neue Mitglieder an.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void downloadMembers()}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Mitglieder herunterladen ({memberList.length})
                  </Button>
                  <Button onClick={() => fileInput.current?.click()}>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Bearbeitete Datei hochladen
                  </Button>
                </div>

                {uploadTab}
              </div>
            ),
          },
        ]}
      />
    </Dialog>
  );
}
