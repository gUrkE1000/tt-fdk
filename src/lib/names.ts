/**
 * Namensdarstellung. Übernommen aus dem Basisprojekt (src/lib/nameUtils.ts).
 */

/** „Max Mustermann" → „Max M" — datenschutzfreundliche Kurzform für Listen. */
export function getShortName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;

  const firstNames = parts.slice(0, -1).join(' ');
  const initial = parts[parts.length - 1][0]?.toUpperCase() ?? '';
  return initial ? `${firstNames} ${initial}` : name;
}

/** Nur der Vorname — für WhatsApp-Nachrichten, wo der Nachname stört. */
export function getFirstName(fullName: string): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

/**
 * Erkennt, ob ein gekürzter Name („Max M") denselben Menschen meint wie ein voller Name
 * („Max Mustermann"). Wird beim Abgleich importierter Kaderlisten gebraucht.
 */
export function isNameMatch(existingName: string, scrapedName: string): boolean {
  const existing = existingName.trim().toLowerCase().replace(/\.$/, '');
  const scraped = scrapedName.trim().toLowerCase();
  if (existing === scraped) return true;

  const existingParts = existing.split(/\s+/);
  const scrapedParts = scraped.split(/\s+/);
  if (existingParts.length === 0 || scrapedParts.length === 0) return false;

  const lastExisting = existingParts[existingParts.length - 1];
  if (lastExisting.length !== 1) return false;

  const prefixExisting = existingParts.slice(0, -1).join(' ');
  const prefixScraped = scrapedParts.slice(0, existingParts.length - 1).join(' ');
  const correspondingPart = scrapedParts[existingParts.length - 1] ?? '';

  return prefixExisting === prefixScraped && correspondingPart.startsWith(lastExisting);
}
