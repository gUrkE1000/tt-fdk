import { lazy, Suspense, useMemo } from 'react';
import { Dumbbell, Inbox, MessageSquareWarning } from 'lucide-react';
import { LoadingState, PageHeader, StatTile, Tabs } from '../../components/ui';
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
import MyKeysTab from '../keys/MyKeysTab';
import SubstituteBanner from '../substitutes/SubstituteBanner';
import CountdownTile, { countdownLabel } from './CountdownTile';
import OpenItemsList from './OpenItemsList';
import { useMyOpenItems } from './openItems';
import QuickLinks from './QuickLinks';
import {
  calendarDaysUntil,
  countOpenResponses,
  matchCountdown,
  parseQuicklinks,
} from './summary';
import { formatDateTime } from '../../lib/dates';

// Der Kalender bringt FullCalendar mit, das größte Paket der Übersicht. Er lädt erst,
// wenn jemand den Reiter öffnet.
const PlanningTab = lazy(() => import('../calendar/PlanningTab'));

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

  // Das nächste eigene Training, das nicht ausfällt — die zweite Frage nach „wann
  // spiele ich": wann bin ich das nächste Mal in der Halle?
  const nextTraining = useMemo(() => {
    const mine = myTrainingIds(trainingList, profileId);
    const now = Date.now();
    const session = (sessions.data ?? [])
      .filter((entry) => mine.has(entry.training_id) && !entry.cancelled)
      .filter((entry) => new Date(entry.starts_at).getTime() >= now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    if (!session) return null;
    return {
      session,
      name: trainingList.find((entry) => entry.id === session.training_id)?.name ?? 'Training',
    };
  }, [sessions.data, trainingList, profileId]);

  const openItems = useMyOpenItems(profileId);
  const openCount = openItems.data?.length ?? 0;

  const quicklinks = parseQuicklinks(settings.data?.quicklinks_json);

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
        />

        {nextTraining && (
          <StatTile
            label="Nächstes Training"
            value={countdownLabel(calendarDaysUntil(nextTraining.session.starts_at, new Date()))}
            hint={`${nextTraining.name} · ${formatDateTime(nextTraining.session.starts_at)}`}
            icon={Dumbbell}
          />
        )}

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
            value: 'open',
            label: `Offen (${openCount})`,
            content: <OpenItemsList limit={10} />,
          },
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
          {
            value: 'calendar',
            label: 'Kalender',
            content: (
              <Suspense fallback={<LoadingState rows={1} />}>
                <PlanningTab />
              </Suspense>
            ),
          },
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
