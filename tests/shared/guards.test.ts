import { describe, it, expect } from 'vitest';
import {
  berlinToday,
  fetchAllPages,
  isSafeFeedUrl,
  safeEqual,
  sanitizeCc,
  vapidSubject,
} from '../../supabase/functions/_shared/guards';

describe('berlinToday', () => {
  it('ist um 0:30 deutscher Zeit schon der neue Tag, obwohl UTC noch gestern ist', () => {
    // 22:30 UTC im Sommer = 0:30 MESZ
    expect(berlinToday(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });

  it('stimmt im Winter mit einer Stunde Versatz', () => {
    expect(berlinToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(berlinToday(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31');
  });
});

describe('safeEqual', () => {
  it('erkennt Gleichheit und Unterschiede, auch bei verschiedener Länge', () => {
    expect(safeEqual('geheim', 'geheim')).toBe(true);
    expect(safeEqual('geheim', 'geheiM')).toBe(false);
    expect(safeEqual('geheim', 'geheim1')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});

describe('sanitizeCc', () => {
  it('lässt nur gültige Adressen durch, ohne Dubletten und ohne den Empfänger', () => {
    expect(
      sanitizeCc(['eltern@example.com', 'kaputt', 'ELTERN@example.com', 'ich@example.com'], 'ich@example.com'),
    ).toEqual(['eltern@example.com']);
  });

  it('begrenzt auf drei Kopien', () => {
    const list = ['a@x.de', 'b@x.de', 'c@x.de', 'd@x.de', 'e@x.de'];
    expect(sanitizeCc(list)).toEqual(['a@x.de', 'b@x.de', 'c@x.de']);
  });

  it('gibt nichts zurück, wenn nichts übrig bleibt oder kein Array kommt', () => {
    expect(sanitizeCc('eltern@example.com')).toBeUndefined();
    expect(sanitizeCc(['<a@b.de>'])).toBeUndefined();
    expect(sanitizeCc(undefined)).toBeUndefined();
  });
});

describe('isSafeFeedUrl', () => {
  it('erlaubt öffentliche https-Adressen', () => {
    expect(isSafeFeedUrl('https://www.mytischtennis.de/clicktt/WTTV/ical/123.ics')).toBe(true);
  });

  it('weist http, IP-Adressen, lokale Namen und Zugangsdaten ab', () => {
    expect(isSafeFeedUrl('http://www.mytischtennis.de/x.ics')).toBe(false);
    expect(isSafeFeedUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafeFeedUrl('https://[::1]/x')).toBe(false);
    expect(isSafeFeedUrl('https://localhost/x')).toBe(false);
    expect(isSafeFeedUrl('https://db.internal/x')).toBe(false);
    expect(isSafeFeedUrl('https://intranet/x')).toBe(false);
    expect(isSafeFeedUrl('https://user:pw@example.com/x')).toBe(false);
    expect(isSafeFeedUrl('kein link')).toBe(false);
  });
});

describe('vapidSubject', () => {
  it('nimmt die Absenderadresse, sonst die https-Adresse der App, sonst nichts', () => {
    expect(vapidSubject('verein@example.com', '')).toBe('mailto:verein@example.com');
    expect(vapidSubject('', 'https://verein.example')).toBe('https://verein.example');
    expect(vapidSubject('', 'http://localhost:5173')).toBeNull();
  });
});

describe('fetchAllPages', () => {
  function pager(total: number, cap: number) {
    const calls: [number, number][] = [];
    const page = (from: number, to: number) => {
      calls.push([from, to]);
      const end = Math.min(to + 1, from + cap, total);
      const data = Array.from({ length: Math.max(end - from, 0) }, (_, i) => from + i);
      return Promise.resolve({ data, error: null });
    };
    return { page, calls };
  }

  it('holt alle Zeilen über mehrere Seiten', async () => {
    const { page } = pager(2500, 1000);
    const rows = await fetchAllPages(page);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toBe(2499);
  });

  it('stimmt auch, wenn der Server weniger je Seite liefert als angefragt', async () => {
    const { page } = pager(1200, 500);
    const rows = await fetchAllPages(page, 1000);
    expect(rows).toHaveLength(1200);
    expect(new Set(rows).size).toBe(1200);
  });

  it('meldet Fehler, statt eine halbe Liste zurückzugeben', async () => {
    await expect(
      fetchAllPages(() => Promise.resolve({ data: null, error: { message: 'kaputt' } })),
    ).rejects.toThrow('kaputt');
  });
});
