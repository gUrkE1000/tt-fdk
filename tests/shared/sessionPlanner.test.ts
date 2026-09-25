import { describe, it, expect } from 'vitest';
import {
  HORIZON_DAYS,
  REASON_INACTIVE,
  REASON_OUT_OF_PLAN,
  REASON_PUBLIC_HOLIDAY,
  REASON_SCHOOL_HOLIDAY,
  addDays,
  isoWeekday,
  occurrences,
  planSessions,
  type CancellationPeriod,
  type ExistingSession,
  type HolidayPeriod,
  type PlannedTraining,
  type SessionPlanInput,
} from '../../supabase/functions/_shared/sessionPlanner';

// Der 1. September 2026 ist ein Dienstag.
const TRAINING: PlannedTraining = {
  id: 't-1',
  weekday: 2,
  timeStart: '19:00:00',
  timeEnd: '21:00:00',
  venueId: 'v-1',
  rhythm: 'weekly',
  startDate: '2026-09-01',
  skipPublicHolidays: true,
  skipSchoolHolidays: false,
  active: true,
};

function input(overrides: Partial<SessionPlanInput> = {}): SessionPlanInput {
  return {
    training: TRAINING,
    holidays: [],
    cancellations: [],
    existing: [],
    from: '2026-09-01',
    to: '2026-09-30',
    ...overrides,
  };
}

function session(overrides: Partial<ExistingSession> & { sessionDate: string }): ExistingSession {
  return {
    id: `s-${overrides.sessionDate}`,
    startsAt: `${overrides.sessionDate}T17:00:00.000Z`,
    endsAt: `${overrides.sessionDate}T19:00:00.000Z`,
    cancelled: false,
    cancellationId: null,
    ...overrides,
  };
}

// ------------------------------------------------------------------- Rhythmus

describe('occurrences', () => {
  it('„Einmalig“ ergibt genau den Tag des Startdatums', () => {
    const once = { ...TRAINING, rhythm: 'once' as const, startDate: '2026-09-17', weekday: 4 };
    expect(occurrences(once, '2026-09-01', '2026-09-30')).toEqual(['2026-09-17']);
    expect(occurrences(once, '2026-09-18', '2026-10-30')).toEqual([]);
    expect(occurrences(once, '2026-08-01', '2026-09-16')).toEqual([]);
  });

  it('trifft wöchentlich denselben Wochentag', () => {
    const dates = occurrences(TRAINING, '2026-09-01', '2026-09-30');
    expect(dates).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
    expect(dates.every((date) => isoWeekday(date) === 2)).toBe(true);
  });

  it('lässt bei zweiwöchentlich jede zweite Woche aus', () => {
    const dates = occurrences({ ...TRAINING, rhythm: 'biweekly' }, '2026-09-01', '2026-10-15');
    expect(dates).toEqual(['2026-09-01', '2026-09-15', '2026-09-29', '2026-10-13']);
  });

  it('behält bei zweiwöchentlich den Takt, auch wenn das Fenster später beginnt', () => {
    // Der Anker liegt lange zurück; der Takt darf sich davon nicht verschieben.
    const dates = occurrences({ ...TRAINING, rhythm: 'biweekly' }, '2026-10-01', '2026-10-31');
    expect(dates).toEqual(['2026-10-13', '2026-10-27']);
  });

  it('nimmt bei monatlich dieselbe Stelle im Monat', () => {
    // Der 1. September ist der erste Dienstag — also jeder erste Dienstag.
    const dates = occurrences({ ...TRAINING, rhythm: 'monthly' }, '2026-09-01', '2026-12-31');
    expect(dates).toEqual(['2026-09-01', '2026-10-06', '2026-11-03', '2026-12-01']);
  });

  it('lässt bei monatlich Monate aus, in denen es die Stelle nicht gibt', () => {
    // Der 29. September ist der fünfte Dienstag; den hat nicht jeder Monat.
    const dates = occurrences(
      { ...TRAINING, rhythm: 'monthly', startDate: '2026-09-29' },
      '2026-09-01',
      '2026-12-31',
    );
    expect(dates).toEqual(['2026-09-29', '2026-12-29']);
  });

  it('beginnt nicht vor dem Startdatum', () => {
    const dates = occurrences({ ...TRAINING, startDate: '2026-09-20' }, '2026-09-01', '2026-09-30');
    expect(dates).toEqual(['2026-09-22', '2026-09-29']);
  });

  it('rückt vom Startdatum auf den nächsten passenden Wochentag vor', () => {
    // Der 2. September ist ein Mittwoch, das Training ist dienstags.
    const dates = occurrences({ ...TRAINING, startDate: '2026-09-02' }, '2026-09-01', '2026-09-16');
    expect(dates).toEqual(['2026-09-08', '2026-09-15']);
  });

  it('liefert nichts, wenn das Training erst nach dem Fenster beginnt', () => {
    expect(occurrences({ ...TRAINING, startDate: '2027-01-01' }, '2026-09-01', '2026-09-30')).toEqual(
      [],
    );
  });
});

