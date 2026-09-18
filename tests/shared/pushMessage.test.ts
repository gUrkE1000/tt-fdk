import { describe, it, expect } from 'vitest';
import {
  buildPushMessage,
  classifyPushStatus,
  isGoneStatus,
  PUSH_BODY_LIMIT,
  summarizePush,
  truncateForPush,
} from '../../supabase/functions/_shared/pushMessage';

describe('truncateForPush', () => {
  it('lässt kurze Texte unverändert', () => {
    expect(truncateForPush('Kurz und gut')).toBe('Kurz und gut');
  });

  it('kürzt auf 120 Zeichen und zeigt das an', () => {
    const long = 'a'.repeat(200);
    const result = truncateForPush(long);

    expect(result).toHaveLength(PUSH_BODY_LIMIT);
    expect(result.endsWith('…')).toBe(true);
  });

  it('macht aus Absätzen eine Zeile', () => {
    // Zeilenumbrüche zeigt keine Vorschau — sie würden nur vom Platz abgehen.
    expect(truncateForPush('Hallo Anna,\n\nam Samstag spielst du.')).toBe(
      'Hallo Anna, am Samstag spielst du.',
    );
  });
});

describe('buildPushMessage', () => {
  const row = {
    id: 'n-1',
    type: 'match_reminder',
    subject: 'Erinnerung: 2. Herren gegen TTC Nachbarstadt',
    body_text: 'Hallo Anna,\n\ndein Spiel ist am Samstag um 18:00 Uhr.',
    payload: { link: 'https://verein.example.org/r/abc' },
  };

  it('nimmt den Betreff als Titel und den Text als Vorschau', () => {
    const message = buildPushMessage(row);

    expect(message.title).toBe('Erinnerung: 2. Herren gegen TTC Nachbarstadt');
    expect(message.body).toBe('Hallo Anna, dein Spiel ist am Samstag um 18:00 Uhr.');
  });

  it('führt zum Link aus der Nachricht', () => {
    expect(buildPushMessage(row).data.url).toBe('https://verein.example.org/r/abc');
  });

  it('führt ohne Link zur Startseite', () => {
    const message = buildPushMessage({ ...row, payload: {} }, 'https://verein.example.org');
    expect(message.data.url).toBe('https://verein.example.org');
  });

  it('fasst Nachrichten derselben Art zusammen', () => {
    // Zwei Erinnerungen sollen sich ablösen, nicht stapeln.
    expect(buildPushMessage(row).tag).toBe('match_reminder');
  });

  it('nimmt die Kennung mit, damit sich später nachvollziehen lässt, was ankam', () => {
    expect(buildPushMessage(row).data.notificationId).toBe('n-1');
  });
});

describe('classifyPushStatus', () => {
  it('wertet 201 als zugestellt', () => {
    expect(classifyPushStatus(201)).toEqual({ gone: false, delivered: true, retry: false });
  });

  it('löscht den Endpunkt bei 404 und 410', () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
    expect(isGoneStatus(400)).toBe(false);

    expect(classifyPushStatus(410).gone).toBe(true);
  });

  it('versucht es bei 429 und 5xx erneut', () => {
    expect(classifyPushStatus(429).retry).toBe(true);
    expect(classifyPushStatus(503).retry).toBe(true);
  });

  it('gibt bei 400 auf — daran ändert ein zweiter Versuch nichts', () => {
    expect(classifyPushStatus(400)).toEqual({ gone: false, delivered: false, retry: false });
  });
});

describe('summarizePush', () => {
  it('gilt als zugestellt, sobald ein Gerät sie hat', () => {
    // Handy an, Tablet seit Wochen aus: Die Nachricht ist angekommen.
    const result = summarizePush([
      { gone: true, delivered: false, retry: false },
      { gone: false, delivered: true, retry: false },
    ]);
    expect(result).toEqual({ delivered: true, retry: false });
  });

  it('versucht es erneut, wenn ein Gerät nur vorübergehend nicht erreichbar war', () => {
    expect(
      summarizePush([
        { gone: false, delivered: false, retry: true },
        { gone: true, delivered: false, retry: false },
      ]),
    ).toEqual({ delivered: false, retry: true });
  });

  it('gibt auf, wenn alle Geräte abgemeldet sind', () => {
    expect(summarizePush([{ gone: true, delivered: false, retry: false }])).toEqual({
      delivered: false,
      retry: false,
    });
  });
});
