import { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Inbox, MessageSquareWarning } from 'lucide-react';
import TableTennis from '../../components/icons/TableTennis';
import { PageHeader, StatTile } from '../../components/ui';
import { useSession } from '../auth/session';
import { useClubSettings } from '../club/api';
import { useAllParticipations, useMatches } from '../matches/api';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useSessionAssignees, useTrainings, useTrainingSessions } from '../trainings/api';
import { isMySession } from '../trainings/schemas';
import SubstituteBanner from '../substitutes/SubstituteBanner';
import CountdownTile, { countdownLabel } from './CountdownTile';
import { useMyOpenItems } from './openItems';
import QuickLinks from './QuickLinks';
import {
  calendarDaysUntil,
  countOpenResponses,
  matchCountdown,
  movedDashboardTab,
  parseQuicklinks,
} from './summary';
import { formatDateTime } from '../../lib/dates';
import { trainingPath } from '../../lib/paths';

/**
 * Die Übersicht (Aufgabe 8.1).
 *
 * Nur Kacheln, die zu den Seiten führen, auf denen man etwas tut — keine Funktion steht
 * allein hier. Trainings, offene Trainings und Schlüsseldienst haben eigene Seiten,
 * offene Antworten stehen unter „Meine Termine", der Kalender unter „Kalender".
 */
export default function DashboardPage() {
  const { profile, role } = useSession();
  const profileId = profile?.id ?? null;

  const matches = useMatches();
  const participations = useAllParticipations();
  const teams = useTeams();
  const venues = useVenues();
  const trainings = useTrainings();
  const sessions = useTrainingSessions();
  const assignees = useSessionAssignees();
  const settings = useClubSettings();

  const countdown = useMemo(
    () => matchCountdown(matches.data ?? [], participations.data ?? [], profileId),
    [matches.data, participations.data, profileId],
  );

  const nextTeam = (teams.data ?? []).find((team) => team.id === countdown.next?.team_id);
  const nextVenue = (venues.data ?? []).find((venue) => venue.id === countdown.next?.venue_id);

  /**
   * Nur für Mannschaftsführer, und nur für die eigenen Mannschaften — auch wenn der
   * Mannschaftsführer zugleich Administrator ist. Eine Zahl über den ganzen Verein
   * brachte niemandem etwas: Nachfassen kann nur, wer die Mannschaft führt.
   */
  const leaderTeamIds = useMemo(
    () =>
      new Set(
        (teams.data ?? [])
          .filter((team) => profileId && team.leaderIds.includes(profileId))
          .map((team) => team.id),
      ),
    [teams.data, profileId],
  );

  const showOpenResponses = leaderTeamIds.size > 0;

  const openResponses = useMemo(
    () => countOpenResponses(matches.data ?? [], participations.data ?? [], leaderTeamIds),
    [matches.data, participations.data, leaderTeamIds],
  );

  // Ohne useMemo wäre `?? []` bei jedem Rendern ein neues Array — und jedes useMemo,
  // das davon abhängt, rechnete jedes Mal neu.
  const trainingList = useMemo(() => trainings.data ?? [], [trainings.data]);

  // Beim Systemtraining zählt die Zuteilung zum einzelnen Termin.
  const isMine = useMemo(() => {
    const assigned = new Set(
      (assignees.data ?? [])
        .filter((entry) => entry.profile_id === profileId)
        .map((entry) => entry.session_id),
    );
    const byId = new Map(trainingList.map((training) => [training.id, training]));
    return (session: { id: string; training_id: string }) =>
      isMySession(session, byId.get(session.training_id), profileId, assigned);
  }, [assignees.data, trainingList, profileId]);

  // Das nächste eigene Training, das nicht ausfällt — die zweite Frage nach „wann
  // spiele ich": wann bin ich das nächste Mal in der Halle?
  const nextTraining = useMemo(() => {
    const now = Date.now();
    const session = (sessions.data ?? [])
      .filter((entry) => isMine(entry) && !entry.cancelled)
      .filter((entry) => new Date(entry.starts_at).getTime() >= now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    if (!session) return null;
    return {
      session,
      name: trainingList.find((entry) => entry.id === session.training_id)?.name ?? 'Training',
    };
  }, [sessions.data, trainingList, isMine]);

  const openItems = useMyOpenItems(profileId);
  const openCount = openItems.data?.length ?? 0;

  const quicklinks = parseQuicklinks(settings.data?.quicklinks_json);

  const [params] = useSearchParams();
  const moved = movedDashboardTab(
    params.get('tab'),
    params,
    role === 'admin' || profile?.key_service === true,
  );
  if (moved) return <Navigate to={moved} replace />;

  return (
    <div>
      <PageHeader
        title={profile?.first_name ? `Hallo ${profile.first_name}` : 'Übersicht'}
        description="Was als Nächstes ansteht — und wo du noch gefragt bist."
      />

      <SubstituteBanner
        describe={(request) => {
          const forMatch = (matches.data ?? []).find((entry) => entry.id === request.match_id);
          if (!forMatch) return 'Ein Spieltermin';
          const team = (teams.data ?? []).find((entry) => entry.id === forMatch.team_id);
          return `${team?.name ?? 'Mannschaft'} gegen ${forMatch.opponent || 'unbekannt'}`;
        }}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <CountdownTile
          countdown={countdown}
          teamName={nextTeam?.name}
          location={nextVenue?.name}
          loading={matches.isLoading || participations.isLoading}
          error={matches.isError || participations.isError}
        />

        <StatTile
          label="Offen für dich"
          value={openItems.isLoading ? '…' : openCount}
          hint={
            openCount === 0
              ? 'Überall geantwortet'
              : `${openCount === 1 ? 'Termin oder Umfrage wartet' : 'Termine und Umfragen warten'} auf deine Antwort`
          }
          icon={Inbox}
          tone={openCount > 0 ? 'warning' : 'success'}
          to="/my-dates?tab=open"
        />

        {nextTraining && (
          <StatTile
            label="Nächstes Training"
            value={countdownLabel(calendarDaysUntil(nextTraining.session.starts_at, new Date()))}
            hint={`${nextTraining.name} · ${formatDateTime(nextTraining.session.starts_at)}`}
            icon={TableTennis}
            to={trainingPath(nextTraining.session.id)}
          />
        )}

        {/* Nicht die eigenen offenen Antworten (die stehen unter „Offen für dich"),
            sondern die der angefragten Spieler in den eigenen Mannschaften. Früher hieß
            die Kachel „Offene Rückmeldungen" und wurde für die eigene Zahl gehalten. */}
        {showOpenResponses && (
          <StatTile
            label="Spieler ohne Antwort"
            value={openResponses.players}
            hint={
              openResponses.players === 0
                ? 'Alle Angefragten deiner Mannschaften haben geantwortet'
                : `Angefragte bei ${openResponses.matches} ${
                    openResponses.matches === 1 ? 'Spiel' : 'Spielen'
                  } deiner Mannschaften`
            }
            icon={MessageSquareWarning}
            tone={openResponses.players > 0 ? 'warning' : 'success'}
            to="/games"
          />
        )}
      </div>

      <div>
        <QuickLinks links={quicklinks} canEdit={role === 'admin'} />
      </div>
    </div>
  );
}
