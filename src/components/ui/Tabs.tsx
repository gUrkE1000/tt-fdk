import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabDefinition {
  value: string;
  label: string;
  /** Zähler hinter der Beschriftung, z. B. „Offene Termine (16)". */
  count?: number;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabDefinition[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export default function Tabs({ tabs, value, defaultValue, onValueChange, className }: TabsProps) {
  // Entweder kontrolliert (value) oder unkontrolliert (defaultValue) — beides zugleich
  // bringt Radix durcheinander und der Tab-Wechsel bleibt wirkungslos.
  const modeProps =
    value !== undefined ? { value } : { defaultValue: defaultValue ?? tabs[0]?.value };

  return (
    <RadixTabs.Root
      {...modeProps}
      onValueChange={onValueChange}
      className={cn('w-full', className)}
    >
      <RadixTabs.List className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'min-h-touch shrink-0 border-b-2 border-transparent px-3 pb-2.5 pt-2 text-sm font-semibold text-gray-500 transition-colors',
              'hover:text-gray-800',
              'data-[state=active]:border-primary data-[state=active]:text-primary',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className="ml-1.5 tabular-nums text-gray-400">({tab.count})</span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {tabs.map((tab) => (
        <RadixTabs.Content
          key={tab.value}
          value={tab.value}
          className="focus-visible:outline-none"
        >
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
