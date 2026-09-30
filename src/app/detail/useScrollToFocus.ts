import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { detailMarker, type DetailState } from '../../lib/detailSheet';

/** Wie lange auf die Karte gewartet wird — die Liste lädt ihre Daten erst noch. */
const WAIT_MS = 10_000;

/**
 * Einträge im Verlauf, zu denen schon gescrollt wurde.
 *
 * Kommt man später auf denselben Eintrag zurück (Blatt aus der Liste geöffnet und
 * wieder geschlossen), soll die Liste dort bleiben, wo man selbst hingescrollt hat,
 * statt wieder zum Termin aus der Benachrichtigung zu springen.
 */
const handled = new Set<string>();

/**
 * Scrollt die Seite zu der Karte, die `focus` im Verlauf nennt, und hebt sie kurz hervor.
 *
 * Gesucht wird nur in `<main>`: Das Blatt zeigt dieselbe Karte, liegt aber außerhalb.
 */
export function useScrollToFocus(): void {
  const location = useLocation();
  const focus = (location.state as DetailState | null)?.focus;
  const marker = focus ? detailMarker(focus.kind, focus.id) : null;
  const key = location.key;

  useEffect(() => {
    if (!marker || handled.has(key)) return;

    const reveal = () => {
      // Vergleichen statt in den Selektor einsetzen: Die ID kommt aus der Adresse.
      const card = Array.from(document.querySelectorAll<HTMLElement>('main [data-detail]')).find(
        (element) => element.dataset.detail === marker,
      );
      if (!card) return false;
      handled.add(key);
      card.scrollIntoView?.({ block: 'center' });
      card.classList.remove('detail-focus');
      // Neu starten, falls die Hervorhebung vom letzten Mal noch läuft.
      void card.offsetWidth;
      card.classList.add('detail-focus');
      return true;
    };

    if (reveal()) return;

    const root = document.querySelector('main') ?? document.body;
    const observer = new MutationObserver(() => {
      if (reveal()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    const timer = window.setTimeout(() => observer.disconnect(), WAIT_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [marker, key]);
}
