import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const state = {
  describe: { status: 'ok', action: 'match_response', summary: '1. Herren gegen TTC Nachbarstadt am 05.10.2026 um 19:00 Uhr' } as Record<string, unknown>,
  answer: { status: 'ok', answer: 'yes', summary: '1. Herren gegen TTC Nachbarstadt am 05.10.2026 um 19:00 Uhr' } as Record<string, unknown>,
  calls: [] as { name: string; args: unknown }[],
};

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      state.calls.push({ name, args });
      return Promise.resolve({
        data: name === 'rpc_describe_action_token' ? state.describe : state.answer,
        error: null,
      });
    },
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ subscription: { unsubscribe: vi.fn() } }),
    },
  },
  APP_URL: 'http://localhost:5173',
}));

import ActionPage from '../../src/features/auth/ActionPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/r/:token" element={<ActionPage />} />
        <Route path="/" element={<p>Startseite</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.calls = [];
  state.describe = {
    status: 'ok',
    action: 'match_response',
    summary: '1. Herren gegen TTC Nachbarstadt am 05.10.2026 um 19:00 Uhr',
  };
  state.answer = {
    status: 'ok',
    answer: 'yes',
    summary: '1. Herren gegen TTC Nachbarstadt am 05.10.2026 um 19:00 Uhr',
  };
});

describe('ActionPage', () => {
  it('fragt nach, worum es geht, bevor sie etwas speichert', async () => {
    renderAt('/r/abc');

    expect(await screen.findByText('Kannst du spielen?')).toBeInTheDocument();
    expect(screen.getByText(/TTC Nachbarstadt/)).toBeInTheDocument();
    expect(state.calls.map((call) => call.name)).toEqual(['rpc_describe_action_token']);
  });

  it('speichert die Antwort aus dem Knopfdruck', async () => {
    renderAt('/r/abc');
    await screen.findByText('Kannst du spielen?');

    await userEvent.click(screen.getByRole('button', { name: /Absage/ }));

    await waitFor(() =>
      expect(state.calls).toContainEqual({
        name: 'rpc_answer_action_token',
        args: { p_token: 'abc', p_answer: 'no' },
      }),
    );
  });

  it('speichert eine Antwort aus dem Link erst nach der Bestätigung', async () => {
    // Link-Scanner der Mailprogramme öffnen Links mit JavaScript. Sofort zu speichern hieße,
    // im Namen des Empfängers zu antworten und den Einmal-Link zu verbrauchen.
    state.answer = { status: 'ok', answer: 'yes' };
    renderAt('/r/abc?a=yes');

    expect(await screen.findByText(/bitte bestätigen/)).toBeInTheDocument();
    expect(state.calls.map((call) => call.name)).toEqual(['rpc_describe_action_token']);

    await userEvent.click(screen.getByRole('button', { name: /Zusage/ }));

    await waitFor(() =>
      expect(state.calls).toContainEqual({
        name: 'rpc_answer_action_token',
        args: { p_token: 'abc', p_answer: 'yes' },
      }),
    );
    expect(await screen.findByText('Danke!')).toBeInTheDocument();
    expect(screen.getByText(/Deine Zusage ist gespeichert/)).toBeInTheDocument();
  });

  it('nennt die Antwort beim Namen', async () => {
    state.answer = { status: 'ok', answer: 'no' };
    renderAt('/r/abc');
    await screen.findByText('Kannst du spielen?');
    await userEvent.click(screen.getByRole('button', { name: /Absage/ }));

    expect(await screen.findByText(/Deine Absage ist gespeichert/)).toBeInTheDocument();
  });

  it('fragt bei einem Vereinstermin passend und ohne „unsicher"', async () => {
    state.describe = { status: 'ok', action: 'event_response', summary: 'Sommerfest am 01.08.2026' };
    renderAt('/r/abc');

    expect(await screen.findByText('Bist du dabei?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Unsicher/ })).toBeNull();
  });

  it('fragt bei einer Ersatzanfrage nach dem Einspringen', async () => {
    state.describe = { status: 'ok', action: 'substitute_answer', summary: '2. Herren am 03.10.2026' };
    renderAt('/r/abc');

    expect(await screen.findByText('Kannst du als Ersatz einspringen?')).toBeInTheDocument();
  });

  it('erklärt einen bereits benutzten Link', async () => {
    state.describe = { status: 'used' };
    renderAt('/r/abc');

    expect(await screen.findByText(/schon geantwortet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zusage/ })).toBeNull();
  });

  it('erklärt einen abgelaufenen Link', async () => {
    state.describe = { status: 'expired' };
    renderAt('/r/abc');

    expect(await screen.findByText(/abgelaufen/)).toBeInTheDocument();
  });

  it('erklärt einen unbekannten Link', async () => {
    state.describe = { status: 'unknown' };
    renderAt('/r/abc');

    expect(await screen.findByText(/ungültig/)).toBeInTheDocument();
  });

  it('erklärt einen geschlossenen Meldeschluss', async () => {
    state.describe = { status: 'ok', action: 'match_response', summary: 'Ein Spiel' };
    state.answer = { status: 'closed' };
    renderAt('/r/abc?a=yes');
    await userEvent.click(await screen.findByRole('button', { name: /Zusage/ }));

    expect(await screen.findByText(/geschlossen/)).toBeInTheDocument();
  });

  it('bietet immer den Weg in die App an', async () => {
    renderAt('/r/abc');
    expect(await screen.findByRole('link', { name: 'Zur App' })).toBeInTheDocument();
  });

  it('fragt beim Training nach „Komme später" statt „Unsicher"', async () => {
    state.describe = {
      status: 'ok',
      action: 'training_response',
      summary: 'Erwachsenentraining am 06.10.2026 um 19:00 Uhr',
    };
    state.answer = { status: 'ok', answer: 'late', summary: 'Erwachsenentraining am 06.10.2026' };
    renderAt('/r/abc');

    expect(await screen.findByText('Kommst du zum Training?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Unsicher/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Komme später/ }));

    expect(await screen.findByText(/Deine Antwort „Komme später" ist gespeichert/)).toBeInTheDocument();
    expect(state.calls).toContainEqual({
      name: 'rpc_answer_action_token',
      args: { p_token: 'abc', p_answer: 'late' },
    });
  });

  it('schickt bei der Terminumfrage in die App, statt einen Fehler zu zeigen', async () => {
    state.describe = {
      status: 'ok',
      action: 'poll_vote',
      summary: '1. Herren gegen TTC Nachbarstadt am 05.10.2026 um 19:00 Uhr',
    };
    renderAt('/r/abc');

    expect(await screen.findByText('Terminumfrage zur Spielverlegung')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Terminumfrage' })).toHaveAttribute(
      'href',
      '/my-games',
    );
    expect(screen.queryByRole('button', { name: /Zusage/ })).toBeNull();
  });

  it('erklärt, warum ein Training nicht mehr geht', async () => {
    state.describe = { status: 'cancelled' };
    renderAt('/r/abc');
    expect(await screen.findByText('Dieser Termin fällt aus.')).toBeInTheDocument();
  });
});
