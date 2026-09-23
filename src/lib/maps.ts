/**
 * Link zur Routenplanung für eine Adresse.
 *
 * Die Such-URL von Google Maps ist die eine Adresse, die überall funktioniert: Auf dem
 * Telefon öffnet sie die Karten-App (auch Apple Karten fragt nach), am Rechner die
 * Webseite. Einen eigenen Kartendienst einzubinden wäre ein Datenschutzthema; ein Link,
 * den man selbst antippt, ist keins.
 */
export function mapsUrl(address: string | null | undefined): string | null {
  const query = (address ?? '').replace(/\s+/g, ' ').trim();
  if (query === '') return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
