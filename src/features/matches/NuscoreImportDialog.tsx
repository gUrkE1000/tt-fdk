import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Dialog, FormField, Select, Textarea, useToast } from '../../components/ui';
import { formatShortDayDate, formatTime } from '../../lib/dates';
import { readPdfLines } from '../../lib/pdfText';
import type { TeamWithRoster } from '../teams/api';
import { useSetNuscore, type MatchRow } from './api';
import {
  parseNuscoreList,
  planNuscoreImport,
  type NuscoreEntry,
  type NuscoreKind,
} from './nuscore';

export interface NuscoreImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nur die Mannschaften, die der Nutzer verwalten darf. */
  teams: TeamWithRoster[];
  matches: MatchRow[];
}

interface Source {
  name: string;
  entries: NuscoreEntry[];
}

const KIND_LABEL: Record<NuscoreKind, string> = { code: 'Spiel-Codes', pin: 'Spiel-PINs' };

/**
 * „Codes & PINs Import" (Aufgabe 9.7, Bestandsaufnahme D).
 *
 * click-TT gibt je Mannschaft zwei PDF-Listen heraus. Beide lassen sich hier auf einmal
 * einlesen; übernommen wird erst nach einem Blick auf die Vorschau. Liest sich eine PDF
 * nicht (eingescannt, geschützt), geht derselbe Weg mit eingefügtem Text.
 */
