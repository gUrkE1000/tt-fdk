import { useMemo } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { PageHeader, StatTile, Tabs } from '../../components/ui';
import { useSession } from '../auth/session';
import { useClubSettings } from '../club/api';
import { useAllParticipations, useMatches } from '../matches/api';
import MyGamesList from '../matches/MyGamesList';
import { useTeams } from '../teams/api';
import { useVenues } from '../venues/api';
import { useTrainings, useTrainingSessions } from '../trainings/api';
import { myTrainingIds, openTrainings } from '../trainings/schemas';
import SessionsTab from '../trainings/SessionsTab';
import OpenTrainingsList from '../trainings/OpenTrainingsList';
import PlanningTab from '../calendar/PlanningTab';
import MyKeysTab from '../keys/MyKeysTab';
import CountdownTile from './CountdownTile';
import QuickLinks from './QuickLinks';
import { countOpenResponses, matchCountdown, parseQuicklinks } from './summary';

/**
 * Die Übersicht (Aufgabe 8.1).
 *
 * Sie erfindet nichts Eigenes, sondern stellt zusammen, was anderswo schon steht: die
 * Spielkarten von „Meine Spiele", die Trainingstermine, den Kalender. Dieselben
 * Komponenten, damit eine Änderung an der Spielkarte nicht an zwei Stellen nachgezogen
 * werden muss — und damit die Karte hier wie dort dieselbe Antwort erlaubt.
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
  const settings = useClubSettings();

  const countdown = useMemo(
    () => matchCountdown(matches.data ?? [], participations.data ?? [], profileId),
    [matches.data, participations.data, profileId],
  );

  const nextTeam = (teams.data ?? []).find((team) => team.id === countdown.next?.team_id);
  const nextVenue = (venues.data ?? []).find((venue) => venue.id === countdown.next?.venue_id);

  /**
   * Der Administrator sieht alle Mannschaften, der Mannschaftsführer nur seine. Ein
   * Trainer bekommt die Kachel gar nicht — Rückmeldungen zu Spielen sind nicht seine
   * Baustelle.
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

  const showOpenResponses = role === 'admin' || leaderTeamIds.size > 0;

  const openResponses = useMemo(
    () =>
      countOpenResponses(
        matches.data ?? [],
        participations.data ?? [],
        role === 'admin' ? null : leaderTeamIds,
      ),
    [matches.data, participations.data, role, leaderTeamIds],
  );

  // Ohne useMemo wäre `?? []` bei jedem Rendern ein neues Array — und jedes useMemo,
  // das davon abhängt, rechnete jedes Mal neu.
  const trainingList = useMemo(() => trainings.data ?? [], [trainings.data]);

  const mySessionCount = useMemo(() => {
    const mine = myTrainingIds(trainingList, profileId);
    return (sessions.data ?? []).filter((session) => mine.has(session.training_id)).length;
  }, [sessions.data, trainingList, profileId]);

  const openTrainingCount = openTrainings(trainingList).length;

  const quicklinks = parseQuicklinks(settings.data?.quicklinks_json);

  return (
    <div>
      <PageHeader
        title={profile?.first_name ? `Hallo ${profile.first_name}` : 'Übersicht'}
        description="Was als Nächstes ansteht — und wo du noch gefragt bist."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <CountdownTile countdown={countdown} teamName={nextTeam?.name} location={nextVenue?.name} />

        {showOpenResponses && (
          <StatTile
            label="Offene Rückmeldungen"
            value={openResponses.players}
            hint={`Spieler bei ${openResponses.matches} ${
              openResponses.matches === 1 ? 'Spiel' : 'Spielen'
            }`}
            icon={MessageSquareWarning}
            tone={openResponses.players > 0 ? 'warning' : 'success'}
          />
        )}
      </div>

      <Tabs
        tabs={[
          {
            value: 'trainings',
            label: `Trainings (${mySessionCount})`,
            content: <SessionsTab onlyMine />,
          },
          {
            value: 'games',
            label: `Spiele (${countdown.total})`,
            content: <MyGamesList />,
          },
          { value: 'calendar', label: 'Kalender', content: <PlanningTab /> },
          {
            value: 'keys',
            label: 'Schlüssel',
            content: <MyKeysTab />,
          },
          {
            value: 'open-trainings',
            label: `Offene Trainings (${openTrainingCount})`,
            content: <OpenTrainingsList />,
          },
        ]}
      />

      <div className="mt-4">
        <QuickLinks links={quicklinks} canEdit={role === 'admin'} />
      </div>
    </div>
  );
}
