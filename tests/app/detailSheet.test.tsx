import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from '../../src/app/layout/AppShell';
import Providers from '../../src/app/providers';
import DetailEntry from '../../src/app/detail/DetailEntry';
import DetailLink from '../../src/app/detail/DetailLink';
import { usePaged } from '../../src/components/ui';
import {
  detailFromPath,
  parentOf,
  readDetail,
  withDetail,
  type DetailState,
} from '../../src/lib/detailSheet';

// Die echten Einzelansichten laden ihre Daten aus Supabase; hier geht es nur ums Blatt.
vi.mock('../../src/features/matches/MatchDetail', () => ({
  default: ({ matchId }: { matchId: string }) => <p>Inhalt von Spiel {matchId}</p>,
}));
vi.mock('../../src/features/trainings/TrainingSessionDetail', () => ({
  default: ({ sessionId }: { sessionId: string }) => <p>Inhalt von Training {sessionId}</p>,
}));
vi.mock('../../src/features/events/EventDetail', () => ({
  default: ({ eventId }: { eventId: string }) => <p>Inhalt von Termin {eventId}</p>,
}));

// ------------------------------------------------------------------ Adressen

describe('Adressen der Einzelansicht', () => {
  it('liest die Einzelansicht aus den Suchparametern', () => {
    expect(readDetail('?tab=news&match=m-1')).toEqual({ kind: 'match', id: 'm-1' });
    expect(readDetail('?training=s-1')).toEqual({ kind: 'training', id: 's-1' });
    expect(readDetail('?tab=news')).toBeNull();
  });

  it('setzt und entfernt sie, ohne andere Parameter anzufassen', () => {
    expect(withDetail('?tab=news', { kind: 'match', id: 'm-1' })).toBe('?tab=news&match=m-1');
    expect(withDetail('?tab=news&match=m-1', null)).toBe('?tab=news');
    expect(withDetail('?match=m-1', null)).toBe('');
    // Höchstens ein Blatt: Ein neues ersetzt das alte.
    expect(withDetail('?match=m-1', { kind: 'event', id: 'e-1' })).toBe('?event=e-1');
  });

  it('erkennt die alten Pfade aus Benachrichtigungen', () => {
    expect(detailFromPath('/match/m-1')).toEqual({ kind: 'match', id: 'm-1' });
    expect(detailFromPath('/training/s-1?x=1')).toEqual({ kind: 'training', id: 's-1' });
    expect(detailFromPath('/event/e-1/')).toEqual({ kind: 'event', id: 'e-1' });
    expect(detailFromPath('/my-games')).toBeNull();
    expect(detailFromPath('/match/m-1/extra')).toBeNull();
    expect(detailFromPath('/r/abc')).toBeNull();
  });

  it('kennt zu jeder Art die Liste darunter', () => {
    expect(parentOf('match')).toEqual({ pathname: '/my-games', search: '' });
    expect(parentOf('training')).toEqual({ pathname: '/my-club', search: '?tab=trainings' });
    expect(parentOf('event')).toEqual({ pathname: '/my-club', search: '?tab=events' });
  });
});

// ------------------------------------------------------------------ Liste mit „Weitere"

describe('usePaged mit reveal', () => {
  const items = Array.from({ length: 100 }, (_, index) => index);

  it('zeigt so viele Seiten, bis der gesuchte Eintrag dabei ist', () => {
    const { result } = renderHook(() => usePaged(items, undefined, 30, (item) => item === 65));
    expect(result.current.shown).toHaveLength(90);
    expect(result.current.rest).toBe(10);

    act(() => result.current.more());
    expect(result.current.shown).toHaveLength(100);
  });

  it('bleibt bei einer Seite, wenn der Eintrag vorne steht oder fehlt', () => {
    expect(renderHook(() => usePaged(items, undefined, 30, (item) => item === 3)).result.current.shown)
      .toHaveLength(30);
    expect(renderHook(() => usePaged(items, undefined, 30, () => false)).result.current.shown)
      .toHaveLength(30);
  });
});

// ------------------------------------------------------------------ Blatt und Verlauf

