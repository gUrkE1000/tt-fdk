import { cn } from '../../lib/cn';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Färbt rot, solange das Ziel nicht erreicht ist — für „Aufstellung 3/4". */
  warnBelowMax?: boolean;
  label?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  max,
  warnBelowMax = false,
  label,
  className,
}: ProgressBarProps) {
  const safeMax = Math.max(max, 1);
  const ratio = Math.min(Math.max(value / safeMax, 0), 1);
  const incomplete = warnBelowMax && value < max;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? `${value} von ${max}`}
        className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className={cn('h-full rounded-full transition-all', incomplete ? 'bg-danger' : 'bg-status-yes')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span
        className={cn(
          'shrink-0 text-xs font-bold tabular-nums',
          incomplete ? 'text-danger' : 'text-gray-600',
        )}
      >
        {value}/{max}
      </span>
    </div>
  );
}
