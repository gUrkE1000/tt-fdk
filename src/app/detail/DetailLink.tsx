import { Link, useLocation, type LinkProps } from 'react-router-dom';
import { detailTarget } from './useDetail';

export interface DetailLinkProps extends Omit<LinkProps, 'to' | 'state'> {
  /** Eine Adresse wie überall sonst; `/match/…` & Co. öffnen das Blatt. */
  to: string;
}

/**
 * Link, der eine Einzelansicht als Blatt über der aktuellen Seite öffnet.
 *
 * So bleibt die Seite darunter stehen, wo sie war, und Zurückwischen schließt nur das
 * Blatt. Andere Adressen verhalten sich wie ein gewöhnlicher Link.
 */
export default function DetailLink({ to, ...rest }: DetailLinkProps) {
  const location = useLocation();
  const target = detailTarget(to, location);
  return <Link to={target.to} state={target.state} {...rest} />;
}
