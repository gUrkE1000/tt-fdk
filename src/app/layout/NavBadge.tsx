import { cn } from '../../lib/cn';

/**
 * Kleine Zahl an einem Menüpunkt. Ohne Zahl (oder bei null) erscheint nichts — ein
 * leerer Kreis würde nach Arbeit aussehen, wo keine ist.
 */
export default function NavBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;

  return (
    <span
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-status-no px-1.5 text-[11px] font-bold leading-5 text-white tabular-nums',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
      <span className="sr-only"> offen</span>
    </span>
  );
}
