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
      {/*
        `max-w-full`: Ohne Obergrenze ist der Bereich so breit wie alle Buttons zusammen und
        läuft am Telefon über den Rand, statt umzubrechen. Unterhalb von `sm` füllen die
        Buttons die Zeile, zwei nebeneinander oder untereinander, wie es passt.
      */}
      {actions && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:grow">
          {actions}
        </div>
      )}
    </div>
  );
}
