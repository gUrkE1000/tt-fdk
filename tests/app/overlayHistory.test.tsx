import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from '../../src/app/layout/AppShell';
import Providers from '../../src/app/providers';
import DetailLink from '../../src/app/detail/DetailLink';
import { Button, Dialog } from '../../src/components/ui';

// Die echte Einzelansicht lädt aus Supabase; hier geht es nur um den Verlauf.
vi.mock('../../src/features/matches/MatchDetail', () => ({
  default: function MatchDetail({ matchId }: { matchId: string }) {
    return (
      <div>
        <p>Inhalt von Spiel {matchId}</p>
        <ShareButton />
      </div>
    );
  },
}));

/** Wie der Knopf an der Spielkarte: öffnet „Aufstellung teilen". */
function ShareButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Aufstellung teilen</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Aufstellung teilen">
        <p>Text zum Kopieren</p>
      </Dialog>
    </>
  );
}

/** Bearbeiten, dann im selben Zug eine Rückfrage — zwei Dialoge nacheinander. */
function EditThenConfirm() {
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button onClick={() => setEdit(true)}>Bearbeiten</Button>
      <Dialog open={edit} onOpenChange={setEdit} title="Bearbeiten">
        <Button
          onClick={() => {
            setEdit(false);
            setConfirm(true);
          }}
        >
          Löschen
        </Button>
      </Dialog>
      <Dialog open={confirm} onOpenChange={setConfirm} title="Wirklich löschen?">
        <p>Sicher?</p>
      </Dialog>
    </>
  );
}

function MyGames() {
  return (
    <div>
      <h2>Meine Spiele</h2>
      <ShareButton />
      <EditThenConfirm />
      <DetailLink to="/match/m-1">Spiel öffnen</DetailLink>
    </div>
  );
}

function renderApp(initialEntries: string[]) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell role="member" clubName="Testverein" />,
        children: [
          { index: true, element: <h2>Übersicht</h2> },
          { path: 'my-games', element: <MyGames /> },
          { path: 'votes', element: <h2>Abstimmungen</h2> },
        ],
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

const where = (router: ReturnType<typeof renderApp>) =>
  router.state.location.pathname + router.state.location.search;

async function back(router: ReturnType<typeof renderApp>) {
  await act(() => router.navigate(-1));
}

describe('Zurückwischen schließt zuerst den Dialog', () => {
  it('„Aufstellung teilen" auf „Meine Spiele": zurück schließt den Dialog, die Seite bleibt', async () => {
    // Wie berichtet: von der Übersicht zu „Meine Spiele", dort den Dialog geöffnet.
    const router = renderApp(['/', '/my-games']);
    await userEvent.click(screen.getByRole('button', { name: 'Aufstellung teilen' }));
    expect(await screen.findByRole('dialog', { name: 'Aufstellung teilen' })).toBeInTheDocument();

    await back(router);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(where(router)).toBe('/my-games');
    expect(screen.getByRole('heading', { level: 2, name: 'Meine Spiele' })).toBeInTheDocument();

    // Erst der nächste Schritt verlässt die Seite.
    await back(router);
    expect(where(router)).toBe('/');
  });

  it('selbst geschlossen: kein toter Eintrag bleibt zurück', async () => {
    const router = renderApp(['/', '/my-games']);
    await userEvent.click(screen.getByRole('button', { name: 'Aufstellung teilen' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Schließen' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(where(router)).toBe('/my-games');

    await back(router);
    expect(where(router)).toBe('/');
  });

  it('ein Dialog löst den nächsten ab: ein Eintrag, nicht zwei', async () => {
    const router = renderApp(['/', '/my-games']);
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Löschen' }));
    expect(await screen.findByRole('dialog', { name: 'Wirklich löschen?' })).toBeInTheDocument();

    await back(router);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(where(router)).toBe('/my-games');

    await back(router);
    expect(where(router)).toBe('/');
  });

  it('im Blatt eines Spiels: zurück schließt den Dialog, das Blatt bleibt offen', async () => {
    const router = renderApp(['/', '/my-games']);
    await userEvent.click(screen.getByRole('link', { name: 'Spiel öffnen' }));
    await screen.findByText('Inhalt von Spiel m-1');

    const sheet = screen.getByRole('dialog', { name: 'Spiel' });
    await userEvent.click(
      Array.from(sheet.querySelectorAll('button')).find((b) => b.textContent === 'Aufstellung teilen')!,
    );
    expect(await screen.findByRole('dialog', { name: 'Aufstellung teilen' })).toBeInTheDocument();

    await back(router);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Aufstellung teilen' })).not.toBeInTheDocument(),
    );
    expect(where(router)).toBe('/my-games?match=m-1');
    expect(screen.getByText('Inhalt von Spiel m-1')).toBeInTheDocument();

    await back(router);
    expect(where(router)).toBe('/my-games');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await back(router);
    expect(where(router)).toBe('/');
  });

  it('das Menü am Telefon schließt beim Zurückwischen', async () => {
    const router = renderApp(['/', '/my-games']);
    await userEvent.click(screen.getAllByRole('button', { name: 'Menü öffnen' })[0]);
    expect(screen.getByRole('button', { name: 'Menü schließen' })).toBeInTheDocument();

    await back(router);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Menü schließen' })).not.toBeInTheDocument(),
    );
    expect(where(router)).toBe('/my-games');
  });

  it('ein Link im Menü ersetzt dessen Eintrag: zurück führt zur Seite von vorhin', async () => {
    const router = renderApp(['/', '/my-games']);
    await userEvent.click(screen.getAllByRole('button', { name: 'Menü öffnen' })[0]);
    const menu = screen.getByRole('button', { name: 'Menü schließen' }).parentElement!;
    await userEvent.click(
      Array.from(menu.querySelectorAll('a')).find((a) => a.getAttribute('href') === '/votes')!,
    );
    expect(where(router)).toBe('/votes');

    await back(router);
    expect(where(router)).toBe('/my-games');
    await back(router);
    expect(where(router)).toBe('/');
  });
});