function Overview() {
  return (
    <div>
      <h2>Übersicht</h2>
      <DetailLink to="/match/m-1">Nächstes Spiel</DetailLink>
      <DetailLink to="/votes">Zur Abstimmung</DetailLink>
    </div>
  );
}

function MyGames() {
  return (
    <div>
      <h2>Meine Spiele</h2>
      {['m-6', 'm-7', 'm-8'].map((id) => (
        <div key={id} data-detail={`match:${id}`}>
          Karte {id}
        </div>
      ))}
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
          { index: true, element: <Overview /> },
          { path: 'my-games', element: <MyGames /> },
          { path: 'votes', element: <h2>Abstimmungen</h2> },
          { path: 'match/:id', element: <DetailEntry kind="match" /> },
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

function where(router: ReturnType<typeof renderApp>) {
  return router.state.location.pathname + router.state.location.search;
}

describe('Einzelansicht als Blatt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('öffnet das Spiel über der Übersicht, die Übersicht bleibt darunter', async () => {
    const router = renderApp(['/']);
    await userEvent.click(screen.getByRole('link', { name: 'Nächstes Spiel' }));

    expect(where(router)).toBe('/?match=m-1');
    expect(await screen.findByRole('dialog', { name: 'Spiel' })).toBeInTheDocument();
    expect(await screen.findByText('Inhalt von Spiel m-1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Übersicht', hidden: true })).toBeInTheDocument();
  });

  it('Zurückwischen schließt nur das Blatt', async () => {
    const router = renderApp(['/votes', '/']);
    await userEvent.click(screen.getByRole('link', { name: 'Nächstes Spiel' }));
    await screen.findByRole('dialog', { name: 'Spiel' });

    await act(() => router.navigate(-1));

    expect(where(router)).toBe('/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Übersicht' })).toBeInTheDocument();
  });

  it('der Schließen-Knopf geht einen Schritt zurück, statt einen neuen anzulegen', async () => {
    const router = renderApp(['/votes', '/']);
    await userEvent.click(screen.getByRole('link', { name: 'Nächstes Spiel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Schließen' }));

    await waitFor(() => expect(where(router)).toBe('/'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Noch ein Schritt zurück führt dorthin, wo man vor der Übersicht war.
    await act(() => router.navigate(-1));
    expect(where(router)).toBe('/votes');
  });

  it('ohne eigenen Verlaufseintrag nimmt Schließen nur den Parameter weg', async () => {
    const router = renderApp(['/?match=m-1']);
    await userEvent.click(await screen.findByRole('button', { name: 'Schließen' }));

    await waitFor(() => expect(where(router)).toBe('/'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('andere Adressen bleiben gewöhnliche Links', () => {
    renderApp(['/']);
    expect(screen.getByRole('link', { name: 'Zur Abstimmung' })).toHaveAttribute('href', '/votes');
  });
});

describe('Einstieg über eine Benachrichtigung', () => {
  it('landet auf „Meine Spiele" mit offenem Blatt, zurück steht die Liste beim Spiel', async () => {
    const scrolled: string[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      scrolled.push((this as HTMLElement).dataset.detail ?? '');
    });

    // Vorher war die App auf der Übersicht, dann kam der Link aus der Push-Nachricht.
    const router = renderApp(['/', '/match/m-7']);

    await waitFor(() => expect(where(router)).toBe('/my-games?match=m-7'));
    expect(await screen.findByText('Inhalt von Spiel m-7')).toBeInTheDocument();
    // Die Liste darunter steht schon beim Spiel.
    await waitFor(() => expect(scrolled).toContain('match:m-7'));

    await act(() => router.navigate(-1));

    expect(where(router)).toBe('/my-games');
    expect((router.state.location.state as DetailState).focus).toEqual({ kind: 'match', id: 'm-7' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Meine Spiele' })).toBeInTheDocument();

    const card = screen.getByText('Karte m-7');
    await waitFor(() => expect(card).toHaveClass('detail-focus'));

    // Und erst der nächste Schritt zurück verlässt die Liste.
    await act(() => router.navigate(-1));
    expect(where(router)).toBe('/');
  });
});
