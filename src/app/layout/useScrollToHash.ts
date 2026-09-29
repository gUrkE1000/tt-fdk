import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** So lange wird nach dem Ziel gesucht: Listen laden erst nach dem Seitenwechsel. */
const WAIT_MS = 4000;
const STEP_MS = 100;

/**
 * Springt zu `#id` in der Adresse, sobald das Element da ist, und hebt es kurz hervor.
 *
 * Der Browser tut das nur beim ersten Laden und nur, wenn das Element schon im HTML steht.
 * Hier kommen die Karten erst nach der Abfrage — ein Link aus der Suche auf eine Umfrage
 * (`/votes#poll-…`) landete sonst oben auf der Seite.
 */
export function useScrollToHash() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash || hash.length < 2) return;
    const id = decodeURIComponent(hash.slice(1));
    let waited = 0;

    const timer = setInterval(() => {
      const element = document.getElementById(id);
      waited += STEP_MS;
      if (element) {
        clearInterval(timer);
        element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary');
        setTimeout(() => element.classList.remove('ring-2', 'ring-primary'), 2500);
      } else if (waited >= WAIT_MS) {
        clearInterval(timer);
      }
    }, STEP_MS);

    return () => clearInterval(timer);
  }, [hash, pathname]);
}
