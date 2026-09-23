import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import Button from './Button';
import Dialog from './Dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Beschriftung des bestätigenden Knopfs, z. B. „Löschen". */
  confirmLabel?: string;
  /** Rot statt blau — für alles, was sich nicht rückgängig machen lässt. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Rückfragen im Stil der App statt `window.confirm`.
 *
 * Das Browser-Fenster sah auf jedem Gerät anders aus, auf dem Handy wie eine Meldung
 * der Website und nicht der App, und es ließ sich nicht beschriften („OK" statt
 * „Löschen"). Der Dialog ist derselbe wie überall sonst.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    // Eine noch offene Rückfrage gilt als abgebrochen.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options !== null}
        onOpenChange={(open) => !open && close(false)}
        title={options?.title ?? ''}
        footer={
          <>
            <Button onClick={() => close(false)}>Abbrechen</Button>
            <Button variant={options?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {options?.confirmLabel ?? 'OK'}
            </Button>
          </>
        }
      >
        {options?.description && <p className="text-sm text-gray-600">{options.description}</p>}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * `const confirm = useConfirm(); if (!(await confirm({ … }))) return;`
 *
 * Ohne Provider (in einzelnen Komponententests) fällt es auf `window.confirm` zurück,
 * damit eine Komponente nie an einer fehlenden Rückfrage scheitert.
 */
export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  return ctx ?? ((options) => Promise.resolve(window.confirm(options.title)));
}
