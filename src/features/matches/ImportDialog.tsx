import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, FormField, Input, Select, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { useUpdateTeam, type TeamWithRoster } from '../teams/api';
import { validateCalendarUrl } from './schemas';

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamWithRoster[];
}

interface ImportResult {
  team: string;
  status: 'success' | 'warning' | 'failed';
  inserted: number;
  rescheduled: number;
  updated: number;
  deactivated: number;
  message?: string;
}

/** „2 neu, 1 verlegt" — leere Zahlen weggelassen, damit die Meldung lesbar bleibt. */
export function summarizeImport(results: readonly ImportResult[]): string {
  const total = results.reduce(
    (sum, result) => ({
      inserted: sum.inserted + result.inserted,
      rescheduled: sum.rescheduled + result.rescheduled,
      updated: sum.updated + result.updated,
      deactivated: sum.deactivated + result.deactivated,
    }),
    { inserted: 0, rescheduled: 0, updated: 0, deactivated: 0 },
  );

  const parts = [
    [total.inserted, 'neu'],
    [total.rescheduled, 'verlegt'],
    [total.updated, 'geändert'],
    [total.deactivated, 'entfallen'],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, label]) => `${count} ${label}`);

  return parts.length > 0 ? parts.join(', ') : 'Spielplan war bereits auf Stand';
}

/**
 * Spielplan einer Mannschaft aus myTischtennis holen.
 *
 * Der Dialog speichert die Adresse an der Mannschaft und stößt den Abgleich sofort an.
 * Beides zusammen, weil das Erste ohne das Zweite nichts sichtbar bewirkt — und weil die
 * Adresse ab dann auch dem nächtlichen Lauf zur Verfügung steht.
 *
 * Nach einem sauberen Lauf schließt sich der Dialog und die Zahlen stehen in der Meldung.
 * Bei Warnung oder Fehler bleibt er offen: Dort ist der Text die eigentliche Auskunft, und
 * ein Dialog, der sich mit einer Fehlermeldung darin wegklappt, hat noch niemandem geholfen.
 */
export default function ImportDialog({ open, onOpenChange, teams }: ImportDialogProps) {
  const { toast } = useToast();
  const updateTeam = useUpdateTeam();
  const queryClient = useQueryClient();

  const [teamId, setTeamId] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  async function onImport() {
    if (!teamId) {
      setError('Bitte eine Mannschaft wählen');
      return;
    }

    const problem = validateCalendarUrl(url);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    setRunning(true);
    try {
      await updateTeam.mutateAsync({ id: teamId, values: { webcal_url: url.trim() } });

      const { data, error: functionError } = await supabase.functions.invoke('sync-calendars', {
        body: { teamId },
      });

      if (functionError) throw new Error(functionError.message);

      const payload = data as { teams?: ImportResult[] } | null;
      const list = payload?.teams ?? [];

      // Ohne das hier steht die Liste dahinter unverändert da und der Import sieht aus,
      // als wäre nichts passiert — bis jemand die Seite neu lädt.
      await queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });

      if (list.length === 0) {
        setResults(list);
        toast('Der Abgleich lief, hat aber nichts gefunden', 'error');
        return;
      }

      const clean = list.every((result) => result.status === 'success');

      if (clean) {
        toast(`Spielplan abgeglichen — ${summarizeImport(list)}`, 'success');
        setResults(null);
        onOpenChange(false);
        return;
      }

      setResults(list);
      toast('Der Abgleich meldet ein Problem', 'error');
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Import fehlgeschlagen', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setResults(null);
          setError(null);
        }
      }}
      title="Spiele importieren"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          <Button variant="primary" loading={running} onClick={() => void onImport()}>
            Import starten
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-primary-soft p-3 text-sm text-gray-700">
          Mit dem Import holst du die Spieltermine deiner Mannschaft aus myTischtennis. Nimm
          dafür den Kalender <strong>deiner Mannschaft</strong>, nicht den Gesamtspielplan des
          Vereins — sonst landen alle Mannschaften in einer.
        </p>

        <FormField label="Mannschaft" required>
          {(p) => (
            <Select
              {...p}
              value={teamId}
              onChange={(event) => {
                const next = event.target.value;
                setTeamId(next);
                setUrl(teams.find((team) => team.id === next)?.webcal_url ?? '');
              }}
              placeholder="Bitte auswählen"
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
            />
          )}
        </FormField>

        <FormField
          label="Kalender-Adresse des Spielplans"
          required
          hint="Auf myTischtennis unter „Spielplan und Tabelle“ → „Termine herunterladen“."
          error={error ?? undefined}
        >
          {(p) => (
            <Input
              {...p}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.mytischtennis.de/community/exportICSCalendar?teamIds=…"
            />
          )}
        </FormField>

        {results && (
          <div className="space-y-2">
            {results.length === 0 && (
              <p className="text-sm text-gray-600">
                Der Abgleich lief, hat aber nichts gefunden. Stimmt die Adresse?
              </p>
            )}
            {results.map((result) => (
              <div
                key={result.team}
                className={
                  result.status === 'success'
                    ? 'rounded-xl bg-gray-50 p-3 text-sm'
                    : 'rounded-xl bg-status-late-soft p-3 text-sm'
                }
              >
                <p className="font-semibold text-gray-900">{result.team}</p>
                <p className="text-gray-700">
                  {result.inserted} neu · {result.rescheduled} verlegt · {result.updated}{' '}
                  geändert · {result.deactivated} entfallen
                </p>
                {result.message && <p className="mt-1 text-gray-700">{result.message}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
