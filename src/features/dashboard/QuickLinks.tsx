import { ExternalLink, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Quicklink } from './summary';

export interface QuickLinksProps {
  links: Quicklink[];
  /** Nur der Administrator bekommt den Hinweis, wo die Links gepflegt werden. */
  canEdit?: boolean;
}

/**
 * Quicklinks der Übersicht.
 *
 * Adressen außerhalb der Anwendung — Tabelle und Spielplan bei myTischtennis, TTR-Rechner,
 * Vereinsrangliste. Sie stehen in den Vereinseinstellungen, nicht im Code: jeder Verein
 * hat andere, und ein fest verdrahteter Link zeigt spätestens beim zweiten Verein daneben.
 */
export default function QuickLinks({ links, canEdit = false }: QuickLinksProps) {
  if (links.length === 0) {
    if (!canEdit) return null;

    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Quicklinks
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Noch keine Links hinterlegt. Unter{' '}
          <Link to="/club" className="font-semibold text-primary underline-offset-2 hover:underline">
            Verein → Betrieb
          </Link>{' '}
          lassen sich Tabelle, TTR-Rechner und Vereinsrangliste eintragen.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Link2 className="h-4 w-4" aria-hidden="true" />
        Quicklinks
      </div>

      <ul className="mt-2 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={`${link.label}:${link.url}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-touch items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {link.label}
              <ExternalLink className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
