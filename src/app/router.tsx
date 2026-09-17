import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './layout/AppShell';
import Placeholder from './Placeholder';
import DesignPlayground from './DesignPlayground';
import LoginPage from '../features/auth/LoginPage';
import RegisterPage from '../features/auth/RegisterPage';
import { RequireAuth, RequireRole } from '../features/auth/guards';

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
    element: <Placeholder title="Rückmeldung" task="4.6" />,
  },

  // --------------------------------------------------- angemeldet
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Placeholder title="Übersicht" task="8.1" /> },
          { path: 'my-games', element: <Placeholder title="Meine Spiele" task="3.5" /> },
          { path: 'my-dates', element: <Placeholder title="Meine Termine" task="7.5" /> },
          { path: 'my-club', element: <Placeholder title="Mein Verein" task="2.6" /> },
          { path: 'calendar', element: <Placeholder title="Kalender" task="7.3" /> },
          { path: 'votes', element: <Placeholder title="Umfragen" task="7.2" /> },
          { path: 'profile', element: <Placeholder title="Mein Profil" task="2.1" /> },

          {
            element: <RequireRole roles={['admin', 'trainer', 'team_leader']} />,
            children: [
              { path: 'statistics', element: <Placeholder title="Statistiken" task="9.9" /> },
            ],
          },
          {
            element: <RequireRole roles={['admin', 'trainer']} />,
            children: [{ path: 'trainings', element: <Placeholder title="Trainings" task="6.4" /> }],
          },
          {
            element: <RequireRole roles={['admin', 'team_leader']} />,
            children: [
              { path: 'teams', element: <Placeholder title="Mannschaften" task="3.2" /> },
              {
                path: 'teams/players-management',
                element: <Placeholder title="Mannschaften bearbeiten" task="3.2" />,
              },
              { path: 'games', element: <Placeholder title="Spieltermine" task="3.4" /> },
            ],
          },
          {
            element: <RequireRole roles={['admin', 'organizer']} />,
            children: [{ path: 'dates', element: <Placeholder title="Vereinstermine" task="7.1" /> }],
          },
          {
            element: <RequireRole roles={['admin']} />,
            children: [
              { path: 'players', element: <Placeholder title="Mitglieder" task="2.2" /> },
              { path: 'club', element: <Placeholder title="Verein" task="2.5" /> },
              { path: 'venues', element: <Placeholder title="Orte & Schlüssel" task="2.5" /> },
            ],
          },

          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
