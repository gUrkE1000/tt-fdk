import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from '../../src/app/layout/AppShell';
import Placeholder from '../../src/app/Placeholder';
import Providers from '../../src/app/providers';
import type { Role } from '../../src/app/nav';

/**
 * Die Routen selbst stehen in src/app/router.tsx mit createBrowserRouter. Für Tests bauen wir
 * denselben Baum mit createMemoryRouter nach, damit wir Einstiegsrouten und Rolle steuern können.
 */
function renderAt(path: string, role: Role = 'admin') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell role={role} clubName="Testverein" />,
        children: [
          { index: true, element: <Placeholder title="Übersicht" task="8.1" /> },
          { path: 'teams', element: <Placeholder title="Mannschaften" task="3.2" /> },
          { path: 'players', element: <Placeholder title="Mitglieder" task="2.2" /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  return render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
}

describe('AppShell und Routing', () => {
  it('rendert die Startseite mit Vereinsname und Seitentitel', () => {
    renderAt('/');
    expect(screen.getAllByText('Testverein').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Übersicht');
  });

  it('rendert eine Unterseite', () => {
    renderAt('/teams');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mannschaften');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Mannschaften');
  });

  it('zeigt dem Admin den Abschnitt Verwalten in der Seitenleiste', () => {
    renderAt('/', 'admin');
    expect(screen.getAllByText('Verwalten').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mitglieder').length).toBeGreaterThan(0);
  });

  it('zeigt dem Mitglied den Abschnitt Verwalten nicht', () => {
    renderAt('/', 'member');
    expect(screen.queryByText('Verwalten')).toBeNull();
    expect(screen.queryByText('Mitglieder')).toBeNull();
  });

  it('nennt im Platzhalter die Aufgabe aus dem Umsetzungsplan', () => {
    renderAt('/teams');
    expect(screen.getByText('3.2')).toBeInTheDocument();
  });

  it('bietet auf kleinen Bildschirmen einen Menü-Button und die Bottom-Bar', () => {
    renderAt('/');
    expect(screen.getByLabelText('Menü öffnen')).toBeInTheDocument();
    expect(screen.getByLabelText('Schnellzugriff')).toBeInTheDocument();
  });
});