// ------------------------------------------------------------------- Anlegen

describe('planSessions: anlegen', () => {
  it('legt jeden fehlenden Termin an', () => {
    const plan = planSessions(input());
    expect(plan.create.map((entry) => entry.sessionDate)).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ]);
    expect(plan.cancel).toEqual([]);
    expect(plan.uncancel).toEqual([]);
  });

  it('setzt Beginn und Ende aus der Ortszeit', () => {
    const plan = planSessions(input({ to: '2026-09-01' }));
    // Anfang September gilt Sommerzeit: 19 Uhr Ortszeit sind 17 Uhr UTC.
    expect(plan.create[0].startsAt).toBe('2026-09-01T17:00:00.000Z');
    expect(plan.create[0].endsAt).toBe('2026-09-01T19:00:00.000Z');
  });

  it('rechnet über die Zeitumstellung hinweg dieselbe Ortszeit', () => {
    const plan = planSessions(input({ from: '2026-11-01', to: '2026-11-03' }));
    // Ende Oktober wird zurückgestellt: 19 Uhr Ortszeit sind dann 18 Uhr UTC.
    expect(plan.create[0].startsAt).toBe('2026-11-03T18:00:00.000Z');
  });

  it('lässt ein Ende offen, wenn das Training keins hat', () => {
    const plan = planSessions(
      input({ training: { ...TRAINING, timeEnd: null }, to: '2026-09-01' }),
    );
    expect(plan.create[0].endsAt).toBeNull();
  });

  it('rührt einen bestehenden Termin nicht an', () => {
    const plan = planSessions(input({ existing: [session({ sessionDate: '2026-09-08' })] }));
    expect(plan.create.map((entry) => entry.sessionDate)).not.toContain('2026-09-08');
    expect(plan.cancel).toEqual([]);
    expect(plan.reschedule).toEqual([]);
  });

  it('legt für ein stillgelegtes Training nichts an', () => {
    const plan = planSessions(input({ training: { ...TRAINING, active: false } }));
    expect(plan.create).toEqual([]);
  });
});

// ------------------------------------------------------------------- Feiertage

