import { createLucideIcon } from 'lucide-react';

/**
 * Siegerpodest — für „Meine Spiele". Die Bibliothek hat in dieser Version keins; als
 * Lucide-Symbol gebaut, damit Größe, Strichstärke und Farbe zu den anderen passen.
 */
const Podium = createLucideIcon('Podium', [
  ['path', { d: 'M2 21h20', key: 'boden' }],
  // Platz 1 in der Mitte, am höchsten
  ['path', { d: 'M8 21V9h8v12', key: 'erster' }],
  ['path', { d: 'M12 12v5', key: 'eins' }],
  // Platz 2 links, Platz 3 rechts
  ['path', { d: 'M2 21v-7h6', key: 'zweiter' }],
  ['path', { d: 'M16 16h6v5', key: 'dritter' }],
]);

export default Podium;
