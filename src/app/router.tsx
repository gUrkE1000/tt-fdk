import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './layout/AppShell';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import ActionPage from '../features/auth/ActionPage';
import { RequireAuth, RequireRole } from '../features/auth/guards';

/**
 * Seiten hinter der Anmeldung werden erst beim Aufruf geladen.
 *
 * Vorher steckte alles in einem Paket von 1,9 MB: Kalender, Texteditor, Drag-and-drop
 * und sämtliche Verwaltungsseiten, auch für ein Mitglied, das nur zusagen will. Sofort
 * da bleiben Anmeldung, Registrierung und die Antwort-Seite aus E-Mails — die öffnet
 * man ohne Anmeldung und soll nicht auf den Rest warten. Die Wartezeit fängt das
 * Suspense in der AppShell ab; offline hilft der Service Worker, der alle Teile beim
 * Installieren vorab speichert.
 */
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'));
const MembersPage = lazy(() => import('../features/members/MembersPage'));
const ClubPage = lazy(() => import('../features/club/ClubPage'));
const MyClubPage = lazy(() => import('../features/club/MyClubPage'));
const VenuesPage = lazy(() => import('../features/venues/VenuesPage'));
const TeamsPage = lazy(() => import('../features/teams/TeamsPage'));
const PlayersManagementPage = lazy(() => import('../features/teams/PlayersManagementPage'));
const GamesPage = lazy(() => import('../features/matches/GamesPage'));
const MyGamesPage = lazy(() => import('../features/matches/MyGamesPage'));
const TrainingsPage = lazy(() => import('../features/trainings/TrainingsPage'));
const CancellationsPage = lazy(() => import('../features/trainings/CancellationsPage'));
const EventsPage = lazy(() => import('../features/events/EventsPage'));
const PollsPage = lazy(() => import('../features/polls/PollsPage'));
const CalendarPage = lazy(() => import('../features/calendar/CalendarPage'));
const MyDatesPage = lazy(() => import('../features/calendar/MyDatesPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const MobileAppPage = lazy(() => import('../features/notifications/MobileAppPage'));
const NotificationsPage = lazy(() => import('../features/notifications/NotificationsPage'));
const StatisticsPage = lazy(() => import('../features/statistics/StatisticsPage'));

/**
 * Sichtprüfung des Design-Systems. Nur im Entwicklungsmodus, damit sie nicht im
 * ausgelieferten Bundle landet.
 */
//
// Dynamisch importiert: Ein statischer Import hinge davon ab, dass Rollup die Seite als
// frei von Nebenwirkungen erkennt. So entsteht sie im Produktionsbuild gar nicht erst.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/_design',
        lazy: async () => ({ Component: (await import('./DesignPlayground')).default }),
      },
    ]
  : [];

/**
 * Routen nach Zielbild 2.
 *
 * Die Rollenprüfung hier ist Bequemlichkeit, keine Sicherheit — die Grenze zieht RLS in
 * der Datenbank. Sie verhindert nur, dass jemand auf eine Seite gerät, auf der er nichts
 * sehen würde.
 */
export const router = createBrowserRouter([
  ...devRoutes,

  // --------------------------------------------------- ohne Anmeldung
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
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
          { path: 'mobile-app', element: <MobileAppPage /> },
          { path: 'notifications', element: <NotificationsPage /> },

          // Ohne Rollenprüfung: Ob jemand eine Trainingsstatistik sieht, hängt am
          // Training (`statistics_visibility`), nicht an seiner Rolle. Ein Mitglied
          // einer freigegebenen Gruppe darf hierher — wer nichts sehen darf, bekommt
          // eine leere Seite, und zwar von der Datenbank.
          { path: 'statistics', element: <StatisticsPage /> },
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
