import type { Enums } from '../../lib/database.types';
import { ROLE_LABELS } from '../../lib/labels';

/**
 * Einladungen kommen als Liste, nicht einzeln: nach der Jahreshauptversammlung sitzt
 * jemand mit einer Mitgliederliste da und will sie in einem Rutsch einladen.
 *
 * Erwartet je Zeile: Vorname Nachname E-Mail [Rolle]. Getrennt wird durch Tabulator,
 * Semikolon, Komma oder Leerzeichen — je nachdem, woraus kopiert wurde.
 */

export interface InviteEntry {
  firstName: string;
  lastName: string;
  email: string;
  role: Enums<'user_role'>;
}

export interface ParsedInvites {
  entries: InviteEntry[];
  invalid: { line: string; reason: string }[];
}

const ROLE_BY_LABEL = new Map<string, Enums<'user_role'>>(
  Object.entries(ROLE_LABELS).map(([value, label]) => [
    label.toLowerCase(),
    value as Enums<'user_role'>,
  ]),
);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInviteLines(input: string): ParsedInvites {
  const entries: InviteEntry[] = [];
  const invalid: { line: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const raw of input.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.split(/[\s;,\t]+/).filter(Boolean);
    const emailIndex = parts.findIndex((part) => EMAIL.test(part));

    if (emailIndex < 0) {
      invalid.push({ line, reason: 'keine E-Mail-Adresse gefunden' });
      continue;
    }
    if (emailIndex < 2) {
      invalid.push({ line, reason: 'Vor- und Nachname fehlen' });
      continue;
    }

    const email = parts[emailIndex].toLowerCase();
    if (seen.has(email)) {
      invalid.push({ line, reason: 'Adresse steht doppelt in der Liste' });
      continue;
    }
    seen.add(email);

    const rest = parts.slice(emailIndex + 1).join(' ').toLowerCase();
    const role = ROLE_BY_LABEL.get(rest) ?? 'member';

    entries.push({
      // Alles vor der Adresse ist der Name; der letzte Teil davon der Nachname.
      firstName: parts.slice(0, emailIndex - 1).join(' '),
      lastName: parts[emailIndex - 1],
      email,
      role,
    });
  }

  return { entries, invalid };
}
