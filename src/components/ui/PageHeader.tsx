import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primäraktion rechts, z. B. „Training anlegen". */
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {/* max-w-full statt shrink-0: Passen die Knöpfe nicht in eine Zeile, brechen sie um.
          Sonst ragt die Leiste über den Rand, das Telefon verbreitert die ganze Seite — und
          jeder Dialog, der die Bildschirmbreite füllt, wird rechts abgeschnitten. */}
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
