import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import GameTable from '../../src/features/matches/GameTable';
import RouteError from '../../src/app/RouteError';
import type { MatchRow } from '../../src/features/matches/api';

// Fehlerbild vom 30.09.2026: Nach dem Ausrollen stürzte die App mit „Cannot read
// properties of undefined (reading 'length')" ab — ein Spiel ohne `lineupIds`
// (älterer Stand im Zwischenspeicher) brachte die Aufstellungszelle zu Fall.
describe('GameTable', () => {
  it('zeigt ein Spiel ohne mitgelieferte Aufstellung, statt abzustürzen', () => {
    const match = {
      id: 'm-1',
      team_id: 't-1',
      dtstart: '2026-10-10T16:30:00Z',
      opponent: 'TTC Kirchheim',
      is_home: true,
      active: true,
      required_players: 4,
      confirmedCount: 2,
    } as unknown as MatchRow;

    render(
      <RouterProvider
        router={createMemoryRouter([
          {
            path: '/',
            element: (
              <GameTable
                matches={[match]}
                teams={[]}
                venues={[]}
                nameOf={() => ''}
                selected={[]}
                onSelectedChange={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onManagePlayers={vi.fn()}
                onShareLineup={vi.fn()}
                onReschedule={vi.fn()}
              />
            ),
          },
        ])}
      />,
    );
    expect(screen.getAllByText('2 / 4').length).toBeGreaterThan(0);
  });
});

describe('RouteError', () => {
  it('zeigt statt der rohen Fehlerseite eine Meldung mit „Neu laden"', async () => {
    const Boom = () => {
      throw new TypeError("Cannot read properties of undefined (reading 'length')");
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteError /> }])}
      />,
    );
    expect(await screen.findByText('Da ist etwas schiefgelaufen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Neu laden/ })).toBeInTheDocument();
    spy.mockRestore();
  });
});
