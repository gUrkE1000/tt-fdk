import { describe, it, expect } from 'vitest';
import {
  CATCH_UP_HOURS,
  formatOpenItems,
  planMatchReminders,
  planOpenReminders,
  planTrainingReminders,
  type OpenItem,
  type ReminderCandidate,
  type ReminderMatch,
  type ReminderSession,
  type TrainingReminderInput,
} from '../../supabase/functions/_shared/reminderPlanner';

// Das Spiel beginnt Montag, 5.10.2026 um 19:00 Ortszeit (17:00 UTC).
const START = '2026-10-05T17:00:00Z';

const match: ReminderMatch = { id: 'm-1', startsAt: START, version: 1, active: true };

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    matchId: 'm-1',
    profileId: 'p-1',
    hoursBefore: 24,
    eligible: true,
    ...overrides,
  };
}

function at(iso: string): Date {
  return new Date(iso);
}

describe('planMatchReminders', () => {
  it('erinnert genau zum eigenen Vorlauf', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T17:00:00Z'),
      matches: [match],
      candidates: [candidate()],
      alreadySent: [],
    });

    expect(actions).toEqual([{ matchId: 'm-1', profileId: 'p-1', matchVersion: 1 }]);
  });

  it('erinnert nicht zu früh', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T16:00:00Z'),
      matches: [match],
      candidates: [candidate()],
      alreadySent: [],
    });

    expect(actions).toEqual([]);
  });

  it('holt eine verpasste Erinnerung im Fangfenster nach', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T22:00:00Z'), // fünf Stunden zu spät
      matches: [match],
      candidates: [candidate()],
      alreadySent: [],
    });

    expect(actions).toHaveLength(1);
  });

  it('holt nach dem Fangfenster nichts mehr nach', () => {
    const actions = planMatchReminders({
      now: at('2026-10-05T00:00:00Z'), // sieben Stunden zu spät
      matches: [match],
      candidates: [candidate()],
      alreadySent: [],
    });

    expect(CATCH_UP_HOURS).toBe(6);
    expect(actions).toEqual([]);
  });

  it('erinnert nicht nach Spielbeginn', () => {
    const actions = planMatchReminders({
      now: at('2026-10-05T18:00:00Z'),
      matches: [match],
      candidates: [candidate({ hoursBefore: 1 })],
      alreadySent: [],
    });

    expect(actions).toEqual([]);
  });

  it('erinnert nicht zweimal an dieselbe Fassung', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T17:00:00Z'),
      matches: [match],
      candidates: [candidate()],
      alreadySent: [{ matchId: 'm-1', profileId: 'p-1', matchVersion: 1 }],
    });

    expect(actions).toEqual([]);
  });

  it('erinnert nach einer Verlegung erneut', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T17:00:00Z'),
      matches: [{ ...match, version: 2 }],
      candidates: [candidate()],
      alreadySent: [{ matchId: 'm-1', profileId: 'p-1', matchVersion: 1 }],
    });

    expect(actions).toEqual([{ matchId: 'm-1', profileId: 'p-1', matchVersion: 2 }]);
  });

  it('übergeht, wer nicht gefragt ist', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T17:00:00Z'),
      matches: [match],
      candidates: [candidate({ eligible: false })],
      alreadySent: [],
    });

    expect(actions).toEqual([]);
  });

  it('übergeht, wer den Vorlauf auf null gestellt hat', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T17:00:00Z'),
      matches: [match],
      candidates: [candidate({ hoursBefore: 0 })],
      alreadySent: [],
    });

    expect(actions).toEqual([]);
  });

  it('übergeht abgesagte Spiele', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T17:00:00Z'),
      matches: [{ ...match, active: false }],
      candidates: [candidate()],
      alreadySent: [],
    });

    expect(actions).toEqual([]);
  });

  it('achtet den Vorlauf jeder Person einzeln', () => {
    const actions = planMatchReminders({
      now: at('2026-10-04T17:00:00Z'),
      matches: [match],
      candidates: [
        candidate({ profileId: 'p-24', hoursBefore: 24 }),
        candidate({ profileId: 'p-48', hoursBefore: 48 }),
        candidate({ profileId: 'p-2', hoursBefore: 2 }),
      ],
      alreadySent: [],
    });

    // p-48 war schon dran (und außerhalb des Fangfensters), p-2 kommt erst später.
    expect(actions.map((action) => action.profileId)).toEqual(['p-24']);
  });
});

// --------------------------------------------------------------------------------

