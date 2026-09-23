import { describe, it, expect } from 'vitest';
import { notificationTarget } from '../../src/lib/notificationTarget';

const ORIGIN = 'https://verein.example';

describe('notificationTarget', () => {
  it('übernimmt Pfade und Adressen der eigenen App', () => {
    expect(notificationTarget('/r/abc?a=1#x', ORIGIN)).toBe('/r/abc?a=1#x');
    expect(notificationTarget('https://verein.example/my-games', ORIGIN)).toBe('/my-games');
  });

  it('öffnet keine fremden Seiten', () => {
    expect(notificationTarget('https://phishing.example/login', ORIGIN)).toBe('/');
    expect(notificationTarget('//phishing.example/login', ORIGIN)).toBe('/');
    expect(notificationTarget('javascript:alert(1)', ORIGIN)).toBe('/');
  });

  it('fällt bei leeren oder unbrauchbaren Werten auf die Startseite zurück', () => {
    expect(notificationTarget(undefined, ORIGIN)).toBe('/');
    expect(notificationTarget('', ORIGIN, '/app/')).toBe('/app/');
    expect(notificationTarget(42, ORIGIN)).toBe('/');
  });
});
