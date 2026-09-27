import { cn } from '../../lib/cn';

export interface SegmentedProps<T extends string | boolean> {
  /** Beschriftung der Gruppe für Screenreader. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  className?: string;
}

/**
 * Umschalter aus zwei oder drei Schaltflächen, von denen genau eine gedrückt ist —
 * für Ansichten derselben Liste („Liste / Monat", „Meine Mannschaften / Ganzer Verein").
 */
export default function Segmented<T extends string | boolean>({
  label,
  value,
  onChange,
  options,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-xl bg-gray-100 p-1', className)}
    >
      {options.map(([option, text]) => (
        <button
          key={text}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            value === option
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
