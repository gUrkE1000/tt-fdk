import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  clearPersistedCaches,
  restoreCache,
  saveCache,
} from '../../src/lib/queryPersist';

function clientWith(entries: [unknown[], unknown][]): QueryClient {
  const client = new QueryClient();
  for (const [key, data] of entries) client.setQueryData(key, data);
  return client;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('Zwischenspeicher auf dem Gerät', () => {
  it('bringt nach dem Neustart den letzten Stand zurück', () => {
    const before = clientWith([[['matches', 'list', 'recent'], [{ id: 'm-1' }]]]);
    expect(saveCache(before, 'u-1')).toBe(true);

    const after = new QueryClient();
    expect(restoreCache(after, 'u-1')).toBe(true);
    expect(after.getQueryData(['matches', 'list', 'recent'])).toEqual([{ id: 'm-1' }]);
  });

  it('legt Verwaltungsdaten und Mitteilungen nicht auf dem Gerät ab', () => {
    const before = clientWith([
      [['admin', 'notifications', 'failed'], [{ id: 'x' }]],
      [['notifications', 'mine', 'u-1'], [{ link: '/r/geheim' }]],
      [['members', 'admin-list', null], [{ email: 'a@b.de' }]],
      [['members', 'list', null], [{ full_name: 'Anna' }]],
    ]);
    saveCache(before, 'u-1');

    const raw = window.localStorage.getItem('vp-cache:u-1') ?? '';
    expect(raw).not.toContain('/r/geheim');
    expect(raw).not.toContain('a@b.de');
    // Die Namensliste bleibt: ohne sie stünden offline keine Namen an den Karten.
    expect(raw).toContain('Anna');
  });

  it('hält die Stände verschiedener Benutzer auseinander', () => {
    saveCache(clientWith([[['teams', 'list'], ['A']]]), 'u-1');

    const other = new QueryClient();
    expect(restoreCache(other, 'u-2')).toBe(false);
    expect(other.getQueryData(['teams', 'list'])).toBeUndefined();
  });

  it('verwirft einen Stand, der älter als eine Woche ist', () => {
    const now = Date.now();
    saveCache(clientWith([[['teams', 'list'], ['A']]]), 'u-1', now - 8 * 86_400_000);

    expect(restoreCache(new QueryClient(), 'u-1', now)).toBe(false);
    expect(window.localStorage.getItem('vp-cache:u-1')).toBeNull();
  });

  it('löscht beim Abmelden alles, was gespeichert war', () => {
    saveCache(clientWith([[['teams', 'list'], ['A']]]), 'u-1');
    saveCache(clientWith([[['teams', 'list'], ['B']]]), 'u-2');
    window.localStorage.setItem('anderes', 'bleibt');

    clearPersistedCaches();

    expect(window.localStorage.getItem('vp-cache:u-1')).toBeNull();
    expect(window.localStorage.getItem('vp-cache:u-2')).toBeNull();
    expect(window.localStorage.getItem('anderes')).toBe('bleibt');
  });

  it('übersteht kaputte Daten im Speicher', () => {
    window.localStorage.setItem('vp-cache:u-1', '{kaputt');
    expect(restoreCache(new QueryClient(), 'u-1')).toBe(false);
    expect(window.localStorage.getItem('vp-cache:u-1')).toBeNull();
  });
});
