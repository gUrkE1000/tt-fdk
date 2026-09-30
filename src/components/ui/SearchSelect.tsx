import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { matchesSearch } from '../../lib/search';
import { inputClasses } from './Input';
import type { SelectOption } from './Select';

export interface SearchSelectProps {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Einfachauswahl mit Suchfeld — für lange Listen wie alle Mitglieder, in denen das
 * native <select> zum Scrollen zwingt. Ein Klick wählt und schließt die Liste.
 */
export default function SearchSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Bitte auswählen',
  disabled,
  className,
  'aria-label': ariaLabel,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(
    () => options.filter((option) => matchesSearch([option.label], query)),
    [options, query],
  );

  function pick(optionValue: string) {
    setOpen(false);
    setQuery('');
    if (optionValue !== value) onChange(optionValue);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(inputClasses, 'flex items-center justify-between gap-2 text-left', className)}
        >
          <span className={cn('truncate', !selected && 'text-gray-400')}>
            {selected?.label ?? placeholder}
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
          <div className="border-b border-gray-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen …"
              aria-label="Suchen"
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-gray-500">Nichts gefunden</li>
            )}
            {filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => pick(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      'flex min-h-touch w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm',
                      'hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40',
                      isSelected && 'bg-primary-soft',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-gray-800">{option.label}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
