import { useMemo, useState } from 'react';
import { Badge, Button, Checkbox, Dialog, FormField, Textarea, useToast } from '../../components/ui';
import { rankingTypeLabel } from '../../lib/labels';
import { readPdfLines } from '../../lib/pdfText';
import { useMembers, useRankings } from '../members/api';
import { useTeams } from './api';
import { parseMeldung, planMeldung, type Meldung, type PlannedTeam } from './meldung';
import { useApplyMeldung, type ApplyMeldungResult } from './meldungApi';

export interface MeldungImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mannschaften aus der Mannschaftsmeldung von click-TT anlegen.
 *
 * Einmal je Halbserie: PDF hochladen, Vorschau prüfen, übernehmen. Angelegt oder
 * aktualisiert werden Mannschaften (Größe, Liga, Nummer), Ränge, Kader und
 * Mannschaftsführung; auf Wunsch auch die QTTR-Werte. Mitglieder legt der Import nicht
 * an — wer in der Meldung steht, aber nicht im Verein, erscheint als „nicht gefunden".
 */
export default function MeldungImportDialog({ open, onOpenChange }: MeldungImportDialogProps) {
  const { toast } = useToast();
  const members = useMembers();
  const teams = useTeams();
  const rankings = useRankings();
  const apply = useApplyMeldung();

  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [source, setSource] = useState('');
  const [reading, setReading] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [updateQttr, setUpdateQttr] = useState(true);
  const [removeStale, setRemoveStale] = useState(true);
  const [result, setResult] = useState<ApplyMeldungResult | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const plan = useMemo(() => {
    if (!meldung || meldung.teams.length === 0) return null;
    return planMeldung(
      meldung,
      (members.data ?? []).map((member) => ({
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        qttr: member.qttr,
      })),
      teams.data ?? [],
      rankings.data ?? [],
    );
  }, [meldung, members.data, teams.data, rankings.data]);

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? '';
  }, [members.data]);

  function reset() {
    setMeldung(null);
    setSource('');
    setResult(null);
    setPasteOpen(false);
    setInputKey((key) => key + 1);
  }

  function takeLines(name: string, lines: string[]) {
    const parsed = parseMeldung(lines);
    setMeldung(parsed);
    setSource(name);
    setResult(null);
    if (parsed.teams.length === 0) {
      toast(`In „${name}" steht keine Mannschaft — ist es die Mannschaftsmeldung?`, 'error');
    }
  }

  async function onFile(file: File) {
    setReading(true);
    try {
      takeLines(file.name, await readPdfLines(file));
    } catch (error) {
      toast(
        error instanceof Error
          ? `Die PDF ließ sich nicht lesen: ${error.message}`
          : 'Die PDF ließ sich nicht lesen',
        'error',
      );
    } finally {
      setReading(false);
    }
  }

  async function onApply() {
    if (!plan) return;
    try {
      const outcome = await apply.mutateAsync({
        plan,
        updateQttr,
        removeStaleRankings: removeStale,
      });
      const failed = outcome.teams.filter((team) => team.action === 'failed').length;
      toast(
        failed > 0
          ? `${failed} ${failed === 1 ? 'Mannschaft' : 'Mannschaften'} nicht übernommen`
          : 'Mannschaftsmeldung übernommen',
        failed > 0 ? 'error' : 'success',
      );
      setResult(outcome);
      setMeldung(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Übernehmen fehlgeschlagen', 'error');
    }
  }

  const counts = plan
    ? {
        created: plan.teams.filter((team) => !team.existing).length,
        updated: plan.teams.filter((team) => team.existing).length,
        matched: plan.teams.reduce(
          (sum, team) => sum + team.players.filter((player) => player.profileId).length,
          0,
        ),
        missing: plan.teams.reduce(
          (sum, team) => sum + team.players.filter((player) => !player.profileId).length,
          0,
        ),
        qttr: plan.teams.reduce(
          (sum, team) => sum + team.players.filter((player) => player.qttrChange).length,
          0,
        ),
      }
    : null;

  function teamCard(team: PlannedTeam) {
    const { meldung: head, existing } = team;
    return (
      <li key={`${head.rankingType}-${head.number}`} className="space-y-1.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-gray-900">{existing?.name ?? head.name}</p>
          {existing ? <Badge tone="info">wird aktualisiert</Badge> : <Badge tone="yes">neu</Badge>}
        </div>
        <p className="text-sm text-gray-600">
          {rankingTypeLabel(head.rankingType)} · {head.size}er · Mannschaft {head.number}
          {head.league ? ` · ${head.league}` : ''}
        </p>
        <p className="text-sm text-gray-600">
          Mannschaftsführung:{' '}
          {team.leaderId
            ? nameOf(team.leaderId)
            : head.leader
              ? `${head.leader.firstName} ${head.leader.lastName} (kein Mitglied gefunden — bleibt wie bisher)`
              : 'nicht angegeben'}
        </p>
        <ol className="space-y-0.5 text-sm">
          {team.players.map((player) => (
            <li
              key={`${player.team}.${player.position}`}
              className={player.profileId ? 'text-gray-700' : 'text-status-no'}
            >
              <span className="font-mono text-gray-500">
                {player.team}.{player.position}
              </span>{' '}
              {player.firstName} {player.lastName}
              {player.qttr !== null && <span className="text-gray-500"> · {player.qttr}</span>}
              {player.status && <span className="text-gray-500"> · {player.status}</span>}
              {' — '}
              {player.profileId
                ? player.kind === 'regular'
                  ? 'Stamm'
                  : 'Ersatz'
                : player.problem === 'ambiguous'
                  ? 'mehrere Mitglieder mit diesem Namen'
                  : 'kein Mitglied gefunden'}
              {player.qttrChange && (
                <span className="text-gray-500">
                  {' '}
                  (QTTR {player.qttrChange.from ?? '–'} → {player.qttrChange.to})
                </span>
              )}
            </li>
          ))}
        </ol>
      </li>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Mannschaftsmeldung übernehmen"
      size="lg"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          <Button
            variant="primary"
            loading={apply.isPending}
            disabled={!plan}
            onClick={() => void onApply()}
          >
            Übernehmen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-primary-soft p-3 text-sm text-gray-700">
          Die Mannschaftsmeldung findest du in click-TT im Vereinszugang unter{' '}
          <strong>Downloads</strong>. Daraus entstehen die Mannschaften mit Größe und Liga, die
          Ränge und der Kader: die ersten Spieler als Stammspieler, alle weiteren als Ersatz in
          der Reihenfolge der Meldung. Kontaktdaten aus der PDF werden nicht übernommen.
        </p>

        <FormField
          label="Mannschaftsmeldung (PDF)"
          hint={
            meldung
              ? `${source}: ${meldung.teams.length} Mannschaften, ${meldung.players.length} Spieler` +
                (meldung.season ? ` · Saison ${meldung.season}` : '')
              : undefined
          }
        >
          {(p) => (
            <input
              id={p.id}
              aria-describedby={p['aria-describedby']}
              key={inputKey}
              type="file"
              accept="application/pdf,.pdf"
              disabled={reading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
              }}
              className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-touch file:rounded-xl file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-white disabled:opacity-50"
            />
          )}
        </FormField>

        {reading && <p className="text-sm text-gray-500">Die PDF wird gelesen …</p>}

        <div>
          <button
            type="button"
            className="text-sm font-semibold text-primary"
            onClick={() => setPasteOpen((value) => !value)}
          >
            PDF lässt sich nicht lesen? Text einfügen
          </button>
          {pasteOpen && (
            <FormField label="Text der Mannschaftsmeldung" className="mt-2">
              {(p) => (
                <Textarea
                  {...p}
                  rows={5}
                  onBlur={(event) => {
                    const text = event.target.value;
                    if (text.trim() !== '') takeLines('eingefügter Text', text.split('\n'));
                  }}
                />
              )}
            </FormField>
          )}
        </div>

        {plan && counts && (
          <div className="space-y-3 rounded-xl bg-gray-50 p-3">
            <div className="flex flex-wrap gap-2">
              {counts.created > 0 && <Badge tone="yes">{counts.created} neu</Badge>}
              {counts.updated > 0 && <Badge tone="info">{counts.updated} aktualisiert</Badge>}
              <Badge tone="neutral">{counts.matched} Spieler zugeordnet</Badge>
              {counts.missing > 0 && <Badge tone="late">{counts.missing} nicht gefunden</Badge>}
            </div>

            {counts.missing > 0 && (
              <p className="text-sm text-gray-700">
                Nicht gefundene Spieler kommen nicht in den Kader. Lege sie unter{' '}
                <em>Mitglieder</em> an (oder korrigiere die Schreibweise des Namens) und lies die
                Meldung danach noch einmal ein.
              </p>
            )}

            <ul className="divide-y divide-gray-200">{plan.teams.map(teamCard)}</ul>

            {plan.orphans.length > 0 && (
              <p className="text-sm text-status-no">
                {plan.orphans.length} Spieler ließen sich keiner Mannschaft zuordnen (Rang ohne
                eindeutigen Mannschaftskopf):{' '}
                {plan.orphans
                  .map((player) => `${player.team}.${player.position} ${player.lastName}`)
                  .join(', ')}
              </p>
            )}

            <div className="space-y-2">
              {counts.qttr > 0 && (
                <Checkbox
                  checked={updateQttr}
                  onCheckedChange={setUpdateQttr}
                  label={`${counts.qttr} QTTR-Werte aus der Meldung übernehmen`}
                />
              )}
              {plan.staleRankings.length > 0 && (
                <Checkbox
                  checked={removeStale}
                  onCheckedChange={setRemoveStale}
                  label={`${plan.staleRankings.length} alte Ränge entfernen`}
                  hint={`Mitglieder mit Rang, die in dieser Meldung nicht mehr stehen: ${plan.staleRankings
                    .map((ranking) => nameOf(ranking.profile_id))
                    .filter(Boolean)
                    .join(', ')}`}
                />
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Ergebnis</p>
            <ul className="mt-1.5 space-y-0.5">
              {result.teams.map((team) => (
                <li key={team.team}>
                  {team.team}:{' '}
                  {team.action === 'created'
                    ? 'angelegt'
                    : team.action === 'updated'
                      ? 'aktualisiert'
                      : 'fehlgeschlagen'}
                  {team.detail ? ` — ${team.detail}` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-1.5">
              {result.rankings} Ränge gesetzt
              {result.removedRankings > 0 ? `, ${result.removedRankings} alte entfernt` : ''}
              {result.qttr > 0 ? `, ${result.qttr} QTTR-Werte aktualisiert` : ''}.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
