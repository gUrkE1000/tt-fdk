import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { buttonClasses } from '../../components/ui';
import { useSession } from '../auth/session';
import type { SessionKeys } from '../keys/api';
import type { TrainingSession } from './api';

export interface KeyBearerRowProps {
  session: TrainingSession;
  keys: SessionKeys | undefined;
  profileId: string | null;
}

/** Der Schlüsseldienst unter „Orte & Schlüsseldienst", aufgeklappt beim Tag des Termins. */
export function keyDutyLink(date: string): string {
  return `/venues?date=${date}`;
}

/**
 * Die Schlüsselzeile eines Trainingstermins: wer an dem Tag Schlüsseldienst hat.
 *
 * Nur zur Anzeige — geändert wird der Schlüsseldienst an einer Stelle, unter „Orte &
 * Schlüsseldienst". Wer dort planen darf (Administrator, Kennzeichen), bekommt einen
 * Knopf direkt zu diesem Tag; alle anderen sehen nur den Namen.
 */
export default function KeyBearerRow({ session, keys, profileId }: KeyBearerRowProps) {
  const { profile, role } = useSession();
  const canPlan = role === 'admin' || profile?.key_service === true;

  if (session.cancelled || !keys) return null;

  const ended = new Date(session.ends_at ?? session.starts_at) <= new Date();
  // Früher trug man pro Termin ein, wer den Schlüssel bringt; solche Einträge gelten
  // weiter, wenn niemand Schlüsseldienst hat.
  const personId = keys.duty_id ?? (keys.has_bearer ? keys.bearer_id : null);
  const personName = keys.duty_id ? keys.duty_name : keys.bearer_name;
  const assigned = keys.duty_id !== null || keys.has_bearer;

  return (
    <div
      className={
        assigned
          ? 'flex flex-wrap items-center justify-between gap-2 rounded-xl bg-status-yes-soft p-2.5 text-sm text-status-yes'
          : 'flex flex-wrap items-center justify-between gap-2 rounded-xl bg-status-late-soft p-2.5 text-sm text-status-late'
      }
    >
      <p className="flex items-start gap-1.5">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {!assigned
            ? 'Kein Schlüsseldienst eingeteilt.'
            : personId !== null && personId === profileId
              ? 'Du hast an diesem Tag Schlüsseldienst.'
              : `Schlüsseldienst: ${personName ?? 'ist eingeteilt'}`}
        </span>
      </p>
      {!ended && canPlan && (
        <Link to={keyDutyLink(session.session_date)} className={buttonClasses({ size: 'sm' })}>
          Zum Schlüsseldienst
        </Link>
      )}
    </div>
  );
}
