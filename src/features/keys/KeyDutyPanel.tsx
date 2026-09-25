import { useMemo } from 'react';
import { KeySquare } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState, Select, useToast } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { useSession } from '../auth/session';
import { useMembers } from '../members/api';
import { WEEKDAYS, weekdayLabel } from '../trainings/schemas';
import {
  useKeyDutyDates,
  useKeyDutyWeekdays,
  useSetKeyDutyOverride,
  useSetKeyDutyWeekday,
} from './dutyApi';

export interface KeyDutyPanelProps {
  /** Die festen Wochentage bearbeiten (nur der Administrator). */
  editWeekdays?: boolean;
  /** Höchstens so viele kommende Tage. */
  limit?: number;
}

/**
 * Schlüsseldienst: wer an welchem Wochentag die Halle auf- und zuschließt, und die
 * nächsten Tage mit der Möglichkeit, für genau einen Tag eine Vertretung einzutragen.
 * Die Folgetermine bleiben beim festen Inhaber.
 *
 * Vertretungen tragen der Administrator und jeder mit Schlüsseldienst ein; vertreten
 * kann nur, wer selbst Schlüsseldienst hat. Die Regeln prüft die Datenbank.
 */
export default function KeyDutyPanel({ editWeekdays = false, limit = 12 }: KeyDutyPanelProps) {
  const { profile, role } = useSession();
  const { toast } = useToast();
  const members = useMembers();
  const weekdays = useKeyDutyWeekdays();
  const dates = useKeyDutyDates();
  const setWeekday = useSetKeyDutyWeekday();
  const setOverride = useSetKeyDutyOverride();

  const canOverride = role === 'admin' || profile?.key_service === true;

  const keyService = useMemo(
    () =>
      (members.data ?? [])
        .filter((member) => member.key_service && member.status === 'active')
        .map((member) => ({ value: member.id, label: member.full_name ?? '' })),
    [members.data],
  );

  const nameOf = (id: string | null) =>
    (members.data ?? []).find((member) => member.id === id)?.full_name ?? '—';

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast(done, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  if (members.isSuccess && keyService.length === 0) {
    return (
      <EmptyState
        icon={KeySquare}
        title="Noch niemand hat Schlüsseldienst"
        description={
          role === 'admin'
            ? 'Setze bei den Mitgliedern das Kennzeichen „Schlüsseldienst“. Danach vergibst du hier die festen Wochentage.'
            : 'Der Administrator vergibt den Schlüsseldienst.'
        }
      />
    );
  }

  const upcoming = (dates.data ?? []).slice(0, limit);

  return (
    <div className="space-y-4">
      {editWeekdays && (
        <Card>
          <CardBody className="space-y-2">
            <h3 className="font-bold text-gray-900">Feste Wochentage</h3>
            <p className="text-sm text-gray-600">
              Gilt für jeden Tag, an dem die Halle gebraucht wird (Training oder Heimspiel).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEEKDAYS.map((day) => {
                const current =
                  (weekdays.data ?? []).find((entry) => entry.weekday === day.value)?.profile_id ?? '';
                return (
                  <label key={day.value} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 font-semibold text-gray-700">{day.label}</span>
                    <Select
                      aria-label={`Schlüsseldienst ${day.label}`}
                      value={current}
                      onChange={(event) =>
                        void run(
                          () =>
                            setWeekday.mutateAsync({
                              weekday: day.value,
                              profileId: event.target.value || null,
                            }),
                          'Schlüsseldienst gespeichert',
                        )
                      }
                      options={[{ value: '', label: 'niemand' }, ...keyService]}
                    />
                  </label>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-2">
          <h3 className="font-bold text-gray-900">Die nächsten Tage</h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-600">
              In den nächsten Wochen ist kein Tag mit Schlüsseldienst eingeplant.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((entry) => (
                <li
                  key={entry.duty_date}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-900">
                      {weekdayLabel(entry.weekday)}, {formatDate(entry.duty_date)}
                    </span>
                    {entry.is_override && (
                      <Badge tone="late" className="ml-1.5">
                        Vertretung für {nameOf(entry.regular_id)}
                      </Badge>
                    )}
                    {entry.profile_id === profile?.id && (
                      <Badge tone="primary" className="ml-1.5">
                        du
                      </Badge>
                    )}
                  </div>
                  {canOverride ? (
                    <Select
                      aria-label={`Schlüsseldienst am ${formatDate(entry.duty_date)}`}
                      value={entry.profile_id}
                      onChange={(event) =>
                        void run(
                          () =>
                            setOverride.mutateAsync({
                              date: entry.duty_date,
                              profileId:
                                event.target.value === (entry.regular_id ?? '')
                                  ? null
                                  : event.target.value,
                            }),
                          'Vertretung gespeichert',
                        )
                      }
                      options={keyService}
                    />
                  ) : (
                    <span className="text-sm text-gray-700">{entry.full_name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
