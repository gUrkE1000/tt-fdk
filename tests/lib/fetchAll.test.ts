import { describe, it, expect } from 'vitest';
import { fetchAll } from '../../src/lib/fetchAll';

/** Ein Server mit `total` Zeilen, der höchstens `cap` je Anfrage liefert. */
function server(total: number, cap: number, withCount = true) {
  let requests = 0;
  const page = (from: number, to: number) => {
    requests += 1;
    const end = Math.min(to + 1, from + cap, total);
    const data = Array.from({ length: Math.max(end - from, 0) }, (_, i) => from + i);
    return Promise.resolve({ data, error: null, count: withCount ? total : null });
  };
  return { page, requests: () => requests };
}

describe('fetchAll', () => {
  it('holt mehr als 1000 Zeilen über mehrere Seiten', async () => {
    const { page, requests } = server(2345, 1000);
    const rows = await fetchAll(page);
    expect(rows).toHaveLength(2345);
    expect(rows.at(-1)).toBe(2344);
    expect(requests()).toBe(3);
  });

  it('stimmt auch, wenn der Server weniger je Seite liefert als angefragt', async () => {
    const { page } = server(1200, 500);
    const rows = await fetchAll(page, 1000);
    expect(new Set(rows).size).toBe(1200);
  });

  it('hört ohne Gesamtzahl bei der ersten unvollständigen Seite auf', async () => {
    const { page, requests } = server(10, 1000, false);
    expect(await fetchAll(page)).toHaveLength(10);
    expect(requests()).toBe(1);
  });

  it('wirft den Fehler der Abfrage weiter', async () => {
    const failure = { message: 'kaputt', code: '42501' };
    await expect(
      fetchAll(() => Promise.resolve({ data: null, error: failure, count: null })),
    ).rejects.toBe(failure);
  });
});
