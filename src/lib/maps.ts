/**
 * Link zur Routenplanung für eine Adresse.
 *
 * Die Routen-URL von Google Maps (`/maps/dir/`) ist die eine Adresse, die überall
 * funktioniert: Auf dem Telefon öffnet sie die Karten-App mit dem Ziel schon
 * eingetragen, am Rechner die Webseite. Die Such-URL (`/maps/search/`) war dafür
 * ungeeignet — sie zeigt Suchtreffer statt das Ziel zu übernehmen. Einen eigenen
 * Kartendienst einzubinden wäre ein Datenschutzthema; ein Link, den man selbst antippt,
 * ist keins.
 */
export function mapsUrl(address: string | null | undefined): string | null {
  const destination = (address ?? '').replace(/\s+/g, ' ').trim();
  if (destination === '') return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * Das Ziel für einen Ort: die genaue Anschrift (Straße, PLZ Ort). Nur ohne Straße kommt
 * der Name dazu — sonst fände Google zu „12345 Musterstadt" bloß die Ortsmitte.
 */
export function venueDestination(venue: {
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
}): string {
  const place = [venue.postal_code, venue.city].filter(Boolean).join(' ').trim();
  const street = venue.address?.trim() ?? '';
  return (street ? [street, place] : [venue.name, place]).filter(Boolean).join(', ');
}
