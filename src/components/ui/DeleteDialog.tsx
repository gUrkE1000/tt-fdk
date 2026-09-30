import { useEffect, useState, type ReactNode } from 'react';
import Button from './Button';
import Dialog from './Dialog';
import Input from './Input';

/** Stimmt die Eingabe? Groß-/Kleinschreibung und Leerzeichen am Rand zählen nicht. */
export function typedMatches(input: string, expected: string): boolean {
  return input.trim().toLocaleLowerCase('de') === expected.trim().toLocaleLowerCase('de');
}

export interface TypeToConfirmProps {
  /** Was abgetippt werden muss, z. B. der Name der Mannschaft oder „löschen". */
  expected: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter, wenn die Eingabe stimmt. */
  onSubmit?: () => void;
}

/** Das Eingabefeld „Zum Bestätigen … eingeben". */
export function TypeToConfirm({ expected, value, onChange, onSubmit }: TypeToConfirmProps) {
  return (
    <label className="mt-3 block space-y-1.5 text-sm text-gray-700">
      <span>
        Zum Bestätigen <strong className="text-gray-900">{expected}</strong> eingeben:
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && typedMatches(value, expected)) onSubmit?.();
        }}
        autoComplete="off"
        aria-label="Zur Bestätigung eingeben"
      />
    </label>
  );
}

export interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Was mit verschwindet — steht über dem Eingabefeld. */
  children?: ReactNode;
  /** Was abgetippt werden muss: der Name, sonst „löschen". */
  expected: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  loading?: boolean;
}

/**
 * Rückfrage vor einer Löschung, die sich nicht rückgängig machen lässt: Der Knopf wird
 * erst frei, wenn man den Namen (oder „löschen") abgetippt hat. So passiert es nicht
 * mit einem schnellen Doppelklick.
 */
export default function DeleteDialog({
  open,
  onOpenChange,
  title,
  children,
  expected,
  onConfirm,
  confirmLabel = 'Endgültig löschen',
  loading,
}: DeleteDialogProps) {
  const [input, setInput] = useState('');
  const ok = typedMatches(input, expected);

  // Bei jedem Öffnen leer — auch für einen anderen Eintrag.
  useEffect(() => {
    if (open) setInput('');
  }, [open, expected]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            variant="danger"
            disabled={!ok}
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      <TypeToConfirm
        expected={expected}
        value={input}
        onChange={setInput}
        onSubmit={() => void onConfirm()}
      />
    </Dialog>
  );
}
