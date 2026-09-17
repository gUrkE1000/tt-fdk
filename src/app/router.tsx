import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './layout/AppShell';
import Placeholder from './Placeholder';
import DesignPlayground from './DesignPlayground';

/**
 * Sichtprüfung des Design-Systems. Nur im Entwicklungsmodus, damit sie nicht im
 * ausgelieferten Bundle landet.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '/_design', element: <DesignPlayground /> }]
  : [];

/**
 * Routen nach Zielbild 2. Jede Seite bekommt zunächst einen Platzhalter mit der
 * Aufgabennummer, die sie füllt; die Struktur steht damit von Anfang an vollständig.
 */
export const router = createBrowserRouter([
  ...devRoutes,

  // --------------------------------------------------- ohne Anmeldung
  {
    path: '/login',
    element: <Placeholder title="Anmeldung" task="1.4" />,
  },
  {
    path: '/register/:code',
    element: <Placeholder title="Registrierung" task="1.4" />,
  },
  {
    // Antwort-Link aus einer Benachrichtigung: speichert ohne Anmeldung.
    path: '/r/:token',
    element: <Placeholder title="Rückmeldung" task="4.6" />,
  },

  // --------------------------------------------------- angemeldet
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Placeholder title="Übersicht" task="8.1" /> },
      { path: 'my-games', element: <Placeholder title="Meine Spiele" task="3.5" /> },
      { path: 'my-dates', element: <Placeholder title="Meine Termine" task="7.5" /> },

      { path: 'my-club', element: <Placeholder title="Mein Verein" task="2.6" /> },
      { path: 'statistics', element: <Placeholder title="Statistiken" task="9.9" /> },

      { path: 'trainings', element: <Placeholder title="Trainings" task="6.4" /> },
      { path: 'teams', element: <Placeholder title="Mannschaften" task="3.2" /> },
      {
        path: 'teams/players-management',
        element: <Placeholder title="Mannschaften bearbeiten" task="3.2" />,
      },
      { path: 'games', element: <Placeholder title="Spieltermine" task="3.4" /> },
      { path: 'dates', element: <Placeholder title="Vereinstermine" task="7.1" /> },
      { path: 'calendar', element: <Placeholder title="Kalender" task="7.3" /> },
      { path: 'votes', element: <Placeholder title="Umfragen" task="7.2" /> },

      { path: 'players', element: <Placeholder title="Mitglieder" task="2.2" /> },
      { path: 'club', element: <Placeholder title="Verein" task="2.5" /> },
      { path: 'venues', element: <Placeholder title="Orte & Schlüssel" task="2.5" /> },

      { path: 'profile', element: <Placeholder title="Mein Profil" task="2.1" /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
