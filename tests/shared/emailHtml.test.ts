import { describe, it, expect } from 'vitest';
import {
  buildEmailHtml,
  escapeHtml,
  linkify,
} from '../../supabase/functions/_shared/emailHtml';

describe('escapeHtml', () => {
  it('entschärft Zeichen, die sonst Markup wären', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('lässt harmlosen Text in Ruhe', () => {
    expect(escapeHtml('Hallo Anna, bis Samstag!')).toBe('Hallo Anna, bis Samstag!');
  });
});

describe('linkify', () => {
  it('macht eine Adresse klickbar', () => {
    expect(linkify('Antworten: https://verein.example.org/r/abc')).toContain(
      '<a href="https://verein.example.org/r/abc"',
    );
  });

  it('lässt Text ohne Adresse unverändert', () => {
    expect(linkify('Kein Link hier')).toBe('Kein Link hier');
  });
});

describe('buildEmailHtml', () => {
  const input = {
    subject: 'Neuer Spieltermin',
    bodyText: 'Hallo Anna,\n\nes gibt einen neuen Spieltermin.\nBitte melde dich zurück.',
    clubName: 'TTC Musterstadt',
    settingsUrl: 'https://verein.example.org/profile',
  };

  it('nennt Verein und Betreff', () => {
    const html = buildEmailHtml(input);
    expect(html).toContain('TTC Musterstadt');
    expect(html).toContain('Neuer Spieltermin');
  });

  it('macht aus Leerzeilen Absätze und aus Zeilenumbrüchen Umbrüche', () => {
    const html = buildEmailHtml(input);
    expect(html.match(/<p style="margin:0 0 14px 0">/g)).toHaveLength(2);
    expect(html).toContain('Bitte melde dich zurück.');
    expect(html).toContain('<br>');
  });

  it('verweist auf die Einstellungen', () => {
    expect(buildEmailHtml(input)).toContain('https://verein.example.org/profile');
  });

  it('lässt die Fußzeile weg, wenn es keine Adresse gibt', () => {
    const html = buildEmailHtml({ ...input, settingsUrl: undefined });
    expect(html).not.toContain('Mein Profil');
  });

  it('schleust kein fremdes Markup durch', () => {
    const html = buildEmailHtml({
      ...input,
      bodyText: 'Hallo <img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
