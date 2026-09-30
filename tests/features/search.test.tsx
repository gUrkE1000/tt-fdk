import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface RpcRow {
  kind: string;
  id: string;
  title: string;
  subtitle: string | null;
  starts_at: string | null;
  target: string | null;
  score: number;
  mine: boolean;
  my_status: string | null;
  can_manage: boolean;
  meta: Record<string, unknown>;
}

const state = {
  role: 'member' as string,
  rows: [] as RpcRow[],
  calls: [] as { fn: string; args: Record<string, unknown> }[],
};

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      state.calls.push({ fn, args });
      if (fn === 'rpc_search') return Promise.resolve({ data: state.rows, error: null });
      return Promise.resolve({ data: null, error: null });
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    session: null,
    profile: { id: 'me', full_name: 'Spieler 01' },
    role: state.role,
    loading: false,
    previousLoginAt: null,
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SearchLauncher from '../../src/features/search/SearchDialog';
import SearchPage from '../../src/features/search/SearchPage';
import { toHit, searchOffline } from '../../src/features/search/api';
import { loadRecent, rememberSearch } from '../../src/features/search/recent';
import { clearPersistedCaches, persistable } from '../../src/lib/queryPersist';
import { queryKeys } from '../../src/lib/queryKeys';
import { ToastProvider } from '../../src/components/ui';

const MATCH: RpcRow = {
  kind: 'match',
  id: 'm-1',
  title: '1. Herren – TTC Nachbarstadt',
  subtitle: 'Heim · Bezirksliga · Sporthalle',
  starts_at: '2099-10-06T17:00:00Z',
  target: '/match/m-1',
  score: 1,
  mine: true,
  my_status: 'none',
  can_manage: false,
  meta: { is_home: true, active: true, color: '#1D4ED8' },
};

const MEMBER: RpcRow = {
  kind: 'member',
  id: 'p-2',
  title: 'Erika Müller',
  subtitle: '2. Herren',
  starts_at: null,
  target: '/my-club?tab=members&q=Erika Müller',
  score: 0.9,
  mine: false,
  my_status: null,
  can_manage: true,
  meta: { role: 'member', mobile_phone: '0171 555' },
};

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderWith(ui: React.ReactNode, path = '/', client?: QueryClient) {
  const queryClient =
    client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  {ui}
                  <Where />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function searchCalls() {
  return state.calls.filter((call) => call.fn === 'rpc_search');
}

beforeEach(() => {
  state.role = 'member';
  state.rows = [];
  state.calls = [];
  window.localStorage.clear();
});

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('Sofortsuche', () => {
  it('öffnet mit Strg+K und findet ein Spiel', async () => {
    state.rows = [MATCH];
    renderWith(<SearchLauncher />);

    await userEvent.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('combobox', { name: 'Suchbegriff' });
    await userEvent.type(input, 'nachbar');

    const listbox = await screen.findByRole('listbox');
    expect(await within(listbox).findByText('Spiele')).toBeInTheDocument();
    // Treffer mit hervorgehobenem Wortanfang
    expect(within(listbox).getByText('Nachbar', { selector: 'mark' })).toBeInTheDocument();
    expect(within(listbox).getByText('Antwort offen')).toBeInTheDocument();
    expect(searchCalls().at(-1)?.args).toMatchObject({ p_query: 'nachbar', p_limit: 5 });
  });

  it('öffnet auch mit „/" und führt mit Enter zum Treffer', async () => {
    state.rows = [MATCH];
    renderWith(<SearchLauncher />);

    await userEvent.keyboard('/');
    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'nachbar');
    await screen.findByText('Nachbar', { selector: 'mark' });
    await userEvent.keyboard('{Enter}');

    // Das Spiel öffnet als Blatt über der Seite, auf der gesucht wurde.
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/?match=m-1'));
    expect(screen.queryByRole('combobox')).toBeNull();
    // Die Suche steht jetzt unter „zuletzt gesucht".
    expect(loadRecent('me')).toEqual(['nachbar']);
  });

  it('blättert mit den Pfeiltasten und bietet am Ende „Alle Treffer" an', async () => {
    state.rows = [MATCH, MEMBER];
    renderWith(<SearchLauncher />);

    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'her');
    await screen.findByRole('option', { name: /Erika/ });

    // Zwei Treffer der Datenbank, dazu „Daten herunterladen" (Seite) und „Alle Treffer".
    const options = screen.getAllByRole('option');
    const last = options.length - 1;
    expect(options[last]).toHaveTextContent('Alle Treffer für „her“ anzeigen');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getAllByRole('option')[last]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[last].id);
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/search?q=her'));
  });

  it('findet Seiten über Alltagswörter, ohne dass der Server sie kennen muss', async () => {
    renderWith(<SearchLauncher />);
    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await userEvent.type(await screen.findByRole('combobox'), 'urlaub');

    expect(await screen.findByText('Abwesenheit eintragen')).toBeInTheDocument();
    expect(screen.getByText('Seiten & Aktionen')).toBeInTheDocument();
  });

  it('gibt eine Zeitangabe als Zeitraum an die Datenbank', async () => {
    state.rows = [MATCH];
    renderWith(<SearchLauncher />);
    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await userEvent.type(await screen.findByRole('combobox'), 'Samstag Borussia');

    expect(await screen.findByText(/Zeitraum erkannt/)).toBeInTheDocument();
    const args = searchCalls().at(-1)!.args;
    expect(args.p_query).toBe('Borussia');
    expect(typeof args.p_from).toBe('string');
    expect(typeof args.p_to).toBe('string');
  });

  it('sagt, wenn nichts gefunden wurde — ohne Hinweis auf Verborgenes', async () => {
    renderWith(<SearchLauncher />);
    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await userEvent.type(await screen.findByRole('combobox'), 'xyzzy');

    expect(await screen.findByText('Nichts gefunden für „xyzzy“.')).toBeInTheDocument();
    expect(screen.queryByText(/Rechte|berechtigt/)).toBeNull();
  });

  it('zeigt ohne Eingabe die letzten Suchen und setzt sie per Klick ein', async () => {
    rememberSearch('me', 'Borussia');
    renderWith(<SearchLauncher />);
    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));

    expect(await screen.findByText('Zuletzt gesucht')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /Borussia/ }));
    expect(screen.getByRole('combobox')).toHaveValue('Borussia');
  });

  it('sucht ohne Netz im gespeicherten Stand', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.members.directory(), [
      { id: 'p-9', full_name: 'Erika Müller' },
    ]);
    renderWith(<SearchLauncher />, '/', client);

    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await userEvent.type(await screen.findByRole('combobox'), 'mueller');

    expect(await screen.findByText(/Offline — Suche im gespeicherten Stand/)).toBeInTheDocument();
    expect(screen.getByText('Müller', { selector: 'mark' })).toBeInTheDocument();
    expect(searchCalls()).toHaveLength(0);
  });
});

