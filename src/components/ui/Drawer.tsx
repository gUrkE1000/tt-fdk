import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: 'left' | 'right';
  children: ReactNode;
}

/**
 * Seitlich einfahrende Schicht. Technisch derselbe Radix-Dialog wie `Dialog`, nur anders
 * platziert — dadurch identisches Fokus- und Escape-Verhalten.
 */
export default function Drawer({
  open,
  onOpenChange,
  title,
  side = 'right',
  children,
}: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-gray-900/40" />
        <RadixDialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-[min(22rem,100vw)] flex-col border-gray-200 bg-white',
            side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4">
            <RadixDialog.Title className="text-base font-bold text-gray-900">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label="Schließen"
              className="flex min-h-touch min-w-touch items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
