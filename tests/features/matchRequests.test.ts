import { describe, it, expect } from 'vitest';
import {
  defaultSelection,
  matchesWithoutRequests,
  myTeamIds,
  requestCandidates,
} from '../../src/features/matches/requests';
import type { MatchRow, Participation } from '../../src/features/matches/api';
import type { TeamWithRoster } from '../../src/features/teams/api';
import type { MemberSummary } from '../../src/features/members/api';

const team = {
  id: 't-1',
  leaderIds: ['p-lead'],
  regularIds: ['p-anna', 'p-bert'],
  substituteIds: ['p-ersatz2', 'p-ersatz1'],
} as unknown as TeamWithRoster;

function member(id: string, name: string, extra: Partial<MemberSummary> = {}): MemberSummary {
  return {
    id,
    full_name: name,
    status: 'active',
    role: 'member',
    no_games: false,
    qttr: null,
    ...extra,
  } as MemberSummary;
}

const members = [
  member('p-zora', 'Zora Zusatz'),
  member('p-ersatz1', 'Erik Ersatz'),
  member('p-bert', 'Bert Stamm', { qttr: 1500 }),
  member('p-anna', 'Anna Stamm'),
  member('p-ersatz2', 'Emil Ersatz'),
  member('p-gast', 'Gerd Gast', { role: 'guest' }),
  member('p-nogames', 'Nora Nie', { no_games: true }),
  member('p-pending', 'Paul Pending', { status: 'pending_approval' }),
];

function asked(profileId: string, matchId = 'm-1'): Participation {
  return { match_id: matchId, profile_id: profileId, response: 'none' } as Participation;
}

describe('requestCandidates', () => {
  it('ordnet Stammspieler, Ersatz nach Reihenfolge, dann alle übrigen', () => {
    const result = requestCandidates(team, members, [], '2026-10-08', []);
    expect(result.map((entry) => entry.id)).toEqual([
      'p-anna',
      'p-bert',
      'p-ersatz2',
      'p-ersatz1',
      'p-zora',
    ]);
    expect(result.find((entry) => entry.id === 'p-bert')?.detail).toBe('Stammspieler · 1500 QTTR');
    expect(result.find((entry) => entry.id === 'p-ersatz1')?.detail).toBe('Ersatz 2');
  });

  it('lässt Gäste, Spielbefreite, nicht Freigeschaltete und schon Gefragte weg', () => {
    const result = requestCandidates(team, members, [asked('p-anna')], '2026-10-08', []);
    const ids = result.map((entry) => entry.id);
    expect(ids).not.toContain('p-anna');
    expect(ids).not.toContain('p-gast');
    expect(ids).not.toContain('p-nogames');
    expect(ids).not.toContain('p-pending');
  });

  it('markiert, wer am Spieltag abwesend ist', () => {
    const result = requestCandidates(team, members, [], '2026-10-08', [
      { profileId: 'p-bert', startDate: '2026-10-01', endDate: '2026-10-10' },
    ]);
    const bert = result.find((entry) => entry.id === 'p-bert')!;
    expect(bert.away).toBe(true);
    expect(bert.detail).toMatch(/abwesend/);
  });
});

describe('defaultSelection', () => {
  it('hakt bei einem Spiel ohne Anfrage die anwesenden Stammspieler vor', () => {
    const candidates = requestCandidates(team, members, [], '2026-10-08', [
      { profileId: 'p-bert', startDate: '2026-10-08', endDate: '2026-10-08' },
    ]);
    expect(defaultSelection(candidates, [])).toEqual(['p-anna']);
  });

  it('wählt nichts vor, sobald jemand gefragt ist', () => {
    const candidates = requestCandidates(team, members, [asked('p-zora')], '2026-10-08', []);
    expect(defaultSelection(candidates, [asked('p-zora')])).toEqual([]);
  });
});

describe('matchesWithoutRequests', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  const match = (id: string, extra: Partial<MatchRow> = {}) =>
    ({
      id,
      team_id: 't-1',
      active: true,
      dtstart: '2026-10-08T17:00:00Z',
      ...extra,
    }) as MatchRow;

  it('findet kommende Spiele der eigenen Mannschaften ohne Anfrage', () => {
    const result = matchesWithoutRequests(
      [
        match('m-ohne', { dtstart: '2026-10-20T17:00:00Z' }),
        match('m-mit'),
        match('m-frueher', { dtstart: '2026-10-05T17:00:00Z' }),
        match('m-vorbei', { dtstart: '2026-09-20T17:00:00Z' }),
        match('m-abgesagt', { active: false }),
        match('m-fremd', { team_id: 't-2' }),
      ],
      [asked('p-anna', 'm-mit')],
      new Set(['t-1']),
      now,
    );
    expect(result.map((entry) => entry.id)).toEqual(['m-frueher', 'm-ohne']);
  });
});

describe('myTeamIds', () => {
  it('zählt Kader und Führung', () => {
    const other = {
      id: 't-2',
      leaderIds: [],
      regularIds: [],
      substituteIds: ['p-zora'],
    } as unknown as TeamWithRoster;
    expect([...myTeamIds([team, other], 'p-lead')]).toEqual(['t-1']);
    expect([...myTeamIds([team, other], 'p-zora')]).toEqual(['t-2']);
    expect([...myTeamIds([team, other], 'p-ersatz1')]).toEqual(['t-1']);
    expect(myTeamIds([team, other], null).size).toBe(0);
  });
});
