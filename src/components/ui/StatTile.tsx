import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
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
  className,
}: StatTileProps) {
  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white p-4', className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {label}
      </div>
      <p className={cn('mt-2 text-2xl font-black tabular-nums', TONES[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
