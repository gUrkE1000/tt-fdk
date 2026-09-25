import { useMemo } from 'react';
import { useSession } from '../auth/session';
import type { MemberSummary } from '../members/api';
import { useTeams, type TeamWithRoster } from '../teams/api';
import { useAllParticipations, useMatches, type MatchRow, type Participation } from './api';
import type { AbsenceWindow } from './lineupSections';
import type { Person } from '../../components/ui';

/**
 * Wen der Mannschaftsführer für ein Spiel anfragen kann (Migration match_requests).
 *
 * Reine Funktionen, damit Reihenfolge, Vorauswahl und Hinweise testbar sind, ohne den
 * Dialog zu rendern.
 */

export type CandidateGroup = 'regular' | 'substitute' | 'other';

export interface Candidate extends Person {
  group: CandidateGroup;
  /** Am Spieltag als abwesend eingetragen. */
  away: boolean;
}

const GROUP_ORDER: Record<CandidateGroup, number> = { regular: 0, substitute: 1, other: 2 };

/**
 * Alle, die sich anfragen lassen und noch nicht gefragt sind: erst die Stammspieler,
 * dann die Ersatzspieler in ihrer Reihenfolge, dann alle übrigen spielenden Mitglieder.
 * Wer am Spieltag abwesend ist, steht trotzdem in der Liste — mit Hinweis.
 */
export function requestCandidates(
  team: TeamWithRoster | undefined,
  members: MemberSummary[],
  participations: Participation[],
  matchDay: string,
  absences: AbsenceWindow[],
): Candidate[] {
  const asked = new Set(participations.map((entry) => entry.profile_id));
  const regular = new Set(team?.regularIds ?? []);
  const substituteRank = new Map((team?.substituteIds ?? []).map((id, index) => [id, index]));

  const candidates: (Candidate & { rank: number })[] = [];

  for (const member of members) {
    if (asked.has(member.id)) continue;
    if (member.status !== 'active' || member.role === 'guest' || member.no_games) continue;

    const group: CandidateGroup = regular.has(member.id)
      ? 'regular'
      : substituteRank.has(member.id)
        ? 'substitute'
        : 'other';

    const away = absences.some(
      (absence) =>
        absence.profileId === member.id &&
        absence.startDate <= matchDay &&
        absence.endDate >= matchDay,
    );

    const parts = [
      group === 'regular'
        ? 'Stammspieler'
        : group === 'substitute'
          ? `Ersatz ${substituteRank.get(member.id)! + 1}`
          : null,
      member.qttr != null ? `${member.qttr} QTTR` : null,
      away ? 'abwesend' : null,
    ].filter(Boolean);

    candidates.push({
      id: member.id,
      name: member.full_name ?? '',
      detail: parts.length > 0 ? parts.join(' · ') : undefined,
      group,
      away,
      rank: group === 'substitute' ? substituteRank.get(member.id)! : 0,
    });
  }

  return candidates
    .sort(
      (a, b) =>
        GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
        a.rank - b.rank ||
        a.name.localeCompare(b.name, 'de'),
    )
    .map(({ rank: _rank, ...candidate }) => candidate);
}

/**
 * Vorauswahl: Ist für das Spiel noch niemand gefragt, sind die Stammspieler angehakt —
 * außer denen, die am Spieltag abwesend sind. Verschickt wird erst mit „Anfragen".
 */
export function defaultSelection(
  candidates: Candidate[],
  participations: Participation[],
): string[] {
  if (participations.length > 0) return [];
  return candidates
    .filter((candidate) => candidate.group === 'regular' && !candidate.away)
    .map((candidate) => candidate.id);
}

/**
 * Wie weit „Offen für dich" nach vorn schaut. Wer nur zwei, drei Wochen im Voraus
 * anfragt, soll nicht die ganze Rückrunde als offen gezählt bekommen.
 */
export const REQUEST_WINDOW_DAYS = 21;

/** Kommende, nicht abgesagte Spiele im Zeitfenster, für die noch niemand gefragt ist. */
export function matchesWithoutRequests(
  matches: MatchRow[],
  participations: Participation[],
  teamIds: Set<string>,
  now: Date = new Date(),
  windowDays: number = REQUEST_WINDOW_DAYS,
): MatchRow[] {
  const withRequests = new Set(participations.map((entry) => entry.match_id));
  const from = now.getTime();
  const until = from + windowDays * 86_400_000;

  return matches
    .filter((match) => {
      // Als Zahl vergleichen: Die Zeitstempel kommen mal mit, mal ohne Millisekunden.
      const starts = match.dtstart ? Date.parse(match.dtstart) : NaN;
      return (
        teamIds.has(match.team_id) &&
        match.active &&
        starts > from &&
        starts <= until &&
        !withRequests.has(match.id)
      );
    })
    .sort((a, b) => (a.dtstart ?? '').localeCompare(b.dtstart ?? ''));
}

/**
 * Die Spiele der eigenen Mannschaften ohne Anfrage in den nächsten
 * `REQUEST_WINDOW_DAYS` Tagen — für „Offen für dich". Nur für
 * die Mannschaftsführung, nicht für den Administrator: Der sieht jede Mannschaft, und
 * „offen für dich" wäre dann der ganze Spielplan.
 */
export function useMatchesWithoutRequests(): MatchRow[] {
  const { profile } = useSession();
  const teams = useTeams();
  const matches = useMatches();
  const participations = useAllParticipations();
  const profileId = profile?.id ?? null;

  return useMemo(() => {
    if (!profileId) return [];
    const led = new Set(
      (teams.data ?? [])
        .filter((team) => team.leaderIds.includes(profileId))
        .map((team) => team.id),
    );
    if (led.size === 0) return [];
    return matchesWithoutRequests(matches.data ?? [], participations.data ?? [], led);
  }, [teams.data, matches.data, participations.data, profileId]);
}

/** Die Mannschaften, zu denen man gehört — Kader oder Führung. */
export function myTeamIds(teams: TeamWithRoster[], profileId: string | null): Set<string> {
  if (!profileId) return new Set();
  return new Set(
    teams
      .filter(
        (team) =>
          team.leaderIds.includes(profileId) ||
          team.regularIds.includes(profileId) ||
          team.substituteIds.includes(profileId),
      )
      .map((team) => team.id),
  );
}
