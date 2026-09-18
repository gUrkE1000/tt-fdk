import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './layout/AppShell';
import Placeholder from './Placeholder';
import DesignPlayground from './DesignPlayground';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import ActionPage from '../features/auth/ActionPage';
import { RequireAuth, RequireRole } from '../features/auth/guards';
import ProfilePage from '../features/profile/ProfilePage';
import MembersPage from '../features/members/MembersPage';
import ClubPage from '../features/club/ClubPage';
import MyClubPage from '../features/club/MyClubPage';
import VenuesPage from '../features/venues/VenuesPage';
import TeamsPage from '../features/teams/TeamsPage';
import PlayersManagementPage from '../features/teams/PlayersManagementPage';
import GamesPage from '../features/matches/GamesPage';
import MyGamesPage from '../features/matches/MyGamesPage';
import TrainingsPage from '../features/trainings/TrainingsPage';
import CancellationsPage from '../features/trainings/CancellationsPage';
import EventsPage from '../features/events/EventsPage';
import PollsPage from '../features/polls/PollsPage';
import CalendarPage from '../features/calendar/CalendarPage';
import MyDatesPage from '../features/calendar/MyDatesPage';
import DashboardPage from '../features/dashboard/DashboardPage';

/**
 * Sichtprüfung des Design-Systems. Nur im Entwicklungsmodus, damit sie nicht im
 * ausgelieferten Bundle landet.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '/_design', element: <DesignPlayground /> }]
  : [];

/**
 * Routen nach Zielbild 2. Jede noch nicht gebaute Seite zeigt einen Platzhalter mit der
 * Aufgabennummer, die sie füllt; die Struktur steht damit von Anfang an vollständig.
 *
 * Die Rollenprüfung hier ist Bequemlichkeit, keine Sicherheit — die Grenze zieht RLS in
 * der Datenbank. Sie verhindert nur, dass jemand auf eine Seite gerät, auf der er nichts
 * sehen würde.
 */
export const router = createBrowserRouter([
  ...devRoutes,

  // --------------------------------------------------- ohne Anmeldung
  { path: '/login', element: <LoginPage /> },
  { path: '/register/:code', element: <RegisterPage /> },
  {
    // Antwort-Link aus einer Benachrichtigung: speichert ohne Anmeldung.
    path: '/r/:token',
    element: <ActionPage />,
  },

  // --------------------------------------------------- angemeldet
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'my-games', element: <MyGamesPage /> },
          { path: 'my-dates', element: <MyDatesPage /> },
          { path: 'my-club', element: <MyClubPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'votes', element: <PollsPage /> },
          { path: 'profile', element: <ProfilePage /> },

          {
            element: <RequireRole roles={['admin', 'trainer', 'team_leader']} />,
            children: [
              { path: 'statistics', element: <Placeholder title="Statistiken" task="9.9" /> },
            ],
          },
          {
            element: <RequireRole roles={['admin', 'trainer']} />,
            children: [
              { path: 'trainings', element: <TrainingsPage /> },
              { path: 'trainings/cancellations', element: <CancellationsPage /> },
              { path: 'trainings/cancellations/:trainingId', element: <CancellationsPage /> },
            ],
          },
          {
            element: <RequireRole roles={['admin', 'team_leader']} />,
            children: [
              { path: 'teams', element: <TeamsPage /> },
              { path: 'teams/players-management', element: <PlayersManagementPage /> },
              { path: 'games', element: <GamesPage /> },
            ],
          },
          {
            element: <RequireRole roles={['admin', 'organizer']} />,
            children: [{ path: 'dates', element: <EventsPage /> }],
          },
          {
            element: <RequireRole roles={['admin']} />,
            children: [
              { path: 'players', element: <MembersPage /> },
              { path: 'club', element: <ClubPage /> },
              { path: 'venues', element: <VenuesPage /> },
            ],
          },

          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
