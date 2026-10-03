import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SessionKeys } from '../../src/features/keys/api';
import type { TrainingSession } from '../../src/features/trainings/api';
import KeyBearerRow from '../../src/features/trainings/KeyBearerRow';

/*
  Die Schlüsselzeile am Trainingstermin zeigt den Schlüsseldienst nur an. Geändert wird
  er unter „Orte & Schlüsseldienst" — wer dort planen darf, bekommt einen Knopf direkt
  zum Tag des Termins.
*/

const who = vi.hoisted(() => ({ role: 'member', keyService: false }));
vi.mock('../../src/features/auth/session', () => ({
  useSession: () => ({
    profile: { id: 'p-me', key_service: who.keyService },
    role: who.role,
  }),
}));

const inTwoDays = new Date(Date.now() + 2 * 86_400_000);
const session = {
  id: 's-1',
  training_id: 't-1',
  session_date: '2026-10-07',
  starts_at: inTwoDays.toISOString(),
  ends_at: new Date(inTwoDays.getTime() + 2 * 3600_000).toISOString(),
  cancelled: false,
} as unknown as TrainingSession;

function sessionKeys(extra: Partial<SessionKeys> = {}): SessionKeys {
  return {
    session_id: 's-1',
    has_bearer: false,
    bearer_id: null,
    bearer_name: null,
    duty_id: null,
    duty_name: null,
    ...extra,
  } as SessionKeys;
}

function renderRow(keys: SessionKeys, over: Partial<TrainingSession> = {}) {
  return render(
    <MemoryRouter>
      <KeyBearerRow session={{ ...session, ...over }} keys={keys} profileId="p-me" />
    </MemoryRouter>,
  );
}

describe('KeyBearerRow', () => {
  it('nennt den Schlüsseldienst des Tages', () => {
    renderRow(sessionKeys({ duty_id: 'p-k', duty_name: 'Karl Klein' }));
    expect(screen.getByText('Schlüsseldienst: Karl Klein')).toBeInTheDocument();
  });

  it('sagt es dem Schlüsseldienst selbst', () => {
    renderRow(sessionKeys({ duty_id: 'p-me', duty_name: 'Ich' }));
    expect(screen.getByText('Du hast an diesem Tag Schlüsseldienst.')).toBeInTheDocument();
  });

  it('zeigt, wenn niemand eingeteilt ist', () => {
    renderRow(sessionKeys());
    expect(screen.getByText('Kein Schlüsseldienst eingeteilt.')).toBeInTheDocument();
  });

  it('zeigt einen früheren Eintrag „bringt den Schlüssel" weiter an', () => {
    renderRow(sessionKeys({ has_bearer: true, bearer_id: 'p-b', bearer_name: 'Berta' }));
    expect(screen.getByText('Schlüsseldienst: Berta')).toBeInTheDocument();
  });

  it('zeigt dem Mitglied ohne Kennzeichen nur den Namen', () => {
    renderRow(sessionKeys({ duty_id: 'p-me', duty_name: 'Ich' }));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it.each([
    ['dem Schlüsseldienst', 'member', true],
    ['dem Administrator', 'admin', false],
  ])('führt %s zum Tag im Schlüsseldienst', (_, role, keyService) => {
    who.role = role;
    who.keyService = keyService;
    try {
      renderRow(sessionKeys({ duty_id: 'p-k', duty_name: 'Karl Klein' }));
      expect(screen.getByRole('link', { name: 'Zum Schlüsseldienst' })).toHaveAttribute(
        'href',
        '/venues?date=2026-10-07',
      );
      expect(screen.queryByRole('combobox')).toBeNull();
    } finally {
      who.role = 'member';
      who.keyService = false;
    }
  });

  it('bleibt bei einem ausgefallenen Termin weg', () => {
    const { container } = renderRow(sessionKeys(), { cancelled: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('verlinkt bei einem vergangenen Termin nicht mehr', () => {
    who.role = 'admin';
    try {
      const past = new Date(Date.now() - 2 * 86_400_000);
      renderRow(sessionKeys(), { starts_at: past.toISOString(), ends_at: past.toISOString() });
      expect(screen.queryByRole('link')).toBeNull();
    } finally {
      who.role = 'member';
    }
  });
});
