import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Row {
  [key: string]: unknown;
}

const state = {
  tables: {} as Record<string, Row[]>,
  inserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown }[],
  upserts: [] as { table: string; values: unknown }[],
};

function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    eq: () => chain,
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 'neu-1' }, error: null }) }),
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
    },
    update: (values: unknown) => {
      state.updates.push({ table, values });
      return { eq: () => Promise.resolve({ error: null }) };
    },
    upsert: (values: unknown) => {
      state.upserts.push({ table, values });
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: state.tables[table] ?? [], error: null }),
  };
  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'https://verein.example.org',
}));

import ClubPage from '../../src/features/club/ClubPage';
import MyClubPage from '../../src/features/club/MyClubPage';
import VenuesPage from '../../src/features/venues/VenuesPage';
import { ToastProvider } from '../../src/components/ui';
import { parseAliases, toClubFormValues, clubDataSchema } from '../../src/features/club/schemas';
import { formatVenueAddress } from '../../src/features/venues/schemas';
import { contactPeople, searchDirectory, type DirectoryEntry } from '../../src/features/club/directory';
import { bundeslandLabel, BUNDESLAND_OPTIONS } from '../../src/lib/bundeslaender';

function renderPage(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const directoryRows = [
  {
    id: 'd-1',
    full_name: 'Anna Admin',
    first_name: 'Anna',
    last_name: 'Admin',
    role: 'admin',
    status: 'active',
    no_games: false,
    qttr: 1620,
    email: 'anna@example.com',
    phone: null,
    mobile_phone: null,
    birthday: null,
  },
  {
    id: 'd-2',
    full_name: 'Meik Mannschaft',
    first_name: 'Meik',
    last_name: 'Mannschaft',
    role: 'team_leader',
    status: 'active',
    no_games: false,
    qttr: 1680,
    email: null,
    phone: null,
    mobile_phone: null,
    birthday: null,
  },
  {
    id: 'd-3',
    full_name: 'Tina Trainerin',
    first_name: 'Tina',
    last_name: 'Trainerin',
    role: 'trainer',
    status: 'active',
    no_games: false,
    qttr: null,
    email: 'tina@example.com',
    phone: null,
    mobile_phone: '0170 1234567',
    birthday: null,
  },
] as unknown as DirectoryEntry[];

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    club_settings: [
      { key: 'club_name', value: 'TTC Musterstadt' },
      { key: 'club_short_name', value: 'TTC' },
      { key: 'bundesland', value: 'NW' },
      { key: 'about_html', value: 'Wir spielen seit 1952 Tischtennis.' },
    ],
    venues: [
      {
        id: 'v-1',
        name: 'Sporthalle Musterstadt',
        address: 'Turnstraße 5',
        postal_code: '12345',
        city: 'Musterstadt',
        max_games: 2,
        allow_training_at_max_games: false,
        training_only: false,
        active: true,
      },
    ],
    profiles: [],
    groups: [],
    group_members: [],
    v_members_directory: directoryRows as unknown as Row[],
  };
  state.inserts = [];
  state.updates = [];
  state.upserts = [];
});

// ------------------------------------------------------------------ reine Logik

