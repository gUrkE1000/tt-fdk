import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'yes'
  | 'late'
  | 'unclear'
  | 'no'
  | 'open'
  | 'absent'
  | 'removed'
  | 'warning'
  | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-soft text-primary',
  yes: 'bg-status-yes-soft text-status-yes',
  late: 'bg-status-late-soft text-status-late',
  unclear: 'bg-status-unclear-soft text-status-unclear',
  no: 'bg-status-no-soft text-status-no',
  open: 'bg-status-open-soft text-gray-600',
  absent: 'bg-status-absent-soft text-status-absent',
  removed: 'bg-gray-100 text-status-removed line-through',
  warning: 'bg-status-late-soft text-status-late',
  info: 'bg-sky-50 text-info',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export default function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