export default function NuscoreImportDialog({
  open,
  onOpenChange,
  teams,
  matches,
}: NuscoreImportDialogProps) {
  const { toast } = useToast();
  const setNuscore = useSetNuscore();

  const [teamId, setTeamId] = useState('');
  const [sources, setSources] = useState<Partial<Record<NuscoreKind, Source>>>({});
  // Beide Listen dürfen gleichzeitig gelesen werden. Das erste Einlesen lädt erst
  // pdfjs nach und dauert; wären die Felder solange gesperrt, liefe die Wahl der
  // zweiten Datei ins Leere.
  const [reading, setReading] = useState<NuscoreKind[]>([]);
  // Je Liste zählt nur das zuletzt begonnene Einlesen — eine neue Datei oder ein
  // Wechsel der Mannschaft macht ein noch laufendes ungültig.
  const ticket = useRef<Record<NuscoreKind, number>>({ code: 0, pin: 0 });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  // Ein Spiel ohne Termin lässt sich keiner Zeile der Liste zuordnen.
  const teamMatches = useMemo(
    () =>
      matches
        .filter(
          (match): match is MatchRow & { dtstart: string } =>
            match.team_id === teamId && match.dtstart !== null,
        )
        .sort((a, b) => a.dtstart.localeCompare(b.dtstart)),
    [matches, teamId],
  );

  const plan = useMemo(() => {
    const entries = [...(sources.code?.entries ?? []), ...(sources.pin?.entries ?? [])];
    return entries.length > 0 ? planNuscoreImport(entries, teamMatches) : null;
  }, [sources, teamMatches]);

  const byId = useMemo(() => new Map(teamMatches.map((match) => [match.id, match])), [teamMatches]);

  function reset() {
    ticket.current = { code: ticket.current.code + 1, pin: ticket.current.pin + 1 };
    setReading([]);
    setSources({});
    setPasteOpen(false);
    setInputKey((key) => key + 1);
  }

  function takeLines(kind: NuscoreKind, name: string, lines: string[]) {
    const entries = parseNuscoreList(lines, kind);
    setSources((current) => ({ ...current, [kind]: { name, entries } }));
    if (entries.length === 0) {
      toast(
        `In „${name}" stehen keine ${KIND_LABEL[kind]} — ist es die richtige Liste?`,
        'error',
      );
    }
  }

  async function onFile(kind: NuscoreKind, file: File) {
    const mine = ++ticket.current[kind];
    const current = () => ticket.current[kind] === mine;
    setReading((kinds) => [...kinds.filter((other) => other !== kind), kind]);
    try {
      const lines = await readPdfLines(file);
      if (current()) takeLines(kind, file.name, lines);
    } catch (error) {
      if (!current()) return;
      toast(
        error instanceof Error
          ? `Die PDF ließ sich nicht lesen: ${error.message}`
          : 'Die PDF ließ sich nicht lesen',
        'error',
      );
    } finally {
      if (current()) setReading((kinds) => kinds.filter((other) => other !== kind));
    }
  }

  async function apply() {
    if (!plan || plan.assignments.length === 0 || reading.length > 0) return;
    try {
      const { saved, failed } = await setNuscore.mutateAsync(plan.assignments);
      toast(
        `${saved} ${saved === 1 ? 'Spiel' : 'Spiele'} ergänzt` +
          (failed > 0 ? `, ${failed} nicht gespeichert` : ''),
        failed > 0 ? 'error' : 'success',
      );
      if (failed === 0) {
        reset();
        onOpenChange(false);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  function fileField(kind: NuscoreKind) {
    const source = sources[kind];
    return (
      <FormField
        label={`${KIND_LABEL[kind]} (PDF)`}
        hint={
          source
            ? `${source.name}: ${source.entries.length} ${source.entries.length === 1 ? 'Eintrag' : 'Einträge'}`
            : kind === 'code'
              ? 'Nur für Heimspiele — die Heimmannschaft legt das Spiel in nuScore an.'
              : 'Für Heim- und Auswärtsspiele.'
        }
      >
        {(p) => (
          <input
            id={p.id}
            aria-describedby={p['aria-describedby']}
            key={`${kind}-${inputKey}`}
            type="file"
            accept="application/pdf,.pdf"
            disabled={!teamId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(kind, file);
            }}
            className="block w-full text-sm text-gray-700 file:mr-3 file:min-h-touch file:rounded-xl file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-white disabled:opacity-50"
          />
        )}
      </FormField>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Codes & PINs importieren"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          <Button
            variant="primary"
            loading={setNuscore.isPending}
            disabled={!plan || plan.assignments.length === 0 || reading.length > 0}
            onClick={() => void apply()}
          >
            Übernehmen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-primary-soft p-3 text-sm text-gray-700">
          Die Listen findest du in click-TT unter <strong>Downloads</strong> — im
          Vereinszugang oder als Mannschaftsführer unter „Meine Mannschaftsführer-Dokumente“.
          Je Mannschaft gibt es eine PDF mit den Spiel-Codes und eine mit den Spiel-PINs.
        </p>

        <FormField label="Mannschaft" required>
          {(p) => (
            <Select
              {...p}
              value={teamId}
              onChange={(event) => {
                setTeamId(event.target.value);
                reset();
              }}
              placeholder="Bitte auswählen"
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
            />
          )}
        </FormField>

        {fileField('code')}
        {fileField('pin')}

        {reading.length > 0 && (
          <p className="text-sm text-gray-500">
            {reading.length > 1 ? 'Die PDFs werden' : 'Die PDF wird'} gelesen …
          </p>
        )}

        <div>
          <button
            type="button"
            className="text-sm font-semibold text-primary disabled:opacity-50"
            disabled={!teamId}
            onClick={() => setPasteOpen((value) => !value)}
          >
            PDF lässt sich nicht lesen? Text einfügen
          </button>
          {pasteOpen && (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-gray-600">
                Die PDF öffnen, alles markieren (Strg+A), kopieren und hier einfügen.
              </p>
              {(['code', 'pin'] as const).map((kind) => (
                <FormField key={kind} label={`${KIND_LABEL[kind]} als Text`}>
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={4}
                      onBlur={(event) => {
                        const text = event.target.value;
                        if (text.trim() !== '') takeLines(kind, 'eingefügter Text', text.split('\n'));
                      }}
                    />
                  )}
                </FormField>
              ))}
            </div>
          )}
        </div>

        {plan && (
          <div className="space-y-3 rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-900">Das würde übernommen:</p>

            {plan.assignments.length === 0 ? (
              <p className="text-sm text-gray-600">
                Nichts Neues — alle gefundenen Werte stehen schon an den Spielen.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 text-sm">
                {plan.assignments.map((assignment) => {
                  const match = byId.get(assignment.matchId);
                  if (!match) return null;
                  return (
                    <li key={assignment.matchId} className="py-2">
                      <p className="font-medium text-gray-900">
                        {formatShortDayDate(match.dtstart)}, {formatTime(match.dtstart)} ·{' '}
                        {match.is_home ? 'gegen' : 'bei'} {match.opponent ?? 'unbekannt'}
                      </p>
                      <p className="text-gray-700">
                        {assignment.code && (
                          <span className="mr-3">
                            Code <span className="font-mono">{assignment.code}</span>
                            {match.nuscore_code && (
                              <span className="text-gray-500"> (bisher {match.nuscore_code})</span>
                            )}
                          </span>
                        )}
                        {assignment.pin && (
                          <span>
                            PIN <span className="font-mono">{assignment.pin}</span>
                            {match.nuscore_pin && (
                              <span className="text-gray-500"> (bisher {match.nuscore_pin})</span>
                            )}
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            {plan.unassigned.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="late">{plan.unassigned.length} nicht zugeordnet</Badge>
                </div>
                <ul className="space-y-0.5 text-sm text-gray-700">
                  {plan.unassigned.map(({ entry, reason }, index) => (
                    <li key={`${entry.kind}:${entry.date}:${index}`}>
                      {entry.date.split('-').reverse().join('.')} · {KIND_LABEL[entry.kind]}{' '}
                      <span className="font-mono">{entry.value}</span> —{' '}
                      {reason === 'ambiguous'
                        ? 'mehrere Spiele an diesem Tag, bitte von Hand eintragen'
                        : 'kein Spiel dieser Mannschaft an diesem Tag'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
