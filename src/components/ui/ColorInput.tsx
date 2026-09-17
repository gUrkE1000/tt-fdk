import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ColorInputProps {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Mannschaftsfarben dürfen leer bleiben; dann gibt es keinen Farbstreifen. */
  clearable?: boolean;
  className?: string;
}

const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(function ColorInput(
  { id, value, onChange, clearable = true, className },
  ref,
) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        ref={ref}
        id={id}
        type="color"
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-14 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
      />
      <span className="text-sm tabular-nums text-gray-600">{value ?? 'keine Farbe'}</span>
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
          aria-label="Farbe entfernen"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

export default ColorInput;
