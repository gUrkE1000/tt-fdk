import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { inputClasses } from './Input';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Zweite Zeile, z. B. Mannschaft oder QTTR bei Personen. */
  sublabel?: string;
}

export interface MultiSelectProps {
  id?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Ab dieser Zahl wird ein Suchfeld eingeblendet. */
  searchThreshold?: number;
  /** Mehr als so viele Auswahlen sind nicht erlaubt (z. B. „Maximal 4 Stammspieler"). */
  max?: number;
  disabled?: boolean;
  className?: string;
}

export default function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Bitte auswählen',
  searchThreshold = 8,
  max,
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.sublabel?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const atLimit = typeof max === 'number' && value.length >= max;

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else if (!atLimit) {
      onChange([...value, optionValue]);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(inputClasses, 'flex items-center justify-between gap-2 text-left', className)}
        >
          <span className={cn('truncate', selected.length === 0 && 'text-gray-400')}>
            {selected.length === 0
              ? placeholder
              : selected.length <= 2
                ? selected.map((s) => s.label).join(', ')
                : `${selected.length} ausgewählt`}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-72 w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {options.length >= searchThreshold && (
            <div className="border-b border-gray-100 p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suchen …"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          )}

          <ul className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-gray-500">Nichts gefunden</li>
            )}
            {filtered.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => toggle(option.value)}
                    disabled={!isSelected && atLimit}
                    className={cn(
                      'flex min-h-touch w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm',
                      'hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40',
                      isSelected && 'bg-primary-soft',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-primary bg-primary' : 'border-gray-300',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-gray-800">{option.label}</span>
                      {option.sublabel && (
                        <span className="block truncate text-xs text-gray-500">{option.sublabel}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {atLimit && (
            <p className="border-t border-gray-100 px-3 py-2 text-xs text-status-late">
              Maximal {max} auswählbar
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>

      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-xs text-gray-700"
            >
              {option.label}
              <button
                type="button"
                onClick={() => toggle(option.value)}
                aria-label={`${option.label} entfernen`}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-200"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Popover.Root>
  );
}
