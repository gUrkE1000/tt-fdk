import { describe, it, expect } from 'vitest';
import {
  countConfirmed,
  planSubstituteStep,
  type EngineInput,
  type EngineParticipation,
  type EngineRequest,
} from '../../supabase/functions/_shared/substituteEngine';

// Das Spiel beginnt am 05.10.2026 um 19:00 Ortszeit; „jetzt" ist der Vortag.
const START = '2026-10-05T17:00:00Z';
const NOW = new Date('2026-10-04T10:00:00Z');

function player(overrides: Partial<EngineParticipation> & { profileId: string }): EngineParticipation {
  return {
    response: 'none',
    versionResponded: null,
    lineupPosition: null,
    removed: false,
    isRegular: true,
    ...overrides,
  };
}

function confirmed(profileId: string, position: number): EngineParticipation {
  return player({ profileId, response: 'yes', versionResponded: 1, lineupPosition: position });
}

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    now: NOW,
    timeoutHours: 24,
    match: {
      id: 'm-1',
      version: 1,
      startsAt: START,
      active: true,
      requiredPlayers: 4,
      lineupLocked: false,
    },
    team: { id: 't-1', substituteMode: 'sequential', manualAutoAdd: true },
    // Drei Zusagen, einer hat abgesagt: es fehlt genau einer.
    participations: [
      confirmed('p-1', 1),
      confirmed('p-2', 2),
      confirmed('p-3', 3),
      player({ profileId: 'p-4', response: 'no', versionResponded: 1 }),
    ],
    candidates: [
      { profileId: 's-1', rank: 1 },
      { profileId: 's-2', rank: 2 },
      { profileId: 's-3', rank: 3 },
    ],
    requests: [],
    absences: [],
    exhaustedNotified: false,
    ...overrides,
  };
}

function request(overrides: Partial<EngineRequest> & { id: string; profileId: string }): EngineRequest {
  return {
    rank: 1,
    status: 'pending',
    expiresAt: '2026-10-05T10:00:00Z',
    matchVersion: 1,
    createdBy: 'system',
    ...overrides,
  };
}

describe('countConfirmed', () => {
  it('zählt nur Zusagen in der Aufstellung', () => {
    expect(countConfirmed(input())).toBe(3);
  });

  it('zählt die Ersatzbank nicht mit', () => {
    expect(
      countConfirmed(
        input({
          participations: [confirmed('p-1', 1), confirmed('p-2', 5)],
        }),
      ),
    ).toBe(1);
  });

  it('zählt einen herausgenommenen Spieler nicht', () => {
    expect(
      countConfirmed(
        input({
          participations: [confirmed('p-1', 1), { ...confirmed('p-2', 2), removed: true }],
        }),
      ),
    ).toBe(1);
  });
});

