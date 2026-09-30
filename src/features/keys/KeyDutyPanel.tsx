import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DateInput,
  SearchSelect,
  ShowMore,
  usePaged,
  useToast,
} from '../../components/ui';
import { formatDate, todayInBerlin } from '../../lib/dates';
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
}

const NOBODY = { value: '', label: 'niemand' };

/**
 * Schlüsseldienst: wer an welchem Wochentag die Halle auf- und zuschließt, und die
 * nächsten Hallentage mit der Möglichkeit, für genau einen Tag jemanden einzutragen.
 * Die Folgetermine bleiben beim festen Inhaber.
 *
 * Schlüsseldienst übernehmen kann jedes aktive Mitglied — ausgewählt per Suche. Für
 * einen Tag eintragen dürfen der Administrator, wer einen festen Wochentag hat, und
 * wer an dem Tag eingeteilt ist. Die Regeln prüft die Datenbank.
 */
export default function KeyDutyPanel({ editWeekdays = false }: KeyDutyPanelProps) {
  const { profile, role } = useSession();
  const { toast } = useToast();
  const members = useMembers();
  const weekdays = useKeyDutyWeekdays();
  const dates = useKeyDutyDates();
  const setWeekday = useSetKeyDutyWeekday();
  const setOverride = useSetKeyDutyOverride();
  const [otherDate, setOtherDate] = useState('');
  const [otherPerson, setOtherPerson] = useState('');

  const hasWeekday = (weekdays.data ?? []).some((entry) => entry.profile_id === profile?.id);
  const canPlan = role === 'admin' || hasWeekday;

  // Die Termine reichen ein Jahr voraus; gezeigt werden sie seitenweise.
  const { shown: upcoming, rest, more } = usePaged(dates.data ?? []);

  const people = useMemo(
    () =>
      (members.data ?? [])
        .filter((member) => member.status === 'active' && !member.deleted_at)
        .map((member) => ({ value: member.id, label: member.full_name ?? '' }))
        .sort((a, b) => a.label.localeCompare(b.label, 'de')),
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
                  <div key={day.value} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 font-semibold text-gray-700">{day.label}</span>
                    <SearchSelect
                      aria-label={`Schlüsseldienst ${day.label}`}
                      value={current}
                      onChange={(value) =>
                        void run(
                          () =>
                            setWeekday.mutateAsync({
                              weekday: day.value,
                              profileId: value || null,
                            }),
                          'Schlüsseldienst gespeichert',
                        )
                      }
                      options={[NOBODY, ...people]}
                    />
                  </div>
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
              In den nächsten Wochen wird die Halle an keinem Tag gebraucht.
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
                    {entry.is_override && entry.regular_id && (
                      <Badge tone="late" className="ml-1.5">
                        Vertretung für {nameOf(entry.regular_id)}
                      </Badge>
                    )}
                    {entry.profile_id !== null && entry.profile_id === profile?.id && (
                      <Badge tone="primary" className="ml-1.5">
                        du
                      </Badge>
                    )}
                  </div>
                  {canPlan || entry.profile_id === profile?.id ? (
                    <SearchSelect
                      aria-label={`Schlüsseldienst am ${formatDate(entry.duty_date)}`}
                      className="sm:w-64"
                      value={entry.profile_id ?? ''}
                      onChange={(value) =>
                        void run(
                          () =>
                            setOverride.mutateAsync({
                              date: entry.duty_date,
                              profileId: value === '' || value === entry.regular_id ? null : value,
                            }),
                          'Schlüsseldienst gespeichert',
                        )
                      }
                      options={entry.regular_id ? people : [NOBODY, ...people]}
                    />
                  ) : (
                    <span className="text-sm text-gray-700">{entry.full_name ?? 'niemand'}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ShowMore rest={rest} onMore={more} />
        </CardBody>
      </Card>

      {canPlan && (
        <Card>
          <CardBody className="space-y-2">
            <h3 className="font-bold text-gray-900">Anderer Tag</h3>
            <p className="text-sm text-gray-600">
              Für einen Tag, der oben nicht steht — etwa ein Turnier oder ein Sondertraining.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <DateInput
                aria-label="Tag"
                className="w-44"
                min={todayInBerlin()}
                value={otherDate}
                onChange={(event) => setOtherDate(event.target.value)}
              />
              <SearchSelect
                aria-label="Schlüsseldienst am anderen Tag"
                className="sm:w-64"
                placeholder="Person auswählen"
                value={otherPerson}
                onChange={setOtherPerson}
                options={people}
              />
              <Button
                disabled={!otherDate || !otherPerson}
                onClick={() =>
                  void run(async () => {
                    await setOverride.mutateAsync({ date: otherDate, profileId: otherPerson });
                    setOtherDate('');
                    setOtherPerson('');
                  }, 'Schlüsseldienst gespeichert')
                }
              >
                Eintragen
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
