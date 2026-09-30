import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = {
  updates: [] as { id: unknown; values: unknown }[],
  pdfLines: [] as string[],
  /** Spiele, deren Änderung die Datenbank verweigert (RLS: null Zeilen). */
  denied: new Set<string>(),
};

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      update: (values: unknown) => ({
        eq: (_column: string, id: string) => ({
          select: () => {
            state.updates.push({ id, values });
            return Promise.resolve({
              data: state.denied.has(id) ? [] : [{ id }],
              error: null,
            });
          },
        }),
      }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

vi.mock('../../src/lib/pdfText', () => ({
  readPdfLines: vi.fn(async () => state.pdfLines),
}));

import NuscoreImportDialog from '../../src/features/matches/NuscoreImportDialog';
import { readPdfLines } from '../../src/lib/pdfText';
import { ToastProvider } from '../../src/components/ui';
import type { MatchRow } from '../../src/features/matches/api';
import type { TeamWithRoster } from '../../src/features/teams/api';

const TEAMS = [
  { id: 't-1', name: '2. Herren', leaderIds: [], regularIds: [], substituteIds: [] },
  { id: 't-2', name: '3. Herren', leaderIds: [], regularIds: [], substituteIds: [] },
] as unknown as TeamWithRoster[];

function matchRow(overrides: Partial<MatchRow>): MatchRow {
  return {
    id: 'm-x',
    team_id: 't-1',
    dtstart: '2026-10-10T16:30:00Z',
    dtstart_external: null,
    opponent: 'TTC Kirchheim',
    is_home: true,
    nuscore_code: null,
    nuscore_pin: null,
    active: true,
    confirmedCount: 0,
    ...overrides,
  } as MatchRow;
}

const MATCHES = [
  matchRow({ id: 'm-1' }),
  matchRow({ id: 'm-2', dtstart: '2026-10-18T08:00:00Z', opponent: 'SC Baldham', is_home: false }),
  // Dieselbe Uhrzeit, aber die andere Mannschaft: darf nichts abbekommen.
  matchRow({ id: 'm-9', team_id: 't-2', opponent: 'SV Heimstetten' }),
];

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <NuscoreImportDialog open onOpenChange={() => {}} teams={TEAMS} matches={MATCHES} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Ein Einlesen, das erst endet, wenn der Test es sagt — wie pdfjs beim ersten Laden. */
function slowRead() {
  let finish: (lines: string[]) => void = () => {};
  vi.mocked(readPdfLines).mockImplementationOnce(
    () => new Promise<string[]>((resolve) => (finish = resolve)),
  );
  return (lines: string[]) => act(() => finish(lines));
}

const CODE_LINE = 'Sa. 10.10.2026 18:30 TSV Feldkirchen II TTC Kirchheim 7EXU-XFZU-F8S4';
const PIN_LINES = [
  'Sa. 10.10.2026 18:30 TSV Feldkirchen II TTC Kirchheim 4711',
  'So. 18.10.2026 10:00 SC Baldham TSV Feldkirchen II 0815',
];

function pdf(name: string) {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

beforeEach(() => {
  state.updates = [];
  state.pdfLines = [];
  state.denied = new Set();
});

describe('NuscoreImportDialog', () => {
  it('liest beide Listen, zeigt die Vorschau und speichert je Spiel', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');

    state.pdfLines = ['Sa. 10.10.2026 18:30 TSV Feldkirchen II TTC Kirchheim 7EXU-XFZU-F8S4'];
    await user.upload(screen.getByLabelText('Spiel-Codes (PDF)'), pdf('codes.pdf'));
    expect(await screen.findByText('7EXUXFZUF8S4')).toBeInTheDocument();

    state.pdfLines = [
      'Sa. 10.10.2026 18:30 TSV Feldkirchen II TTC Kirchheim 4711',
      'So. 18.10.2026 10:00 SC Baldham TSV Feldkirchen II 0815',
      'So. 01.11.2026 10:00 TSV Feldkirchen II Post SV 9999',
    ];
    await user.upload(screen.getByLabelText('Spiel-PINs (PDF)'), pdf('pins.pdf'));
    expect(await screen.findByText('0815')).toBeInTheDocument();
    expect(screen.getByText('1 nicht zugeordnet')).toBeInTheDocument();
    expect(screen.getByText(/kein Spiel dieser Mannschaft an diesem Tag/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => expect(state.updates).toHaveLength(2));
    expect(state.updates).toEqual(
      expect.arrayContaining([
        { id: 'm-1', values: { nuscore_code: '7EXUXFZUF8S4', nuscore_pin: '4711' } },
        { id: 'm-2', values: { nuscore_pin: '0815' } },
      ]),
    );
    expect(await screen.findByText('2 Spiele ergänzt')).toBeInTheDocument();
  });

  it('nimmt eingefügten Text, wenn die PDF sich nicht lesen lässt', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');
    await user.click(screen.getByRole('button', { name: /Text einfügen/ }));
    await user.type(
      screen.getByLabelText('Spiel-PINs als Text'),
      '10.10.2026 18:30 TTC Kirchheim 4711',
    );
    await user.tab();

    expect(await screen.findByText('4711')).toBeInTheDocument();
  });

  it('meldet eine Liste ohne Werte', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');
    state.pdfLines = ['Mannschaftsmeldung Vorrunde', 'Keine Spiel-Codes'];
    await user.upload(screen.getByLabelText('Spiel-Codes (PDF)'), pdf('falsch.pdf'));

    expect(await screen.findByText(/ist es die richtige Liste/)).toBeInTheDocument();
  });

  it('zählt Spiele, die die Datenbank nicht ändern ließ, als nicht gespeichert', async () => {
    const user = userEvent.setup();
    state.denied.add('m-1');
    renderDialog();

    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');
    state.pdfLines = ['10.10.2026 18:30 TTC Kirchheim 4711'];
    await user.upload(screen.getByLabelText('Spiel-PINs (PDF)'), pdf('pins.pdf'));
    await screen.findByText('4711');
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(await screen.findByText('0 Spiele ergänzt, 1 nicht gespeichert')).toBeInTheDocument();
  });

  // Fehlerbild: Beide Listen auf einmal hochgeladen, übernommen wurde nur eine. Während
  // die erste PDF gelesen wurde (beim ersten Mal lädt pdfjs nach), waren beide Felder
  // gesperrt und „Übernehmen" schon frei.
  it('lässt die zweite Liste wählen, während die erste noch gelesen wird', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');

    const finishCodes = slowRead();
    await user.upload(screen.getByLabelText('Spiel-Codes (PDF)'), pdf('codes.pdf'));
    expect(screen.getByText('Die PDF wird gelesen …')).toBeInTheDocument();
    expect(screen.getByLabelText('Spiel-PINs (PDF)')).toBeEnabled();

    const finishPins = slowRead();
    await user.upload(screen.getByLabelText('Spiel-PINs (PDF)'), pdf('pins.pdf'));
    expect(screen.getByText('Die PDFs werden gelesen …')).toBeInTheDocument();

    // Die PINs sind zuerst fertig, die Codes danach — beide bleiben stehen.
    await finishPins(PIN_LINES);
    await finishCodes([CODE_LINE]);

    expect(await screen.findByText('7EXUXFZUF8S4')).toBeInTheDocument();
    expect(screen.getByText('4711')).toBeInTheDocument();
    expect(screen.getByText('0815')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(state.updates).toHaveLength(2));
    expect(state.updates).toEqual(
      expect.arrayContaining([
        { id: 'm-1', values: { nuscore_code: '7EXUXFZUF8S4', nuscore_pin: '4711' } },
        { id: 'm-2', values: { nuscore_pin: '0815' } },
      ]),
    );
  });

  it('übernimmt erst, wenn beide Listen gelesen sind', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');

    state.pdfLines = [CODE_LINE];
    await user.upload(screen.getByLabelText('Spiel-Codes (PDF)'), pdf('codes.pdf'));
    await screen.findByText('7EXUXFZUF8S4');
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeEnabled();

    const finishPins = slowRead();
    await user.upload(screen.getByLabelText('Spiel-PINs (PDF)'), pdf('pins.pdf'));
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeDisabled();

    await finishPins(PIN_LINES);
    expect(await screen.findByText('4711')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeEnabled();
  });

  it('nimmt bei einer neu gewählten Datei nur die zuletzt gewählte', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');

    const finishOld = slowRead();
    await user.upload(screen.getByLabelText('Spiel-PINs (PDF)'), pdf('alt.pdf'));
    state.pdfLines = ['Sa. 10.10.2026 18:30 TSV Feldkirchen II TTC Kirchheim 1234'];
    await user.upload(screen.getByLabelText('Spiel-PINs (PDF)'), pdf('neu.pdf'));
    await screen.findByText('1234');

    await finishOld(PIN_LINES);
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.queryByText('4711')).toBeNull();
    expect(screen.getByText('neu.pdf: 1 Eintrag')).toBeInTheDocument();
  });

  it('verwirft eine Liste, die nach dem Wechsel der Mannschaft fertig wird', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-1');

    const finishPins = slowRead();
    await user.upload(screen.getByLabelText('Spiel-PINs (PDF)'), pdf('pins.pdf'));
    await user.selectOptions(screen.getByLabelText(/Mannschaft/), 't-2');
    await finishPins(PIN_LINES);

    expect(screen.queryByText('Das würde übernommen:')).toBeNull();
    expect(screen.queryByText(/Die PDF wird gelesen/)).toBeNull();
  });

  it('lässt Dateien erst nach der Wahl der Mannschaft zu', () => {
    renderDialog();
    expect(screen.getByLabelText('Spiel-Codes (PDF)')).toBeDisabled();
    expect(screen.getByLabelText('Spiel-PINs (PDF)')).toBeDisabled();
  });
});
