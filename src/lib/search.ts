/**
 * Normalisierung für jede Suche in der App — das Gegenstück zu `public.search_norm` in der
 * Datenbank (Migration `search`). Beide müssen dieselbe Regel haben: Die Datenbank findet,
 * der Browser hebt hervor und filtert Listen, und „Müller" soll an beiden Stellen
 * „Mueller" treffen.
 *
 * Regel: Umlaute als ae/oe/ue, ß als ss, übrige Akzente weg, klein, alles außer
 * Buchstaben und Ziffern wird zu einem Leerzeichen.
 */

const EXPAND: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
  ß: 'ss',
  ẞ: 'ss',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
};

// Dieselben Listen wie `translate(...)` in der Migration.
const FROM =
  'ÀÁÂÃÅĀĂĄÇĆČĎÈÉÊËĒĖĘĚÌÍÎÏĪĮŁÑŃŇÒÓÔÕØŌŐŔŘŚŠŞŤÙÚÛŪŮŰŲÝŸŹŻŽàáâãåāăąçćčďèéêëēėęěìíîïīįłñńňòóôõøōőŕřśšşťùúûūůűųýÿźżž';
const TO =
  'AAAAAAAACCCDEEEEEEEEIIIIIILNNNOOOOOOORRSSSTUUUUUUUYYZZZaaaaaaaacccdeeeeeeeeiiiiiilnnnooooooorrssstuuuuuuuyyzzz';

const PLAIN = new Map<string, string>();
{
  const from = [...FROM];
  const to = [...TO];
  from.forEach((char, index) => PLAIN.set(char, to[index]));
}

/** Ein einzelnes Zeichen in seine Normalform, ohne Klein-/Satzzeichenregel. */
function foldChar(char: string): string {
  return EXPAND[char] ?? PLAIN.get(char) ?? char;
}

/** Normalform eines Textes, wie `public.search_norm`. */
export function normalizeSearch(text: string | null | undefined): string {
  let folded = '';
  for (const char of text ?? '') folded += foldChar(char);
  return folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ab zwei Buchstaben oder Ziffern wird gesucht — darunter ist jede Antwort Zufall. */
export function searchable(query: string): boolean {
  return normalizeSearch(query).replace(/ /g, '').length >= 2;
}

/** Die Suchwörter einer Eingabe, höchstens acht (wie in der Datenbank). */
export function searchTokens(query: string): string[] {
  const norm = normalizeSearch(query);
  return norm === '' ? [] : norm.split(' ').slice(0, 8);
}

/**
 * Filter für Listen auf einer Seite: Jedes Wort der Eingabe muss irgendwo in den Feldern
 * vorkommen, egal in welcher Reihenfolge. Leere Eingabe lässt alles durch.
 */
export function matchesSearch(
  fields: readonly (string | null | undefined)[],
  query: string,
): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = ` ${normalizeSearch(fields.filter(Boolean).join(' '))} `;
  return tokens.every((token) => haystack.includes(token));
}

export interface HighlightPart {
  text: string;
  hit: boolean;
}

/**
 * Zerlegt einen Anzeigetext in Stücke mit und ohne Treffer, damit die Trefferliste die
 * gefundenen Wortanfänge fett zeigen kann. Verglichen wird in der Normalform, markiert
 * im Original: „Müller" wird bei der Eingabe „muel" als „Mü" hervorgehoben.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0 || text === '') return [{ text, hit: false }];

  // Je Originalzeichen seine Normalform und die Position im normalisierten Text.
  const chars = [...text];
  let norm = '';
  const origin: number[] = [];
  chars.forEach((char, index) => {
    const folded = foldChar(char).toLowerCase().replace(/[^a-z0-9]/g, ' ');
    for (const piece of folded) {
      norm += piece;
      origin.push(index);
    }
  });

  const marked = new Array<boolean>(chars.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(token, from);
      if (at < 0) break;
      // Nur Wortanfänge: davor steht nichts oder ein Nicht-Buchstabe.
      if (at === 0 || norm[at - 1] === ' ') {
        for (let i = at; i < at + token.length; i += 1) marked[origin[i]] = true;
      }
      from = at + 1;
    }
  }

  const parts: HighlightPart[] = [];
  chars.forEach((char, index) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === marked[index]) last.text += char;
    else parts.push({ text: char, hit: marked[index] });
  });
  return parts;
}