describe('planSubstituteStep — sequentiell', () => {
  it('fragt den ersten Ersatzspieler nach Rang', () => {
    const actions = planSubstituteStep(input());

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: 'request', profileId: 's-1', rank: 1 });
  });

  it('setzt die Frist auf den Vorlauf der Mannschaft', () => {
    const actions = planSubstituteStep(input({ timeoutHours: 12 }));

    expect(actions[0]).toMatchObject({
      kind: 'request',
      expiresAt: '2026-10-04T22:00:00.000Z',
    });
  });

  it('setzt die Frist nie über den Spielbeginn hinaus', () => {
    const actions = planSubstituteStep(input({ timeoutHours: 72 }));

    expect(actions[0]).toMatchObject({
      kind: 'request',
      expiresAt: new Date(START).toISOString(),
    });
  });

  it('wartet, solange eine Anfrage offen ist', () => {
    const actions = planSubstituteStep(
      input({ requests: [request({ id: 'r-1', profileId: 's-1' })] }),
    );

    expect(actions).toEqual([]);
  });

  it('rückt nach einer Absage zum nächsten weiter', () => {
    const actions = planSubstituteStep(
      input({ requests: [request({ id: 'r-1', profileId: 's-1', status: 'declined' })] }),
    );

    expect(actions).toEqual([
      expect.objectContaining({ kind: 'request', profileId: 's-2', rank: 2 }),
    ]);
  });

  it('lässt eine überfällige Anfrage ablaufen und fragt im selben Zug nicht weiter', () => {
    const actions = planSubstituteStep(
      input({
        now: new Date('2026-10-05T11:00:00Z'),
        requests: [request({ id: 'r-1', profileId: 's-1' })],
      }),
    );

    // Die abgelaufene Anfrage wird geschlossen; der nächste kommt im nächsten Lauf
    // dran, wenn der Abschluss auch wirklich geschrieben ist.
    expect(actions).toContainEqual({ kind: 'expire', requestId: 'r-1' });
  });

  it('überspringt, wer am Spieltag abwesend ist', () => {
    const actions = planSubstituteStep(
      input({ absences: [{ profileId: 's-1', startDate: '2026-10-01', endDate: '2026-10-07' }] }),
    );

    expect(actions[0]).toMatchObject({ kind: 'request', profileId: 's-2' });
  });

  it('fragt niemanden zweimal zur selben Fassung', () => {
    const actions = planSubstituteStep(
      input({
        requests: [
          request({ id: 'r-1', profileId: 's-1', status: 'declined' }),
          request({ id: 'r-2', profileId: 's-2', status: 'expired' }),
        ],
      }),
    );

    expect(actions).toEqual([
      expect.objectContaining({ kind: 'request', profileId: 's-3' }),
    ]);
  });

  it('fragt nicht, wer für diese Fassung schon geantwortet hat', () => {
    const actions = planSubstituteStep(
      input({
        participations: [
          ...input().participations,
          player({ profileId: 's-1', response: 'no', versionResponded: 1 }),
        ],
      }),
    );

    expect(actions[0]).toMatchObject({ kind: 'request', profileId: 's-2' });
  });

  it('fragt wieder, wenn die Antwort zu einer alten Fassung gehörte', () => {
    const actions = planSubstituteStep(
      input({
        participations: [
          ...input().participations,
          player({ profileId: 's-1', response: 'no', versionResponded: 0 }),
        ],
      }),
    );

    expect(actions[0]).toMatchObject({ kind: 'request', profileId: 's-1' });
  });
});

describe('planSubstituteStep — parallel', () => {
  const parallel = { id: 't-1', substituteMode: 'parallel' as const, manualAutoAdd: true };

  it('fragt so viele gleichzeitig, wie fehlen', () => {
    const actions = planSubstituteStep(
      input({
        team: parallel,
        participations: [confirmed('p-1', 1), confirmed('p-2', 2)],
      }),
    );

    expect(actions.filter((action) => action.kind === 'request')).toHaveLength(2);
  });

  it('zählt offene Anfragen gegen den Bedarf', () => {
    const actions = planSubstituteStep(
      input({
        team: parallel,
        participations: [confirmed('p-1', 1), confirmed('p-2', 2)],
        requests: [request({ id: 'r-1', profileId: 's-1' })],
      }),
    );

    expect(actions.filter((action) => action.kind === 'request')).toHaveLength(1);
  });

  it('fragt nicht mehr Leute als nötig', () => {
    const actions = planSubstituteStep(input({ team: parallel }));

    // Es fehlt genau einer, also genau eine Anfrage — auch wenn drei bereitstehen.
    expect(actions.filter((action) => action.kind === 'request')).toHaveLength(1);
  });
});