function item(overrides: Partial<OpenItem> = {}): OpenItem {
  return {
    profileId: 'p-1',
    kind: 'match',
    id: 'm-1',
    startsAt: START,
    title: '1. Herren gegen TTC Nachbarstadt',
    ...overrides,
  };
}

describe('planOpenReminders', () => {
  const base = {
    sendAfter: '18:00',
    withinDays: 14,
    today: '2026-09-28',
  };

  it('schickt einen Sammelhinweis mit allen offenen Terminen', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T17:00:00Z'), // 19:00 Ortszeit
      openItems: [item(), item({ id: 'm-2', startsAt: '2026-10-08T17:00:00Z' })],
      sentToday: [],
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].items).toHaveLength(2);
  });

  it('schickt vor der eingestellten Uhrzeit nichts', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T10:00:00Z'), // 12:00 Ortszeit
      openItems: [item()],
      sentToday: [],
    });

    expect(actions).toEqual([]);
  });

  it('schickt niemandem zweimal am selben Tag', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T17:00:00Z'),
      openItems: [item()],
      sentToday: ['p-1'],
    });

    expect(actions).toEqual([]);
  });

  it('übergeht Termine außerhalb des Zeitraums', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T17:00:00Z'),
      openItems: [item({ startsAt: '2026-12-01T17:00:00Z' })],
      sentToday: [],
    });

    expect(actions).toEqual([]);
  });

  it('übergeht Termine in der Vergangenheit', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T17:00:00Z'),
      openItems: [item({ startsAt: '2026-09-01T17:00:00Z' })],
      sentToday: [],
    });

    expect(actions).toEqual([]);
  });

  it('bündelt je Person, nicht je Termin', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T17:00:00Z'),
      openItems: [
        item({ profileId: 'p-1' }),
        item({ profileId: 'p-1', id: 'm-2', startsAt: '2026-10-08T17:00:00Z' }),
        item({ profileId: 'p-2' }),
      ],
      sentToday: [],
    });

    expect(actions.map((action) => action.profileId)).toEqual(['p-1', 'p-2']);
    expect(actions[0].items).toHaveLength(2);
  });

  it('sortiert die Termine nach Datum', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T17:00:00Z'),
      openItems: [
        item({ id: 'spaet', startsAt: '2026-10-08T17:00:00Z' }),
        item({ id: 'frueh', startsAt: '2026-10-01T17:00:00Z' }),
      ],
      sentToday: [],
    });

    expect(actions[0].items.map((entry) => entry.id)).toEqual(['frueh', 'spaet']);
  });

  it('meldet nichts, wenn es nichts Offenes gibt', () => {
    const actions = planOpenReminders({
      ...base,
      now: at('2026-09-28T17:00:00Z'),
      openItems: [],
      sentToday: [],
    });

    expect(actions).toEqual([]);
  });
});

describe('formatOpenItems', () => {
  it('schreibt eine lesbare Zeile je Termin', () => {
    const text = formatOpenItems([item()]);
    expect(text).toContain('1. Herren gegen TTC Nachbarstadt');
    expect(text).toMatch(/^• Mo\., 05\.10\., 19:00 Uhr —/);
  });

  it('trennt mehrere Termine durch Zeilenumbrüche', () => {
    const text = formatOpenItems([item(), item({ id: 'm-2' })]);
    expect(text.split('\n')).toHaveLength(2);
  });
});

// ------------------------------------------------------------------ Training

// Das Training beginnt am 6.10.2026 um 19:00 Ortszeit (17:00 UTC), Vorlauf fünf Stunden.
const TRAINING_START = '2026-10-06T17:00:00Z';

function session(overrides: Partial<ReminderSession> = {}): ReminderSession {
  return {
    id: 's-1',
    trainingId: 'tr-1',
    startsAt: TRAINING_START,
    cancelled: false,
    reminderSentAt: null,
    reminderHours: 5,
    ...overrides,
  };
}

function trainingInput(overrides: Partial<TrainingReminderInput> = {}): TrainingReminderInput {
  return {
    now: at('2026-10-06T12:30:00Z'),
    sessions: [session()],
    assignments: [
      { trainingId: 'tr-1', profileId: 'p-1' },
      { trainingId: 'tr-1', profileId: 'p-2' },
    ],
    answered: [],
    filters: [],
    ...overrides,
  };
}

