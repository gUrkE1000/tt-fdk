import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { parentOf, withDetail, type DetailKind, type DetailState } from '../../lib/detailSheet';

/**
 * Einstieg über eine alte Adresse (`/match/…`, `/training/…`, `/event/…`).
 *
 * Sie stehen in Push-Nachrichten, E-Mails und im Kalender-Abo. Wer so hereinkommt, war
 * vorher nirgends in der App — Zurückwischen soll trotzdem nicht aus der App werfen,
 * sondern auf die Liste führen, zu der der Termin gehört, und zwar genau zu ihm.
 *
 * Deshalb zwei Einträge im Verlauf: Die alte Adresse wird zur Liste (mit dem Termin als
 * Ziel zum Scrollen), darüber kommt die Liste mit offenem Blatt.
 */
export default function DetailEntry({ kind }: { kind: DetailKind }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // StrictMode ruft Effekte zweimal auf; zwei Umleitungen hinterließen vier Einträge.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    if (!id) {
      navigate('/', { replace: true });
      return;
    }

    const parent = parentOf(kind);
    const focus = { kind, id };
    navigate(parent, { replace: true, state: { focus } satisfies DetailState });
    navigate(
      { pathname: parent.pathname, search: withDetail(parent.search, focus) },
      { state: { detailSheet: true, focus } satisfies DetailState },
    );
  }, [id, kind, navigate]);

  return null;
}
