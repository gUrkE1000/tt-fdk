import { useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Badge, Button, Checkbox, PersonPicker, useToast } from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import type { MemberSummary } from '../members/api';
import type { TeamWithRoster } from '../teams/api';
import { useRequestPlayers, type MatchRow, type Participation } from './api';
import type { AbsenceWindow } from './lineupSections';
import { defaultSelection, requestCandidates } from './requests';

export interface RequestPlayersPanelProps {
  match: MatchRow;
  team: TeamWithRoster | undefined;
  members: MemberSummary[];
  /** Die Zeilen dieses Spiels. */
  participations: Participation[];
  allMatches: MatchRow[];
  allParticipations: Participation[];
  absences: AbsenceWindow[];
  /** Erst wenn die Anfragen geladen sind, lässt sich sagen, wer noch nicht gefragt ist. */
  ready: boolean;
}

/**
 * „Spieler anfragen": Auswahl der Personen, auf Wunsch für weitere Spiele derselben
 * Mannschaft. Ist für das Spiel noch niemand gefragt, sind die Stammspieler schon
 * angehakt — verschickt wird trotzdem erst mit dem Knopf.
 */
export default function RequestPlayersPanel({
  match,
  team,
  members,
  participations,
  allMatches,
  allParticipations,
  absences,
  ready,
}: RequestPlayersPanelProps) {
  const { toast } = useToast();
  const requestPlayers = useRequestPlayers();
  const matchDay = (match.dtstart ?? '').slice(0, 10);

  const candidates = useMemo(
    () => requestCandidates(team, members, participations, matchDay, absences),
    [team, members, participations, matchDay, absences],
  );

  const [picked, setPicked] = useState<string[]>([]);
  // Wer inzwischen gefragt ist (auch von anderer Stelle aus), fällt aus der Auswahl.
  const selected = useMemo(() => {
    const open = new Set(candidates.map((candidate) => candidate.id));
    return picked.filter((id) => open.has(id));
  }, [picked, candidates]);
  const [extraMatchIds, setExtraMatchIds] = useState<string[]>([]);

  // Die Vorauswahl einmal je Spiel setzen, sobald Kader und Mitglieder geladen sind —
  // danach gehört die Auswahl dem Mannschaftsführer.
  const preselectedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || preselectedFor.current === match.id || candidates.length === 0) return;
    preselectedFor.current = match.id;
    setPicked(defaultSelection(candidates, participations));
    setExtraMatchIds([]);
  }, [ready, match.id, candidates, participations]);

  const otherMatches = useMemo(() => {
    const now = new Date().toISOString();
    const asked = new Set(allParticipations.map((entry) => entry.match_id));
    return allMatches
      .filter(
        (entry) =>
          entry.id !== match.id &&
          entry.team_id === match.team_id &&
          entry.active &&
          (entry.dtstart ?? '') > now,
      )
      .sort((a, b) => (a.dtstart ?? '').localeCompare(b.dtstart ?? ''))
      .map((entry) => ({ match: entry, withoutRequests: !asked.has(entry.id) }));
  }, [allMatches, allParticipations, match.id, match.team_id]);

  async function onRequest() {
    try {
      const count = await requestPlayers.mutateAsync({
        matchIds: [match.id, ...extraMatchIds],
        profileIds: selected,
      });
      toast(
        count === 0
          ? 'Alle Ausgewählten waren schon angefragt'
          : count === 1
            ? '1 Anfrage verschickt'
            : `${count} Anfragen verschickt`,
        'success',
      );
      setPicked([]);
      setExtraMatchIds([]);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  function toggleMatch(id: string, checked: boolean) {
    setExtraMatchIds((current) =>
      checked ? [...current, id] : current.filter((entry) => entry !== id),
    );
  }

  const gamesCount = 1 + extraMatchIds.length;

  return (
    <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-600">Spieler anfragen</h4>

      {candidates.length === 0 ? (
        <p className="text-sm text-gray-600">Alle, die sich anfragen lassen, sind schon gefragt.</p>
      ) : (
        <>
          <PersonPicker
            people={candidates}
            value={selected}
            onChange={setPicked}
            placeholder="Spieler auswählen"
          />

          {otherMatches.length > 0 && (
            <details className="rounded-lg bg-white p-2">
              <summary className="cursor-pointer text-sm font-medium text-gray-700">
                Auch für weitere Spiele anfragen
                {extraMatchIds.length > 0 ? ` (${extraMatchIds.length})` : ''}
              </summary>
              <div className="mt-2 space-y-1.5">
                <Button
                  size="sm"
                  onClick={() =>
                    setExtraMatchIds(
                      otherMatches.filter((entry) => entry.withoutRequests).map((entry) => entry.match.id),
                    )
                  }
                >
                  Alle ohne Anfrage auswählen
                </Button>
                {otherMatches.map(({ match: other, withoutRequests }) => (
                  <div key={other.id} className="flex items-center justify-between gap-2">
                    <Checkbox
                      checked={extraMatchIds.includes(other.id)}
                      onCheckedChange={(checked) => toggleMatch(other.id, checked)}
                      label={`${other.dtstart ? formatDateTime(other.dtstart) : ''} · gegen ${
                        other.opponent || 'unbekannt'
                      }`}
                    />
                    {withoutRequests && <Badge tone="warning">noch niemand angefragt</Badge>}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={selected.length === 0 || requestPlayers.isPending}
              onClick={() => void onRequest()}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {selected.length === 0
                ? 'Anfragen'
                : `${selected.length} ${selected.length === 1 ? 'Person' : 'Personen'} anfragen${
                    gamesCount > 1 ? ` (${gamesCount} Spiele)` : ''
                  }`}
            </Button>
            <span className="text-xs text-gray-500">
              Die Angefragten bekommen eine Nachricht mit Zusage- und Absage-Link.
            </span>
          </div>
        </>
      )}
    </section>
  );
}