describe('Ergebnisseite', () => {
  it('zeigt Gruppen, Filter und die Zeile mit Kontakt', async () => {
    state.rows = [MEMBER];
    renderWith(<SearchPage />, '/search?q=mueller');

    expect(await screen.findByRole('heading', { name: 'Mitglieder' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /0171 555/ })).toHaveAttribute('href', 'tel:0171555');
    // Kein Link im Link: Treffer und Telefon sind Geschwister.
    expect(document.querySelector('a a')).toBeNull();
    expect(screen.getByRole('button', { name: 'Personen' })).toBeInTheDocument();
  });

  it('filtert nach Art über die Adresse', async () => {
    state.rows = [MEMBER];
    renderWith(<SearchPage />, '/search?q=mueller');
    await screen.findByRole('heading', { name: 'Mitglieder' });

    await userEvent.click(screen.getByRole('button', { name: 'Personen' }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/search?q=mueller&kind=member'),
    );
    await waitFor(() => expect(searchCalls().at(-1)?.args.p_kinds).toEqual(['member']));
    expect(searchCalls().at(-1)?.args.p_limit).toBe(50);
  });

  it('bietet Gästen keine Filter für Spiele und Mannschaften an', async () => {
    state.role = 'guest';
    renderWith(<SearchPage />, '/search?q=x');
    expect(await screen.findByRole('button', { name: 'Personen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spiele' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mannschaften' })).toBeNull();
  });

  it('zeigt „Bearbeiten" nur, wenn die Datenbank es erlaubt', async () => {
    state.rows = [MEMBER, { ...MEMBER, id: 'p-3', title: 'Hans Meier', can_manage: false }];
    renderWith(<SearchPage />, '/search?q=er');
    await screen.findByRole('link', { name: /Hans Meier/ });

    const edit = screen.getAllByRole('link', { name: 'Bearbeiten' });
    expect(edit).toHaveLength(1);
    expect(edit[0]).toHaveAttribute('href', '/players?q=Erika%20M%C3%BCller');
  });

  it('nimmt eine Zusage direkt in der Liste entgegen', async () => {
    state.rows = [MATCH];
    renderWith(<SearchPage />, '/search?q=nachbar');
    await userEvent.click(await screen.findByRole('button', { name: 'Zusage' }));

    await waitFor(() =>
      expect(state.calls.find((call) => call.fn === 'rpc_set_match_response')?.args).toEqual({
        p_match_id: 'm-1',
        p_response: 'yes',
        p_comment: '',
      }),
    );
  });

  it('öffnet ein Spiel als Blatt über den Treffern, die Suche bleibt in der Adresse', async () => {
    state.rows = [MATCH];
    renderWith(<SearchPage />, '/search?q=nachbar');
    const hit = (await screen.findByText('Nachbar', { selector: 'mark' })).closest('a');
    expect(hit).toHaveAttribute('href', '/search?q=nachbar&match=m-1');
  });

  it('merkt sich die Suche erst, wenn ein Treffer geöffnet wird', async () => {
    state.rows = [MEMBER];
    renderWith(<SearchPage />, '/search?q=mueller');
    const link = await screen.findByRole('link', { name: /Erika/ });
    expect(loadRecent('me')).toEqual([]);
    await userEvent.click(link);
    expect(loadRecent('me')).toEqual(['mueller']);
  });

  it('bittet bei einem Zeichen um mehr, statt „nichts gefunden" zu melden', () => {
    renderWith(<SearchPage />, '/search?q=a');
    expect(screen.getByText('Bitte etwas mehr eingeben')).toBeInTheDocument();
    expect(searchCalls()).toHaveLength(0);
  });

  it('erklärt ohne Eingabe, wonach man suchen kann', () => {
    renderWith(<SearchPage />, '/search');
    expect(screen.getByText('Wonach suchst du?')).toBeInTheDocument();
    expect(searchCalls()).toHaveLength(0);
  });
});

describe('Treffer aus der Datenbank', () => {
  it('führt Orte zur Route statt auf eine Seite', () => {
    const hit = toHit(
      {
        ...MEMBER,
        kind: 'venue',
        target: null,
        subtitle: 'Turnstraße 5, 12345 Musterstadt',
        meta: { address: 'Turnstraße 5, 12345 Musterstadt' },
      },
      'http://localhost',
    );
    expect(hit.external).toBe(true);
    expect(hit.target).toContain('google.com/maps');
  });

  it('öffnet aus einer Mitteilung nie eine fremde Seite', () => {
    const hit = toHit(
      { ...MEMBER, kind: 'notification', target: 'https://phishing.example/login' },
      'http://localhost',
    );
    expect(hit.target).toBe('/notifications');
  });
});

describe('Offline-Suche', () => {
  it('nutzt nur, was schon auf dem Gerät liegt, und berücksichtigt den Zeitraum', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.calendar.items(), [
      { kind: 'match', id: 'm-1', title: '1. Herren – Borussia', starts_at: '2026-10-03T16:00:00Z' },
      { kind: 'match', id: 'm-2', title: '2. Herren – Borussia', starts_at: '2026-10-10T16:00:00Z' },
    ]);
    const now = new Date('2026-09-29T18:00:00Z');
    const result = searchOffline(client, { query: 'Samstag Borussia' }, 'member', now);
    expect(result.offline).toBe(true);
    expect(result.hits.map((hit) => hit.id)).toEqual(['m-1']);
    expect(result.hits[0].target).toBe('/match/m-1');
  });
});

describe('Datenschutz', () => {
  it('speichert Suchen nie im Offline-Stand', () => {
    expect(
      persistable({
        queryKey: queryKeys.search('mueller', [], 'all', 5),
        state: { status: 'success' },
      } as never),
    ).toBe(false);
  });

  it('löscht „zuletzt gesucht" beim Abmelden', () => {
    rememberSearch('me', 'Borussia');
    expect(loadRecent('me')).toEqual(['Borussia']);
    clearPersistedCaches();
    expect(loadRecent('me')).toEqual([]);
  });
});

describe('Sprung aus der Suche in die Mitgliederliste', () => {
  it('übernimmt einen neuen Namen, auch wenn die Seite schon offen ist', async () => {
    const { default: MyClubPage } = await import('../../src/features/club/MyClubPage');
    function Jump() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate('/my-club?tab=members&q=Hans')}>
          springen
        </button>
      );
    }
    renderWith(
      <>
        <Jump />
        <MyClubPage />
      </>,
      '/my-club?tab=members&q=Erika',
    );
    expect(await screen.findByRole('searchbox', { name: 'Suchen' })).toHaveValue('Erika');
    await userEvent.click(screen.getByRole('button', { name: 'springen' }));
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Suchen' })).toHaveValue('Hans'),
    );
  });
});
