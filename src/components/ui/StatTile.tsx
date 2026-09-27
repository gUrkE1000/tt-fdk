import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  /**
   * Macht die ganze Kachel zum Link auf die Seite, auf der die Zahl herkommt. Sie
   * bekommt dann einen Pfeil und einen Hover-Zustand — eine Kachel, die man anklicken
   * kann, muss auch danach aussehen.
   */
  to?: string;
  className?: string;
}

const TONES = {
  neutral: 'text-gray-900',
  warning: 'text-status-late',
  danger: 'text-danger',
  success: 'text-status-yes',
};

export default function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  to,
  className,
}: StatTileProps) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {label}
        {to && (
          <ChevronRight
            className="ml-auto h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        )}
      </div>
      <p className={cn('mt-2 text-2xl font-black tabular-nums', TONES[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </>
  );

  const box = 'rounded-2xl border border-gray-200 bg-white p-4';

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          box,
          'group block transition-colors hover:border-primary-border hover:bg-gray-50',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn(box, className)}>{content}</div>;
}
