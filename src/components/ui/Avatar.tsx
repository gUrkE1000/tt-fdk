import { cn } from '../../lib/cn';

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Initialen aus „Max Mustermann" → „MM", aus „Max" → „MA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      title={name}
      aria-label={name}
      role="img"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary-soft font-bold text-primary',
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
