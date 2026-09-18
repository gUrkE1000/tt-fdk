import { describe, it, expect } from 'vitest';
import {
  applyOutcome,
  preflight,
  MAX_ATTEMPTS,
  RETRY_MINUTES,
  type NotificationRow,
} from '../../supabase/functions/_shared/notificationState';

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: 'n-1',
    channel: 'email',
    attempts: 0,
    recipient: 'anna@example.com',
    recipientDeleted: false,
    pushEndpoints: 0,
    ...overrides,
  };
}

const now = new Date('2026-10-05T18:00:00Z');

describe('preflight', () => {
  it('lässt eine versandfertige E-Mail durch', () => {
    expect(preflight(row())).toBeNull();
  });

  it('überspringt Nachrichten an gelöschte Mitglieder', () => {
    const result = preflight(row({ recipientDeleted: true }));
    expect(result?.status).toBe('skipped');
    expect(result?.error).toMatch(/gelöscht/);
  });

  it('überspringt Mitglieder ohne E-Mail-Adresse', () => {
    const result = preflight(row({ recipient: null }));
    expect(result?.status).toBe('skipped');
    expect(result?.error).toMatch(/keine E-Mail-Adresse/);
  });

  it('überspringt Push an Mitglieder ohne angemeldetes Gerät', () => {
    const result = preflight(row({ channel: 'push', pushEndpoints: 0 }));
    expect(result?.status).toBe('skipped');
    expect(result?.error).toMatch(/Kein Gerät/);
  });

  it('lässt Push durch, sobald ein Gerät angemeldet ist', () => {
    expect(preflight(row({ channel: 'push', pushEndpoints: 1 }))).toBeNull();
  });

  it('verlangt für Push keine E-Mail-Adresse', () => {
    // Wer die App installiert hat, aber keine Adresse hinterlegt, bekommt trotzdem Push.
    expect(preflight(row({ channel: 'push', pushEndpoints: 1, recipient: null }))).toBeNull();
  });

  it('prüft die Löschung vor allem anderen', () => {
    // Gelöscht und ohne Adresse: die Löschung ist die richtige Begründung.
    const result = preflight(row({ recipientDeleted: true, recipient: null }));
    expect(result?.error).toMatch(/gelöscht/);
  });
});

describe('applyOutcome', () => {
  it('markiert einen erfolgreichen Versand als verschickt', () => {
    const result = applyOutcome(row(), { kind: 'ok' }, now);

    expect(result).toEqual({
      status: 'sent',
      attempts: 1,
      error: null,
      sentAt: now.toISOString(),
      scheduledFor: null,
    });
  });

  it('plant nach einem vorübergehenden Fehler einen neuen Versuch', () => {
    const result = applyOutcome(row(), { kind: 'error', message: 'HTTP 500' }, now);

    expect(result.status).toBe('pending');
    expect(result.attempts).toBe(1);
    expect(result.error).toBe('HTTP 500');
    expect(result.scheduledFor).toBe(
      new Date(now.getTime() + RETRY_MINUTES * 60_000).toISOString(),
    );
  });

  it('gibt nach drei Versuchen auf', () => {
    const result = applyOutcome(
      row({ attempts: MAX_ATTEMPTS - 1 }),
      { kind: 'error', message: 'HTTP 500' },
      now,
    );

    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(MAX_ATTEMPTS);
    expect(result.scheduledFor).toBeNull();
  });

  it('wiederholt einen dauerhaften Fehler gar nicht erst', () => {
    const result = applyOutcome(row(), { kind: 'permanent', message: 'Adresse ungültig' }, now);

    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(1);
    expect(result.error).toBe('Adresse ungültig');
    expect(result.scheduledFor).toBeNull();
  });

  it('zählt die Versuche auch bei Erfolg hoch', () => {
    expect(applyOutcome(row({ attempts: 2 }), { kind: 'ok' }, now).attempts).toBe(3);
  });
});
