import { useEffect, useState } from 'react';

/** Ab hier gilt ein Bildschirm als schmal — dieselbe Grenze wie Tailwinds `sm`. */
export const COMPACT_MAX_WIDTH = 639;

const QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px)`;

/**
 * Ob der Bildschirm schmal ist.
 *
 * Für die Fälle, in denen CSS nicht reicht, weil eine Komponente selbst etwas anderes
 * tun muss statt nur anders auszusehen — der Kalender etwa braucht am Telefon eine
 * andere Ansicht und weniger Schaltflächen, und das ist keine Frage von Rändern.
 *
 * `matchMedia` fehlt in manchen Testumgebungen; dann gilt „nicht schmal", weil das der
 * Zustand ist, in dem nichts weggelassen wird.
 */
export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;

    const media = window.matchMedia(QUERY);
    const update = () => setCompact(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
}
