import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = {
  clubSettings: [] as { key: string; value: string }[],
  inserts: [] as { table: string; values: unknown }[],
  upserts: [] as unknown[],
  invocations: [] as { name: string; body: unknown }[],
  invokeError: null as { message: string } | null,
};

function makeBuilder(table: string) {
  const rows = () => (table === 'club_settings' ? state.clubSettings : []);

  const chain = {
    select: () => chain,
    order: () => chain,
    is: () => chain,
    eq: () => chain,
    insert: (values: unknown) => {
      state.inserts.push({ table, values });
      return {
        select: () => ({
          single: () => Promise.resolve({ data: { id: `neu-${state.inserts.length}` }, error: null }),
        }),
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
    },
    upsert: (values: unknown) => {
      state.upserts.push(values);
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rows(), error: null }),
  };

  return chain;
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: (name: string, options: { body: unknown }) => {
        state.invocations.push({ name, body: options.body });
        return Promise.resolve({ data: null, error: state.invokeError });
      },
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'https://verein.example.org',
}));

import { parseInviteLines } from '../../src/features/members/invite';
import InviteDialog from '../../src/features/members/InviteDialog';
import RegistrationLinkDialog from '../../src/features/members/RegistrationLinkDialog';
import { generateRegistrationCode } from '../../src/features/club/api';
import { ToastProvider } from '../../src/components/ui';
import type { Member } from '../../src/features/members/api';

const existing = [
  { id: 'm-1', email: 'anna@example.com', full_name: 'Anna Admin' },
] as unknown as Member[];

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.clubSettings = [];
  state.inserts = [];
  state.upserts = [];
  state.invocations = [];
  state.invokeError = null;
});

// ------------------------------------------------------------------ Zerlegung

describe('parseInviteLines', () => {
  it('liest Vorname, Nachname und Adresse', () => {
    const { entries, invalid } = parseInviteLines('Meik Mannschaft meik@example.com');

    expect(invalid).toEqual([]);
    expect(entries).toEqual([
      { firstName: 'Meik', lastName: 'Mannschaft', email: 'meik@example.com', role: 'member' },
    ]);
  });

  it('nimmt die Rolle hinter der Adresse an', () => {
    const { entries } = parseInviteLines('Tina Trainerin tina@example.com Trainer');
    expect(entries[0].role).toBe('trainer');
  });

  it('versteht auch Doppelnamen', () => {
    const { entries } = parseInviteLines('Anna Maria Admin anna@example.com');
    expect(entries[0]).toMatchObject({ firstName: 'Anna Maria', lastName: 'Admin' });
  });

  it('kommt mit Semikolon und Tabulator zurecht', () => {
    const { entries } = parseInviteLines('Meik;Mannschaft;meik@example.com\nMara\tMF\tmara@example.com');
    expect(entries.map((entry) => entry.email)).toEqual(['meik@example.com', 'mara@example.com']);
  });

  it('meldet Zeilen ohne Adresse und ohne Namen', () => {
    const { entries, invalid } = parseInviteLines('Nur Ein Name\nmeik@example.com');

    expect(entries).toHaveLength(0);
    expect(invalid).toEqual([
      { line: 'Nur Ein Name', reason: 'keine E-Mail-Adresse gefunden' },
      { line: 'meik@example.com', reason: 'Vor- und Nachname fehlen' },
    ]);
  });

  it('lässt dieselbe Adresse nur einmal durch', () => {
    const { entries, invalid } = parseInviteLines(
      'Meik Mannschaft meik@example.com\nMeik Mannschaft MEIK@example.com',
    );

    expect(entries).toHaveLength(1);
    expect(invalid[0].reason).toMatch(/doppelt/);
  });
});

// ------------------------------------------------------------------ Dialog

describe('InviteDialog', () => {
  function renderDialog() {
    return renderWithProviders(
      <InviteDialog open onOpenChange={() => {}} members={existing} />,
    );
  }

  it('zeigt vor dem Versand, wer eingeladen wird', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Liste'), 'Meik Mannschaft meik@example.com');

    expect(await screen.findByText(/Meik Mannschaft · meik@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 einladen' })).toBeEnabled();
  });

  it('überspringt Adressen, die dem Verein schon bekannt sind', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Liste'), 'Anna Admin anna@example.com');

    expect(await screen.findByText(/gehört schon zum Verein/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0 einladen' })).toBeDisabled();
  });

  it('legt ein Profil an und ruft danach die Einladungsfunktion', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Liste'), 'Meik Mannschaft meik@example.com');
    await userEvent.click(screen.getByRole('button', { name: '1 einladen' }));

    await waitFor(() => expect(state.invocations).toHaveLength(1));
    expect(state.inserts[0]).toMatchObject({
      table: 'profiles',
      values: { first_name: 'Meik', last_name: 'Mannschaft', email: 'meik@example.com', status: 'unconfirmed' },
    });
    expect(state.invocations[0]).toEqual({ name: 'invite-member', body: { profileId: 'neu-1' } });
    expect(await screen.findByText(/meik@example.com — eingeladen/)).toBeInTheDocument();
  });

  it('sagt es, wenn jemand schon ein Konto hat', async () => {
    state.invokeError = { message: 'already_registered' };
    renderDialog();

    await userEvent.type(screen.getByLabelText('Liste'), 'Meik Mannschaft meik@example.com');
    await userEvent.click(screen.getByRole('button', { name: '1 einladen' }));

    expect(await screen.findByText(/hat bereits ein Konto/)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------ Vereinscode

describe('RegistrationLinkDialog', () => {
  it('bietet einen Code an, solange keiner hinterlegt ist', async () => {
    renderWithProviders(<RegistrationLinkDialog open onOpenChange={() => {}} />);

    const button = await screen.findByRole('button', { name: 'Code erzeugen' });
    await userEvent.click(button);

    await waitFor(() => expect(state.upserts).toHaveLength(1));
    const rows = state.upserts[0] as { key: string; value: string }[];
    expect(rows[0].key).toBe('registration_code');
    expect(rows[0].value).toHaveLength(8);
  });

  it('zeigt den fertigen Link samt Code', async () => {
    state.clubSettings = [{ key: 'registration_code', value: 'ABCD2345' }];
    renderWithProviders(<RegistrationLinkDialog open onOpenChange={() => {}} />);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Link')).toHaveValue(
        'https://verein.example.org/register/ABCD2345',
      ),
    );
  });
});

describe('generateRegistrationCode', () => {
  it('erzeugt acht Zeichen ohne leicht verwechselbare', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateRegistrationCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it('wiederholt sich nicht', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRegistrationCode()));
    expect(codes.size).toBe(50);
  });
});