describe('Vereinsdaten', () => {
  it('füllt fehlende Schlüssel mit Leerstrings und setzt ein Bundesland', () => {
    const values = toClubFormValues({ club_name: 'TTC Musterstadt' });

    expect(values.club_name).toBe('TTC Musterstadt');
    expect(values.website_url).toBe('');
    expect(values.bundesland).toBe('NW');
  });

  it('zerlegt die Schreibweisen des Vereinsnamens', () => {
    expect(parseAliases('TTC Musterstadt, TTC Muster ,, ')).toEqual([
      'TTC Musterstadt',
      'TTC Muster',
    ]);
  });

  it('verlangt einen Vereinsnamen', () => {
    const result = clubDataSchema.safeParse(toClubFormValues({ club_name: '  ' }));
    expect(result.success).toBe(false);
  });

  it('lässt leere Adressfelder zu, aber keine halben', () => {
    const base = toClubFormValues({ club_name: 'TTC' });

    expect(clubDataSchema.safeParse({ ...base, website_url: '' }).success).toBe(true);
    expect(clubDataSchema.safeParse({ ...base, website_url: 'ttc.example.org' }).success).toBe(
      false,
    );
    expect(
      clubDataSchema.safeParse({ ...base, website_url: 'https://ttc.example.org' }).success,
    ).toBe(true);
  });

  it('kennt genau die 16 Bundesländer', () => {
    expect(BUNDESLAND_OPTIONS).toHaveLength(16);
    expect(bundeslandLabel('NW')).toBe('Nordrhein-Westfalen');
    expect(bundeslandLabel(null)).toBe('');
  });
});

describe('Orte', () => {
  it('setzt die Adresse aus den Teilen zusammen', () => {
    expect(
      formatVenueAddress({ address: 'Turnstraße 5', postal_code: '12345', city: 'Musterstadt' }),
    ).toBe('Turnstraße 5, 12345 Musterstadt');
  });

  it('lässt fehlende Teile weg, statt Kommas zu stapeln', () => {
    expect(formatVenueAddress({ address: '', postal_code: null, city: 'Musterstadt' })).toBe(
      'Musterstadt',
    );
    expect(formatVenueAddress({ address: null, postal_code: null, city: null })).toBe('');
  });
});

describe('Verzeichnis', () => {
  it('sucht ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    expect(searchDirectory(directoryRows, 'meik')).toHaveLength(1);
    expect(searchDirectory(directoryRows, '')).toHaveLength(3);
  });

  it('sortiert Ansprechpartner nach Rolle', () => {
    expect(contactPeople(directoryRows).map((entry) => entry.role)).toEqual([
      'admin',
      'trainer',
      'team_leader',
    ]);
  });
});

// ------------------------------------------------------------------ Oberfläche

describe('ClubPage', () => {
  it('zeigt alle Reiter', async () => {
    renderPage(<ClubPage />);

    for (const label of ['Daten', 'Ämter', 'Neuigkeiten', 'Dateien', 'Übersicht', 'Betrieb']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('lädt die gespeicherten Vereinsdaten ins Formular', async () => {
    renderPage(<ClubPage />);

    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('TTC Musterstadt'));
    expect(screen.getByLabelText('Bundesland')).toHaveValue('NW');
  });

  it('bietet die aktiven Orte als Standardort an', async () => {
    renderPage(<ClubPage />);

    const select = await screen.findByLabelText('Standardort');
    await waitFor(() =>
      expect(within(select).getByRole('option', { name: 'Sporthalle Musterstadt' })).toBeInTheDocument(),
    );
  });

  it('speichert die geänderten Daten als Schlüssel-Wert-Paare', async () => {
    renderPage(<ClubPage />);

    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('TTC Musterstadt'));

    const name = screen.getByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'TTC Neustadt');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.upserts).toHaveLength(1));
    const rows = state.upserts[0].values as { key: string; value: string }[];
    expect(rows).toContainEqual({ key: 'club_name', value: 'TTC Neustadt' });
    expect(rows).toContainEqual({ key: 'bundesland', value: 'NW' });
  });

  it('weist eine unvollständige Webadresse ab', async () => {
    renderPage(<ClubPage />);
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('TTC Musterstadt'));

    await userEvent.type(screen.getByLabelText('Webseite'), 'ttc.example.org');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/vollständige Adresse mit https/)).toBeInTheDocument();
    expect(state.upserts).toHaveLength(0);
  });

  it('schlägt einen Registrierungscode vor, ohne ihn schon zu speichern', async () => {
    renderPage(<ClubPage />);
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('TTC Musterstadt'));

    await userEvent.click(screen.getByRole('button', { name: /Neuen Code vorschlagen/ }));

    const code = screen.getByLabelText('Code') as HTMLInputElement;
    expect(code.value).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(state.upserts).toHaveLength(0);
  });
});

