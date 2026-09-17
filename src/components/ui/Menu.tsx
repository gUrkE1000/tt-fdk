import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buttonClasses, type ButtonVariant } from './Button';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface MenuProps {
  /** Beschriftung des auslösenden Knopfs. */
  label: string;
  items: MenuItem[];
  variant?: ButtonVariant;
  icon?: LucideIcon;
  children?: ReactNode;
}

/**
 * Knopf mit aufklappender Liste von Aktionen. Gedacht für Fälle, in denen drei oder mehr
 * verwandte Aktionen an derselben Stelle hängen — nebeneinander gestellt würden sie auf
 * dem Smartphone die halbe Zeile fressen.
 */
export default function Menu({ label, items, variant = 'primary', icon: Icon }: MenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={cn(buttonClasses({ variant }))}>
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {label}
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-lg"
        >
          <ul role="menu">
            {items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                    'hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  {item.icon && (
                    <item.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gray-500" aria-hidden="true" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{item.label}</span>
                    {item.hint && <span className="block text-xs text-gray-500">{item.hint}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
