import { useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button, Select, useToast } from '../../components/ui';
import { useSession } from '../auth/session';
import { useMembers, type MemberSummary } from '../members/api';
import { useKeys, useSetSessionKeyBearer, type KeyRow, type SessionKeys } from '../keys/api';
import type { TrainingSession, TrainingWithPeople } from './api';

export interface KeyBearerRowProps {
  session: TrainingSession;
  training: TrainingWithPeople | undefined;
  keys: SessionKeys | undefined;
  profileId: string | null;
}

/** Wer laut Schlüsselverwaltung einen Schlüssel für die Halle des Trainings hat. */
export function holdersForVenue(keys: KeyRow[], venueId: string | null | undefined): KeyRow[] {
  if (!venueId) return [];
  const seen = new Set<string>();
  return keys.filter((key) => {
    if (!key.active || key.venue_id !== venueId || !key.holder_id) return false;
    if (seen.has(key.holder_id)) return false;
    seen.add(key.holder_id);
    return true;
  });
}

/**
 * Wen der Trainer eintragen kann: erst, wer einen Schlüssel für die Halle hat, dann
 * alle übrigen aktiven Mitglieder.
 */
export function bearerOptions(
  members: MemberSummary[],
  holderIds: Set<string>,
): { value: string; label: string }[] {
  const active = members.filter((member) => member.status === 'active' && !member.deleted_at);
  const byName = (a: MemberSummary, b: MemberSummary) =>
    (a.full_name ?? '').localeCompare(b.full_name ?? '', 'de');

  return [
    ...active
      .filter((member) => holderIds.has(member.id))
      .sort(byName)
      .map((member) => ({ value: member.id, label: `${member.full_name ?? ''} · hat einen Schlüssel` })),
    ...active
      .filter((member) => !holderIds.has(member.id))
      .sort(byName)
      .map((member) => ({ value: member.id, label: member.full_name ?? '' })),
  ];
}

/**
 * Die Schlüsselzeile eines Trainingstermins: wer den Hallenschlüssel bringt.
 *
 * Man trägt sich selbst ein („Ich bringe den Schlüssel"); Trainer und Admin tragen
 * jemanden ein oder ändern den Eintrag. Ist niemand eingetragen, nennt die Zeile, wer
 * laut Schlüsselverwaltung einen Schlüssel für die Halle hat.
 */
export default function KeyBearerRow({ session, training, keys, profileId }: KeyBearerRowProps) {
  const { toast } = useToast();
  const { role } = useSession();
  const setBearer = useSetSessionKeyBearer();
  const allKeys = useKeys();
  const [picking, setPicking] = useState(false);

  const isManager =
    role === 'admin' || (profileId !== null && (training?.trainerIds ?? []).includes(profileId));
  const members = useMembers();

  const holders = useMemo(
    () => holdersForVenue(allKeys.data ?? [], training?.venue_id),
    [allKeys.data, training?.venue_id],
  );
  const options = useMemo(
    () =>
      isManager
        ? bearerOptions(members.data ?? [], new Set(holders.map((key) => key.holder_id!)))
        : [],
    [isManager, members.data, holders],
  );

  const ended = new Date(session.ends_at ?? session.starts_at) <= new Date();
  if (session.cancelled || !keys) return null;

  const mine = keys.bearer_id !== null && keys.bearer_id === profileId;
  const canAct = profileId !== null && !ended;

  async function assign(target: string | null, success: string) {
    try {
      await setBearer.mutateAsync({ sessionId: session.id, profileId: target });
      toast(success, 'success');
      setPicking(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  const picker = isManager && picking && (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Wer bringt den Schlüssel?"
        options={options}
        placeholder="Mitglied wählen"
        defaultValue=""
        disabled={setBearer.isPending}
        onChange={(event) => {
          if (event.target.value) void assign(event.target.value, 'Eingetragen');
        }}
        className="min-w-0 flex-1"
      />
      <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
        Abbrechen
      </Button>
    </div>
  );

  if (keys.has_bearer) {
    return (
      <div className="space-y-2 rounded-xl bg-status-yes-soft p-2.5 text-sm text-status-yes">
        <p className="flex items-start gap-1.5">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {mine
              ? 'Du bringst den Schlüssel.'
              : `Schlüssel bringt: ${keys.bearer_name ?? 'jemand ist eingetragen'}`}
          </span>
        </p>
        {canAct && (mine || isManager) && !picking && (
          <div className="flex flex-wrap gap-2">
            {mine && (
              <Button
                size="sm"
                disabled={setBearer.isPending}
                onClick={() => void assign(null, 'Ausgetragen')}
              >
                Doch nicht
              </Button>
            )}
            {isManager && (
              <Button size="sm" disabled={setBearer.isPending} onClick={() => setPicking(true)}>
                Ändern
              </Button>
            )}
            {isManager && !mine && (
              <Button
                size="sm"
                variant="ghost"
                disabled={setBearer.isPending}
                onClick={() => void assign(null, 'Ausgetragen')}
              >
                Austragen
              </Button>
            )}
          </div>
        )}
        {picker}
      </div>
    );
  }

  // Schlüsseldienst des Tages (fest oder Vertretung): Dann fehlt kein Schlüssel.
  if (keys.duty_id) {
    return (
      <p className="flex items-start gap-1.5 rounded-xl bg-status-yes-soft p-2.5 text-sm text-status-yes">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {keys.duty_id === profileId
            ? 'Du hast an diesem Tag Schlüsseldienst.'
            : `Schlüsseldienst: ${keys.duty_name ?? 'ist eingeteilt'}`}
        </span>
      </p>
    );
  }

  const holderNames = holders.map((key) => key.holder_name).filter(Boolean);

  return (
    <div className="space-y-2 rounded-xl bg-status-late-soft p-2.5 text-sm text-status-late">
      <p className="flex items-start gap-1.5">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {ended ? 'Niemand war für den Schlüssel eingetragen.' : 'Noch niemand bringt den Schlüssel.'}
          {!ended && holderNames.length > 0 && (
            <> Einen Schlüssel für die Halle haben: {holderNames.join(', ')}.</>
          )}
        </span>
      </p>
      {canAct && !picking && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={setBearer.isPending}
            onClick={() => void assign(profileId, 'Danke — du bringst den Schlüssel')}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Ich bringe den Schlüssel
          </Button>
          {isManager && (
            <Button
              size="sm"
              variant="ghost"
              disabled={setBearer.isPending}
              onClick={() => setPicking(true)}
            >
              Jemanden eintragen
            </Button>
          )}
        </div>
      )}
      {picker}
    </div>
  );
}