describe('VenuesPage', () => {
  it('listet die Orte mit Adresse', async () => {
    renderPage(<VenuesPage />);

    expect(await screen.findAllByText('Sporthalle Musterstadt')).not.toHaveLength(0);
    expect(screen.getAllByText('Turnstraße 5, 12345 Musterstadt').length).toBeGreaterThan(0);
  });

  it('legt einen Ort an', async () => {
    renderPage(<VenuesPage />);
    await screen.findAllByText('Sporthalle Musterstadt');

    await userEvent.click(screen.getByRole('button', { name: /Ort anlegen/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Gymnasium');
    await userEvent.type(within(dialog).getByLabelText('Ort'), 'Musterstadt');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(state.inserts).toHaveLength(1));
    expect(state.inserts[0]).toMatchObject({
      table: 'venues',
      values: { name: 'Gymnasium', city: 'Musterstadt', max_games: null, active: true },
    });
  });

  it('verlangt einen Namen', async () => {
    renderPage(<VenuesPage />);
    await screen.findAllByText('Sporthalle Musterstadt');

    await userEvent.click(screen.getByRole('button', { name: /Ort anlegen/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Der Ort braucht einen Namen')).toBeInTheDocument();
    expect(state.inserts).toHaveLength(0);
  });

  it('legt einen Ort still, statt ihn zu löschen', async () => {
    renderPage(<VenuesPage />);
    await screen.findAllByText('Sporthalle Musterstadt');

    await userEvent.click(
      screen.getAllByRole('button', { name: /Sporthalle Musterstadt stilllegen/ })[0],
    );

    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]).toEqual({ table: 'venues', values: { active: false } });
  });

  it('führt die Schlüssel unter den Orten', async () => {
    renderPage(<VenuesPage />);
    expect(await screen.findByRole('heading', { name: 'Schlüssel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schlüssel anlegen/ })).toBeInTheDocument();
  });
});

describe('MyClubPage', () => {
  it('zeigt das Verzeichnis mit freigegebenen Kontaktdaten', async () => {
    renderPage(<MyClubPage />);

    expect(await screen.findAllByText('Anna Admin')).not.toHaveLength(0);
    expect(screen.getAllByText('anna@example.com').length).toBeGreaterThan(0);
  });

  it('sagt deutlich, wenn jemand seine Daten nicht freigegeben hat', async () => {
    renderPage(<MyClubPage />);
    await screen.findAllByText('Meik Mannschaft');

    expect(screen.getAllByText('nicht freigegeben').length).toBeGreaterThan(0);
  });

  it('sucht im Verzeichnis', async () => {
    renderPage(<MyClubPage />);
    await screen.findAllByText('Anna Admin');

    await userEvent.type(screen.getByLabelText('Suchen'), 'Tina');

    await waitFor(() => expect(screen.queryByText('Anna Admin')).toBeNull());
    expect(screen.getAllByText('Tina Trainerin').length).toBeGreaterThan(0);
  });

  it('listet die Ansprechpartner mit Rolle', async () => {
    renderPage(<MyClubPage />);
    await screen.findAllByText('Anna Admin');

    await userEvent.click(screen.getByRole('tab', { name: 'Rollen & Kontaktdaten' }));

    expect(await screen.findByText(/Administratoren, Trainer und Mannschaftsführer/)).toBeInTheDocument();
    expect(screen.getAllByText('Trainer').length).toBeGreaterThan(0);
  });

  it('zeigt den Vereinstext, wenn einer hinterlegt ist', async () => {
    renderPage(<MyClubPage />);
    await screen.findAllByText('Anna Admin');

    await userEvent.click(screen.getByRole('tab', { name: 'Über den Verein' }));

    expect(await screen.findByText('Wir spielen seit 1952 Tischtennis.')).toBeInTheDocument();
  });
});