describe('planSessions: Feiertage und Ferien', () => {
  const einheit: HolidayPeriod = {
    kind: 'public',
    startDate: '2026-10-03',
    endDate: '2026-10-03',
  };
  const herbstferien: HolidayPeriod = {
    kind: 'school',
    startDate: '2026-10-12',
    endDate: '2026-10-24',
  };

  it('legt an einem Feiertag gar keinen Termin an', () => {
    // Der 1. Mai 2026 ist ein Freitag; dazu ein freitägliches Training.
    const training: PlannedTraining = {
      ...TRAINING,
      weekday: 5,
      startDate: '2026-04-24',
    };
    const plan = planSessions(
      input({
        training,
        holidays: [{ kind: 'public', startDate: '2026-05-01', endDate: '2026-05-01' }],
        from: '2026-04-24',
        to: '2026-05-08',
      }),
    );
    expect(plan.create.map((entry) => entry.sessionDate)).toEqual([
      '2026-04-24',
      '2026-05-08',
    ]);
  });

  it('übergeht den Feiertag nicht, wenn das Training es nicht will', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, skipPublicHolidays: false, weekday: 6, startDate: '2026-10-03' },
        holidays: [einheit],
        from: '2026-10-01',
        to: '2026-10-10',
      }),
    );
    expect(plan.create.map((entry) => entry.sessionDate)).toContain('2026-10-03');
  });

  it('lässt Schulferien nur aus, wenn das Training es verlangt', () => {
    const ferien = input({
      holidays: [herbstferien],
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(planSessions(ferien).create.map((entry) => entry.sessionDate)).toContain('2026-10-13');

    const plan = planSessions({
      ...ferien,
      training: { ...TRAINING, skipSchoolHolidays: true },
    });
    expect(plan.create.map((entry) => entry.sessionDate)).toEqual(['2026-10-06', '2026-10-27']);
  });

  it('sagt einen bestehenden Termin ab, wenn er auf einen Feiertag fällt', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, weekday: 6, startDate: '2026-10-03' },
        holidays: [einheit],
        existing: [session({ sessionDate: '2026-10-03' })],
        from: '2026-10-01',
        to: '2026-10-10',
      }),
    );
    expect(plan.cancel).toEqual([
      { id: 's-2026-10-03', reason: REASON_PUBLIC_HOLIDAY, cancellationId: null },
    ]);
  });

  it('nennt bei Ferien auch den Grund', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, skipSchoolHolidays: true },
        holidays: [herbstferien],
        existing: [session({ sessionDate: '2026-10-13' })],
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    );
    expect(plan.cancel[0].reason).toBe(REASON_SCHOOL_HOLIDAY);
  });
});

// ------------------------------------------------------------------- Ausfälle

describe('planSessions: Ausfälle', () => {
  const trainingAusfall: CancellationPeriod = {
    id: 'c-1',
    trainingId: 't-1',
    venueId: null,
    fromDate: '2026-09-07',
    toDate: '2026-09-09',
    reason: 'Trainer im Urlaub',
  };

  const hallenAusfall: CancellationPeriod = {
    id: 'c-2',
    trainingId: null,
    venueId: 'v-1',
    fromDate: '2026-09-14',
    toDate: '2026-09-16',
    reason: 'Halle ist Wahllokal',
  };

  it('legt den Termin im Ausfall trotzdem an — abgesagt, mit Grund', () => {
    const plan = planSessions(input({ cancellations: [trainingAusfall] }));
    const entry = plan.create.find((row) => row.sessionDate === '2026-09-08');
    expect(entry?.cancelled).toBe(true);
    expect(entry?.cancelReason).toBe('Trainer im Urlaub');
    expect(entry?.cancellationId).toBe('c-1');
  });

  it('trifft auch der Ausfall einer ganzen Halle', () => {
    const plan = planSessions(input({ cancellations: [hallenAusfall] }));
    expect(plan.create.find((row) => row.sessionDate === '2026-09-15')?.cancellationId).toBe('c-2');
  });

  it('lässt ein Training in einer anderen Halle in Ruhe', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, venueId: 'v-2' },
        cancellations: [hallenAusfall],
      }),
    );
    expect(plan.create.every((row) => !row.cancelled)).toBe(true);
  });

  it('sagt einen bestehenden Termin ab', () => {
    const plan = planSessions(
      input({
        cancellations: [trainingAusfall],
        existing: [session({ sessionDate: '2026-09-08' })],
      }),
    );
    expect(plan.cancel).toEqual([
      { id: 's-2026-09-08', reason: 'Trainer im Urlaub', cancellationId: 'c-1' },
    ]);
  });

  it('sagt einen schon abgesagten Termin nicht noch einmal ab', () => {
    const plan = planSessions(
      input({
        cancellations: [trainingAusfall],
        existing: [session({ sessionDate: '2026-09-08', cancelled: true, cancellationId: 'c-1' })],
      }),
    );
    expect(plan.cancel).toEqual([]);
    expect(plan.uncancel).toEqual([]);
  });

  it('öffnet den Termin wieder, wenn der Ausfall zurückgenommen wurde', () => {
    const plan = planSessions(
      input({
        existing: [session({ sessionDate: '2026-09-08', cancelled: true, cancellationId: 'c-1' })],
      }),
    );
    expect(plan.uncancel).toEqual([{ id: 's-2026-09-08' }]);
  });

  it('nimmt eine Absage von Hand nicht zurück', () => {
    const plan = planSessions(
      input({
        existing: [session({ sessionDate: '2026-09-08', cancelled: true, cancellationId: null })],
      }),
    );
    expect(plan.uncancel).toEqual([]);
    expect(plan.cancel).toEqual([]);
  });
});

