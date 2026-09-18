/**
 * Bereinigung von Rich-Text vor der Anzeige.
 *
 * Der Editor (tiptap) erzeugt nur Markup aus einer festen Liste. Verlassen darf man sich
 * darauf trotzdem nicht: Was in der Datenbank steht, kann auch jemand direkt über die API
 * geschrieben haben, und `dangerouslySetInnerHTML` fragt nicht nach, woher der Text kommt.
 *
 * Deshalb eine Positivliste statt eines Filters: Erlaubt ist, was hier steht — alles
 * andere fällt weg. Ein Angreifer müsste ein Tag finden, das *auf der Liste* gefährlich
 * ist; das ist eine viel kleinere Angriffsfläche als eine Liste verbotener Muster, die
 * man vollständig halten müsste.
 *
 * Bewusst ohne Abhängigkeit: Der Umfang ist klein und vollständig testbar, und eine
 * Bibliothek, die im Browser ein DOM aufbaut, wäre für diesen Zweck viel Gerät.
 */

/** Was der Editor erzeugen darf — und nur das. */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  's',
  'u',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'blockquote',
  'a',
  'code',
  'pre',
]);

/** Je Tag die erlaubten Attribute. Alles andere fällt weg, auch `style` und `on*`. */
const ALLOWED_ATTRS: Record<string, readonly string[]> = {
  a: ['href', 'title'],
};

/** Nur Ziele, die im Browser eine Seite öffnen. `javascript:` ist der ganze Grund. */
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

export function sanitizeRichText(html: string): string {
  if (!html) return '';

  let out = '';
  let index = 0;

  while (index < html.length) {
    const next = html.indexOf('<', index);

    if (next === -1) {
      out += escapeText(html.slice(index));
      break;
    }

    out += escapeText(html.slice(index, next));

    const end = html.indexOf('>', next);
    if (end === -1) {
      // Ein nicht geschlossenes `<` ist kein Tag, sondern Text.
      out += escapeText(html.slice(next));
      break;
    }

    const raw = html.slice(next + 1, end).trim();
    index = end + 1;

    // Kommentare und Verarbeitungsanweisungen verschwinden ersatzlos.
    if (raw.startsWith('!') || raw.startsWith('?')) continue;

    const closing = raw.startsWith('/');
    const body = closing ? raw.slice(1) : raw;
    const name = (body.match(/^[a-zA-Z0-9]+/)?.[0] ?? '').toLowerCase();

    if (!ALLOWED_TAGS.has(name)) continue;

    if (closing) {
      out += `</${name}>`;
      continue;
    }

    const attrs = keepAttributes(name, body.slice(name.length));
    const selfClosing = name === 'br' || body.endsWith('/');
    out += `<${name}${attrs}${selfClosing && name === 'br' ? ' /' : ''}>`;
  }

  return out;
}

function keepAttributes(tag: string, rest: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed || allowed.length === 0) return '';

  let result = '';
  const pattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rest)) !== null) {
    const attr = match[1].toLowerCase();
    if (!allowed.includes(attr)) continue;

    const value = match[3] ?? match[4] ?? '';
    if (attr === 'href' && !SAFE_LINK.test(value.trim())) continue;

    result += ` ${attr}="${escapeText(value)}"`;
  }

  // Fremde Links gehen in einen neuen Tab, ohne Zugriff auf das Fenster dahinter.
  if (tag === 'a' && result.includes('href=')) {
    result += ' target="_blank" rel="noopener noreferrer nofollow"';
  }

  return result;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Die reine Textfassung, für Vorschauen und Suchen. */
export function richTextToPlain(html: string): string {
  return sanitizeRichText(html)
    .replace(/<\/(p|li|h2|h3|blockquote)>/g, ' ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Steht überhaupt etwas drin? Ein leerer Editor liefert `<p></p>`. */
export function hasRichText(html: string): boolean {
  return richTextToPlain(html).length > 0;
}
