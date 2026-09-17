import { Search, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import Input from './Input';
import Button from './Button';

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Weitere Filter: Auswahlfelder, Zeitraum, Chips. */
  children?: ReactNode;
  onReset?: () => void;
  /** Blendet „Zurücksetzen" aus, solange nichts gefiltert ist. */
  resetDisabled?: boolean;
  className?: string;
}

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Suchen …',
  children,
  onReset,
  resetDisabled,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {onSearchChange && (
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Suchen"
            className="pl-9"
          />
        </div>
      )}

      {children}

      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} disabled={resetDisabled}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Zurücksetzen
        </Button>
      )}
    </div>
  );
}