// ------------------------------------------------------------------- Änderungen

describe('planSessions: Änderungen am Training', () => {
  it('verschiebt bestehende Termine, wenn sich die Uhrzeit ändert', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, timeStart: '18:30:00' },
        existing: [session({ sessionDate: '2026-09-08' })],
        to: '2026-09-08',
      }),
    );
    expect(plan.reschedule).toEqual([
      {
        id: 's-2026-09-08',
        startsAt: '2026-09-08T16:30:00.000Z',
        endsAt: '2026-09-08T19:00:00.000Z',
      },
    ]);
  });

  it('sagt Termine ab, die nach einer Änderung nicht mehr zur Regel passen', () => {
    const plan = planSessions(
      input({
        // Jetzt mittwochs: der bestehende Dienstagstermin gehört nicht mehr dazu.
        training: { ...TRAINING, weekday: 3 },
        existing: [session({ sessionDate: '2026-09-08' })],
      }),
    );
    expect(plan.cancel).toEqual([
      { id: 's-2026-09-08', reason: REASON_OUT_OF_PLAN, cancellationId: null },
    ]);
  });

  it('sagt die Termine eines stillgelegten Trainings ab', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, active: false },
        existing: [session({ sessionDate: '2026-09-08' })],
      }),
    );
    expect(plan.cancel).toEqual([
      { id: 's-2026-09-08', reason: REASON_INACTIVE, cancellationId: null },
    ]);
  });

  it('rührt Termine außerhalb des Fensters nicht an', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, active: false },
        existing: [session({ sessionDate: '2026-08-04' })],
      }),
    );
    expect(plan.cancel).toEqual([]);
  });
});

describe('HORIZON_DAYS', () => {
  it('plant acht Wochen im Voraus', () => {
    expect(HORIZON_DAYS).toBe(56);
    expect(addDays('2026-09-01', HORIZON_DAYS)).toBe('2026-10-27');
  });
});

// ------------------------------------------------------------------- Standardort

describe('Hallensperre und Training ohne Ort', () => {
  const noVenue: PlannedTraining = { ...TRAINING, venueId: null };
  const blocked: CancellationPeriod = {
    id: 'c-halle',
    trainingId: null,
    venueId: 'v-1',
    fromDate: '2026-09-08',
    toDate: '2026-09-08',
    reason: 'Halle gesperrt',
  };

  it('trifft ein Training ohne Ort, wenn die Halle der Standardort ist', () => {
    const plan = planSessions(
      input({ training: noVenue, cancellations: [blocked], defaultVenueId: 'v-1' }),
    );
    const day = plan.create.find((entry) => entry.sessionDate === '2026-09-08');
    expect(day?.cancelled).toBe(true);
    expect(day?.cancellationId).toBe('c-halle');
  });

  it('ohne Standardort bleibt es wie bisher', () => {
    const plan = planSessions(input({ training: noVenue, cancellations: [blocked] }));
    expect(plan.create.find((entry) => entry.sessionDate === '2026-09-08')?.cancelled).toBe(false);
  });

  it('der eigene Ort geht dem Standardort vor', () => {
    const plan = planSessions(
      input({
        training: { ...TRAINING, venueId: 'v-2' },
        cancellations: [blocked],
        defaultVenueId: 'v-1',
      }),
    );
    expect(plan.create.find((entry) => entry.sessionDate === '2026-09-08')?.cancelled).toBe(false);
  });

  it('sagt einen bestehenden Termin ab, wenn die Sperre später kommt', () => {
    const plan = planSessions(
      input({
        training: noVenue,
        cancellations: [blocked],
        defaultVenueId: 'v-1',
        existing: [session({ sessionDate: '2026-09-08' })],
      }),
    );
    expect(plan.cancel).toEqual([
      { id: 's-2026-09-08', reason: 'Halle gesperrt', cancellationId: 'c-halle' },
    ]);
  });
});
