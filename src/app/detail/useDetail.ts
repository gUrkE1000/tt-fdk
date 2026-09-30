import { useCallback } from 'react';
import { useLocation, useNavigate, type Location, type To } from 'react-router-dom';
import {
  detailFromPath,
  withDetail,
  type DetailKind,
  type DetailState,
} from '../../lib/detailSheet';

/**
 * Wohin ein Link auf `path` von der aktuellen Seite aus führt.
 *
 * Die Adresse einer Einzelansicht (`/match/…`) öffnet das Blatt über der aktuellen
 * Seite; jede andere Adresse bleibt, was sie ist.
 */
export function detailTarget(
  path: string,
  location: Pick<Location, 'pathname' | 'search'>,
): { to: To; state?: DetailState } {
  const detail = detailFromPath(path);
  if (!detail) return { to: path };
  return {
    to: { pathname: location.pathname, search: withDetail(location.search, detail) },
    state: { detailSheet: true },
  };
}

/**
 * Wie {@link detailTarget}, aber zum Aufrufen — für Klicks ohne Link (Kalender).
 * `replace`: aus einem Dialog heraus, dessen Eintrag im Verlauf ersetzt werden soll.
 */
export function useOpenDetail(): (path: string, options?: { replace?: boolean }) => void {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (path: string, options?: { replace?: boolean }) => {
      const { to, state } = detailTarget(path, location);
      navigate(to, { state, replace: options?.replace });
    },
    [navigate, location],
  );
}

/**
 * Die ID des Termins dieser Art, zu dem die Liste scrollen soll — oder `null`.
 *
 * Listen mit „Weitere anzeigen" brauchen sie, damit der Termin überhaupt gezeichnet
 * wird, auch wenn er nicht unter den ersten 30 steht.
 */
export function useFocusedId(kind: DetailKind): string | null {
  const location = useLocation();
  const focus = (location.state as DetailState | null)?.focus;
  return focus?.kind === kind ? focus.id : null;
}
