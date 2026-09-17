import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  UserMinus,
  UserPlus,
  Wand2,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  IconButton,
  PersonPicker,
  ProgressBar,
  SortableList,
  useToast,
} from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { supabase } from '../../lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import type { Member } from '../members/api';
import type { TeamWithRoster } from '../teams/api';
import {
  useAllParticipations,
  useManagePlayer,
  useMatches,
  useSetLineup,
  useUnlockLineup,
  type MatchRow,
  type Participation,
} from './api';
import {
  ACTION_HELP,
  findSameDayConflicts,
  groupParticipations,
  type AbsenceWindow,
} from './lineupSections';

export interface ManagePlayersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchRow | null;
  team: TeamWithRoster | undefined;
  members: Member[];
}

/** Abwesenheiten aller Mitglieder; die View maskiert den Grund, der hier nicht gebraucht wird. */
function useAbsenceWindows() {
  return useQuery({
    queryKey: ['absences', 'alle'],
    queryFn: async (): Promise<AbsenceWindow[]> => {
      const { data, error } = await supabase.from('v_absences').select('profile_id, start_date, end_date');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        profileId: row.profile_id!,
        startDate: row.start_date!,
        endDate: row.end_date!,
      }));
    },
  });
}

export default function ManagePlayersDialog({
  open,
  onOpenChange,
  match,
  team,
  members,
}: ManagePlayersDialogProps) {
  const { toast } = useToast();
  const managePlayer = useManagePlayer();
  const setLineup = useSetLineup();
  const unlockLineup = useUnlockLineup();
  const allParticipations = useAllParticipations();
  const allMatches = useMatches();
  const absences = useAbsenceWindows();
  const [adding, setAdding] = useState<string[]>([]);

  const participations = useMemo(
    () => (allParticipations.data ?? []).filter((entry) => entry.match_id === match?.id),
    [allParticipations.data, match?.id],
  );

  const nameOf = useMemo(() => {
    const names = new Map(members.map((member) => [member.id, member.full_name ?? '']));
    return (id: string) => names.get(id) ?? 'Unbekannt';
  }, [members]);

  const matchDay = (match?.dtstart ?? '').slice(0, 10);

  const sections = useMemo(
    () => groupParticipations(participations, matchDay, absences.data ?? []),
    [participations, matchDay, absences.data],
  );

  const conflicts = useMemo(() => {
    if (!match) return [];
    const startsById = Object.fromEntries(
      (allMatches.data ?? []).map((entry) => [entry.id, entry.dtstart ?? '']),
    );
    return findSameDayConflicts(
      participations,
      allParticipations.data ?? [],
      match.dtstart ?? '',
      startsById,
      match.id,
    );
  }, [match, participations, allParticipations.data, allMatches.data]);

  if (!match) return null;

  const required = match.required_players ?? 0;
  const inLineup = sections.lineup.length;

  // Wer noch gar keine Zeile hat: Spieler außerhalb des Kaders.
  const known = new Set(participations.map((entry) => entry.profile_id));
  const outsiders = members.filter((member) => !known.has(member.id));

  async function act(profileId: string, action: 'add' | 'remove' | 'decline' | 'reset') {
    try {
      await managePlayer.mutateAsync({ matchId: match!.id, profileId, action });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function onReorder(ids: string[]) {
    try {
      await setLineup.mutateAsync({ matchId: match!.id, order: ids });
      toast('Aufstellung gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function onRestoreAutomatic() {
    try {
      await unlockLineup.mutateAsync(match!.id);
      toast('Automatik wiederhergestellt', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function onAddOutsiders() {
    for (const id of adding) {
      await act(id, 'add');
    }
    setAdding([]);
  }

  function row(participation: Participation, actions: React.ReactNode) {
    return (
      <li
        key={participation.profile_id}
        className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
      >
        <div className="min-w-0">
          <span className="truncate text-sm font-medium text-gray-900">
            {nameOf(participation.profile_id)}
          </span>
          {conflicts.includes(participation.profile_id) && (
            <Badge tone="warning" className="ml-1.5">
              anderes Spiel
            </Badge>
          )}
          {participation.comment && (
            <p className="truncate text-xs text-gray-500">{participation.comment}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </li>
    );
  }

  function section(title: string, entries: Participation[], actions: (p: Participation) => React.ReactNode) {
    if (entries.length === 0) return null;
    return (
      <section>
        <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
          {title} ({entries.length})
        </h4>
        <ul className="space-y-1.5">{entries.map((entry) => row(entry, actions(entry)))}</ul>
      </section>
    );
  }

  const removeAction = (p: Participation) => (
    <>
      <IconButton
        icon={UserMinus}
        label={`${nameOf(p.profile_id)} vorerst entfernen`}
        title={ACTION_HELP.remove}
        onClick={() => void act(p.profile_id, 'remove')}
      />
      <IconButton
        icon={XCircle}
        label={`${nameOf(p.profile_id)} auf Absage setzen`}
        title={ACTION_HELP.decline}
        onClick={() => void act(p.profile_id, 'decline')}
      />
    </>
  );

  const addAction = (p: Participation) => (
    <IconButton
      icon={UserPlus}
      label={`${nameOf(p.profile_id)} hinzufügen`}
      title={ACTION_HELP.add}
      tone="primary"
      onClick={() => void act(p.profile_id, 'add')}
    />
  );

  const resetAction = (p: Participation) => (
    <IconButton
      icon={RotateCcw}
      label={`Status von ${nameOf(p.profile_id)} zurücksetzen`}
      title={ACTION_HELP.reset}
      onClick={() => void act(p.profile_id, 'reset')}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Spieler verwalten"
      description={`${team?.name ?? ''} gegen ${match.opponent} · ${
        match.dtstart ? formatDateTime(match.dtstart) : ''
      }`}
      footer={<Button onClick={() => onOpenChange(false)}>Schließen</Button>}
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-gray-900">
              {`${inLineup} / ${required} Spieler besetzt`}
            </span>
            {match.lineup_locked && (
              <Button size="sm" onClick={() => void onRestoreAutomatic()}>
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                Automatik wiederherstellen
              </Button>
            )}
          </div>
          <ProgressBar value={inLineup} max={required} />
          {match.lineup_locked && (
            <p className="mt-1 text-xs text-gray-500">
              Diese Aufstellung wurde von Hand gesetzt. Die Automatik fasst sie nicht mehr an.
            </p>
          )}
          {team?.lineup_mode === 'open' && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-status-late">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Offene Spieler: Die Aufstellung legst du hier selbst fest.
            </p>
          )}
        </div>

        {sections.lineup.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
              Aufstellung ({sections.lineup.length})
            </h4>
            <SortableList
              numbered
              items={sections.lineup.map((entry) => ({
                id: entry.profile_id,
                content: (
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {nameOf(entry.profile_id)}
                      {(entry.lineup_position ?? 0) > required && (
                        <Badge tone="neutral" className="ml-1.5">
                          Ersatzbank
                        </Badge>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">{removeAction(entry)}</div>
                  </div>
                ),
              }))}
              onReorder={(ids) => void onReorder(ids)}
            />
          </section>
        )}

        {section('Offene Spieler', sections.open, (p) => (
          <>
            {addAction(p)}
            <IconButton
              icon={XCircle}
              label={`${nameOf(p.profile_id)} auf Absage setzen`}
              title={ACTION_HELP.decline}
              onClick={() => void act(p.profile_id, 'decline')}
            />
          </>
        ))}

        <div>
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            Andere Spieler (ohne Mannschaftszuordnung)
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[14rem] flex-1">
              <PersonPicker
                people={outsiders.map((member) => ({
                  id: member.id,
                  name: member.full_name ?? '',
                  detail: member.qttr != null ? `${member.qttr} QTTR` : undefined,
                }))}
                value={adding}
                onChange={setAdding}
                placeholder="Mitglieder auswählen"
              />
            </div>
            <Button disabled={adding.length === 0} onClick={() => void onAddOutsiders()}>
              Hinzufügen
            </Button>
          </div>
        </div>

        {section('Abwesende Spieler', sections.absent, addAction)}
        {section('Bestätigte Spieler manuell entfernt', sections.removed, (p) => (
          <>
            {addAction(p)}
            {resetAction(p)}
          </>
        ))}
        {section('Spieler Absagen', sections.declined, resetAction)}
        {section('Spieler noch unklar', sections.unclear, (p) => (
          <>
            {addAction(p)}
            {resetAction(p)}
          </>
        ))}

        {conflicts.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
              Spieler mit Spieltermin am gleichen Tag ({conflicts.length})
            </h4>
            <ul className="space-y-1.5">
              {conflicts.map((id) => (
                <li
                  key={id}
                  className="rounded-xl bg-status-late-soft px-3 py-2 text-sm text-status-late"
                >
                  {nameOf(id)} hat innerhalb von drei Stunden noch ein anderes Spiel zugesagt.
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl bg-gray-50 p-3">
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            Erklärung Aktionen
          </h4>
          <dl className="space-y-0.5 text-xs text-gray-600">
            <ExplainRow icon={<UserPlus className="h-3.5 w-3.5" />} text={ACTION_HELP.add} />
            <ExplainRow icon={<UserMinus className="h-3.5 w-3.5" />} text={ACTION_HELP.remove} />
            <ExplainRow icon={<XCircle className="h-3.5 w-3.5" />} text={ACTION_HELP.decline} />
            <ExplainRow icon={<RotateCcw className="h-3.5 w-3.5" />} text={ACTION_HELP.reset} />
          </dl>
          <p className="mt-2 text-xs text-gray-500">
            Ersatzanfragen stellen und zurückziehen folgt in einem späteren Schritt.
          </p>
        </section>
      </div>
    </Dialog>
  );
}

function ExplainRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}
