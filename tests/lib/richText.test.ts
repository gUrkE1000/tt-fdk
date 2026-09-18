import { describe, it, expect } from 'vitest';
import { hasRichText, richTextToPlain, sanitizeRichText } from '../../src/lib/richText';

describe('sanitizeRichText', () => {
  it('lässt durch, was der Editor erzeugt', () => {
    const html = '<p>Hallo <strong>Welt</strong> und <em>Gruß</em></p><ul><li>eins</li></ul>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('wirft ein Skript-Tag weg', () => {
    expect(sanitizeRichText('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>alert(1)');
  });

  it('wirft Ereignis-Attribute weg', () => {
    expect(sanitizeRichText('<p onclick="alert(1)">Text</p>')).toBe('<p>Text</p>');
  });

  it('wirft style weg', () => {
    expect(sanitizeRichText('<p style="position:fixed">Text</p>')).toBe('<p>Text</p>');
  });

  it('wirft unbekannte Tags weg, behält aber den Text', () => {
    expect(sanitizeRichText('<div><p>Text</p></div>')).toBe('<p>Text</p>');
    expect(sanitizeRichText('<iframe src="https://example.com"></iframe>')).toBe('');
  });

  it('behält erlaubte Links und härtet sie ab', () => {
    const out = sanitizeRichText('<a href="https://example.com">Link</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it('wirft ein javascript:-Ziel weg', () => {
    // Das ist der eigentliche Grund für die Positivliste.
    expect(sanitizeRichText('<a href="javascript:alert(1)">Klick</a>')).toBe('<a>Klick</a>');
  });

  it('erlaubt mailto und tel', () => {
    expect(sanitizeRichText('<a href="mailto:a@b.de">Mail</a>')).toContain('mailto:a@b.de');
    expect(sanitizeRichText('<a href="tel:+491234">Anruf</a>')).toContain('tel:+491234');
  });

  it('maskiert Text, der wie Markup aussieht', () => {
    expect(sanitizeRichText('<p>3 &lt; 5</p>')).toBe('<p>3 &amp;lt; 5</p>');
    expect(sanitizeRichText('a < b')).toBe('a &lt; b');
  });

  it('wirft Kommentare weg', () => {
    expect(sanitizeRichText('<p>a</p><!-- versteckt -->')).toBe('<p>a</p>');
  });

  it('kommt mit einem nicht geschlossenen Tag zurecht', () => {
    expect(sanitizeRichText('<p>Text')).toBe('<p>Text');
    expect(sanitizeRichText('Text <')).toBe('Text &lt;');
  });

  it('kommt mit leerer Eingabe zurecht', () => {
    expect(sanitizeRichText('')).toBe('');
  });
});

describe('richTextToPlain', () => {
  it('macht aus Markup lesbaren Text', () => {
    expect(richTextToPlain('<p>Hallo <strong>Welt</strong></p><p>Zweiter Absatz</p>')).toBe(
      'Hallo Welt Zweiter Absatz',
    );
  });

  it('macht aus einer Liste eine Zeile', () => {
    expect(richTextToPlain('<ul><li>eins</li><li>zwei</li></ul>')).toBe('eins zwei');
  });
});

describe('hasRichText', () => {
  it('erkennt einen leeren Editor', () => {
    expect(hasRichText('')).toBe(false);
    expect(hasRichText('<p></p>')).toBe(false);
    expect(hasRichText('<p>   </p>')).toBe(false);
  });

  it('erkennt Inhalt', () => {
    expect(hasRichText('<p>etwas</p>')).toBe(true);
  });
});