describe('planSubstituteStep — Aufräumen', () => {
  it('bricht Anfragen zu einer überholten Fassung ab', () => {
    const actions = planSubstituteStep(
      input({ requests: [request({ id: 'r-1', profileId: 's-1', matchVersion: 0 })] }),
    );

    expect(actions).toContainEqual({
      kind: 'cancel',
      requestId: 'r-1',
      reason: 'Der Termin hat sich geändert.',
    });
  });

  it('bricht Anfragen zu einem abgesagten Spiel ab', () => {
    const base = input();
    const actions = planSubstituteStep({
      ...base,
      match: { ...base.match, active: false },
      requests: [request({ id: 'r-1', profileId: 's-1' })],
    });

    expect(actions).toEqual([
      { kind: 'cancel', requestId: 'r-1', reason: 'Das Spiel entfällt.' },
    ]);
  });

  it('bricht offene Anfragen ab, sobald genug Spieler da sind', () => {
    const actions = planSubstituteStep(
      input({
        participations: [
          confirmed('p-1', 1),
          confirmed('p-2', 2),
          confirmed('p-3', 3),
          confirmed('p-4', 4),
        ],
        requests: [request({ id: 'r-1', profileId: 's-1' })],
      }),
    );

    expect(actions).toEqual([
      { kind: 'cancel', requestId: 'r-1', reason: 'Es sind genug Spieler zusammen.' },
    ]);
  });

  it('tut nichts, wenn die Mannschaft vollzählig ist', () => {
    const actions = planSubstituteStep(
      input({
        participations: [
          confirmed('p-1', 1),
          confirmed('p-2', 2),
          confirmed('p-3', 3),
          confirmed('p-4', 4),
        ],
      }),
    );

    expect(actions).toEqual([]);
  });
});

describe('planSubstituteStep — Grenzfälle', () => {
  it('fragt im Modus „manuell" niemanden von selbst', () => {
    const actions = planSubstituteStep(
      input({ team: { id: 't-1', substituteMode: 'manual', manualAutoAdd: true } }),
    );

    expect(actions).toEqual([]);
  });

  it('räumt auch im Modus „manuell" auf', () => {
    const actions = planSubstituteStep(
      input({
        team: { id: 't-1', substituteMode: 'manual', manualAutoAdd: true },
        requests: [request({ id: 'r-1', profileId: 's-1', matchVersion: 0 })],
      }),
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe('cancel');
  });

  it('hört auf, sobald der Mannschaftsführer die Aufstellung gesetzt hat', () => {
    const base = input();
    const actions = planSubstituteStep({
      ...base,
      match: { ...base.match, lineupLocked: true },
    });

    expect(actions).toEqual([]);
  });

  it('meldet die leere Kette, wenn niemand mehr übrig ist', () => {
    const actions = planSubstituteStep(
      input({
        requests: [
          request({ id: 'r-1', profileId: 's-1', status: 'declined' }),
          request({ id: 'r-2', profileId: 's-2', status: 'declined' }),
          request({ id: 'r-3', profileId: 's-3', status: 'expired' }),
        ],
      }),
    );

    expect(actions).toEqual([{ kind: 'exhausted' }]);
  });

  it('meldet die leere Kette nur einmal je Fassung', () => {
    const actions = planSubstituteStep(
      input({
        exhaustedNotified: true,
        requests: [
          request({ id: 'r-1', profileId: 's-1', status: 'declined' }),
          request({ id: 'r-2', profileId: 's-2', status: 'declined' }),
          request({ id: 'r-3', profileId: 's-3', status: 'declined' }),
        ],
      }),
    );

    expect(actions).toEqual([]);
  });

  it('meldet die leere Kette nicht, solange noch jemand antworten kann', () => {
    const actions = planSubstituteStep(
      input({
        candidates: [{ profileId: 's-1', rank: 1 }],
        requests: [request({ id: 'r-1', profileId: 's-1' })],
      }),
    );

    expect(actions).toEqual([]);
  });

  it('fragt nach Spielbeginn niemanden mehr', () => {
    const actions = planSubstituteStep(input({ now: new Date('2026-10-05T18:00:00Z') }));

    expect(actions).toEqual([]);
  });

  it('kommt ohne Ersatzspieler zurecht', () => {
    const actions = planSubstituteStep(input({ candidates: [] }));

    expect(actions).toEqual([{ kind: 'exhausted' }]);
  });
});