describe('planTrainingReminders', () => {
  it('fragt beim Systemtraining die dem Termin Zugeteilten', () => {
    const actions = planTrainingReminders(
      trainingInput({
        assignments: [],
        sessionAssignments: [
          { sessionId: 's-1', profileId: 'p-7' },
          { sessionId: 's-2', profileId: 'p-8' },
        ],
      }),
    );
    expect(actions).toEqual([{ sessionId: 's-1', profileIds: ['p-7'] }]);
  });

  it('fragt niemanden doppelt, der zugeordnet und zugeteilt ist', () => {
    const actions = planTrainingReminders(
      trainingInput({ sessionAssignments: [{ sessionId: 's-1', profileId: 'p-1' }] }),
    );
    expect(actions[0].profileIds.sort()).toEqual(['p-1', 'p-2']);
  });

  it('fragt alle Zugeordneten, sobald der Vorlauf erreicht ist', () => {
    const actions = planTrainingReminders(trainingInput());
    expect(actions).toHaveLength(1);
    expect(actions[0].sessionId).toBe('s-1');
    expect(actions[0].profileIds.sort()).toEqual(['p-1', 'p-2']);
  });

  it('wartet, solange der Vorlauf nicht erreicht ist', () => {
    expect(planTrainingReminders(trainingInput({ now: at('2026-10-06T10:00:00Z') }))).toEqual([]);
  });

  it('holt eine verpasste Erinnerung im Fangfenster nach', () => {
    // Vorlauf 24 Stunden: fällig am 5.10. um 17:00, fünf Stunden später noch drin.
    const input = trainingInput({
      sessions: [session({ reminderHours: 24 })],
      now: at('2026-10-05T22:00:00Z'),
    });
    expect(planTrainingReminders(input)).toHaveLength(1);

    // Sieben Stunden später ist das Fangfenster zu.
    expect(
      planTrainingReminders({ ...input, now: at(`2026-10-06T00:00:00Z`) }),
    ).toEqual([]);
    expect(CATCH_UP_HOURS).toBe(6);
  });

  it('lässt eine viel zu späte Erinnerung liegen', () => {
    // Nach dem Beginn ist die Frage gegenstandslos.
    expect(planTrainingReminders(trainingInput({ now: at('2026-10-06T18:00:00Z') }))).toEqual([]);
  });

  it('fragt niemanden zu einem abgesagten Termin', () => {
    expect(
      planTrainingReminders(trainingInput({ sessions: [session({ cancelled: true })] })),
    ).toEqual([]);
  });

  it('fragt keinen Termin zweimal', () => {
    expect(
      planTrainingReminders(
        trainingInput({ sessions: [session({ reminderSentAt: '2026-10-06T12:00:00Z' })] }),
      ),
    ).toEqual([]);
  });

  it('schweigt, wenn das Training keine Erinnerung will', () => {
    expect(
      planTrainingReminders(trainingInput({ sessions: [session({ reminderHours: 0 })] })),
    ).toEqual([]);
  });

  it('übergeht, wer schon geantwortet hat', () => {
    const actions = planTrainingReminders(
      trainingInput({ answered: [{ sessionId: 's-1', profileId: 'p-1' }] }),
    );
    expect(actions[0].profileIds).toEqual(['p-2']);
  });

  it('achtet auf die Erinnerungsauswahl des Mitglieds', () => {
    const actions = planTrainingReminders(
      trainingInput({ filters: [{ profileId: 'p-1', trainingId: 'tr-2' }] }),
    );
    // p-1 hat eine Auswahl getroffen, dieses Training gehört nicht dazu.
    // p-2 hat keine — fehlende Einstellung heißt an.
    expect(actions[0].profileIds).toEqual(['p-2']);
  });

  it('erinnert, wenn das Training in der Auswahl steht', () => {
    const actions = planTrainingReminders(
      trainingInput({ filters: [{ profileId: 'p-1', trainingId: 'tr-1' }] }),
    );
    expect(actions[0].profileIds.sort()).toEqual(['p-1', 'p-2']);
  });

  it('nennt jede Person nur einmal, auch bei doppelter Zuordnung', () => {
    const actions = planTrainingReminders(
      trainingInput({
        assignments: [
          { trainingId: 'tr-1', profileId: 'p-1' },
          { trainingId: 'tr-1', profileId: 'p-1' },
        ],
      }),
    );
    expect(actions[0].profileIds).toEqual(['p-1']);
  });

  it('hakt einen Termin auch ohne Empfänger ab', () => {
    // Sonst prüfte ihn jeder Lauf aufs Neue, bis das Fangfenster zu ist.
    const actions = planTrainingReminders(trainingInput({ assignments: [] }));
    expect(actions).toHaveLength(1);
    expect(actions[0].profileIds).toEqual([]);
  });
});
