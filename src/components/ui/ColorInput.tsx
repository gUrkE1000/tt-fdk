import { forwardRef, useRef } from 'react';
import { Ban, Check, Palette } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ColorInputProps {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Mannschaftsfarben dürfen leer bleiben; dann gibt es keinen Farbstreifen. */
  clearable?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

/**
 * Die Auswahl: kräftige Töne, die sich alle deutlich vom weißen Hintergrund abheben
 * (Kontrast mindestens 4,5 : 1) und untereinander gut zu unterscheiden sind. Kein Gelb
 * und kein Hellblau — die verschwinden auf Weiß.
 */
export const TEAM_COLORS: readonly { value: string; label: string }[] = [
  { value: '#dc2626', label: 'Rot' },
  { value: '#e11d48', label: 'Himbeere' },
  { value: '#db2777', label: 'Pink' },
  { value: '#9333ea', label: 'Lila' },
  { value: '#4f46e5', label: 'Indigo' },
  { value: '#2563eb', label: 'Blau' },
  { value: '#0369a1', label: 'Stahlblau' },
  { value: '#0e7490', label: 'Petrol' },
  { value: '#0f766e', label: 'Türkis' },
  { value: '#15803d', label: 'Grün' },
  { value: '#4d7c0f', label: 'Olivgrün' },
  { value: '#a16207', label: 'Senf' },
  { value: '#c2410c', label: 'Orange' },
  { value: '#92400e', label: 'Braun' },
  { value: '#475569', label: 'Schiefer' },
  { value: '#111827', label: 'Schwarz' },
];

const same = (a: string | null, b: string) => (a ?? '').toLowerCase() === b.toLowerCase();

/**
 * Farbauswahl als Farbfelder statt des Systemdialogs — der sieht auf jedem Telefon
 * anders und meist unbrauchbar aus. Wer eine ganz bestimmte Farbe braucht, kommt über
 * „Eigene Farbe" doch an den Systemdialog.
 */
const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(function ColorInput(
  { id, value, onChange, clearable = true, className, 'aria-describedby': describedBy },
  ref,
) {
  const custom = useRef<HTMLInputElement | null>(null);
  const isCustom = value !== null && value !== '' && !TEAM_COLORS.some((c) => same(value, c.value));

  return (
    <div className={cn('space-y-2', className)}>
      <div
        id={id}
        role="radiogroup"
        aria-label="Farbe"
        aria-describedby={describedBy}
        className="grid grid-cols-8 gap-2"
      >
        {TEAM_COLORS.map((color) => {
          const selected = same(value, color.value);
          return (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color.label}
              title={color.label}
              onClick={() => onChange(color.value)}
              className={cn(
                'flex aspect-square w-full min-w-0 items-center justify-center rounded-full transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                selected ? 'ring-2 ring-gray-900 ring-offset-2' : 'hover:scale-110',
              )}
              style={{ backgroundColor: color.value }}
            >
              {selected && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {clearable && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-pressed={!value}
            className={cn(
              'inline-flex min-h-touch items-center gap-1.5 rounded-xl border px-3 text-sm',
              !value
                ? 'border-gray-900 font-semibold text-gray-900'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Keine Farbe
          </button>
        )}
        <button
          type="button"
          onClick={() => custom.current?.click()}
          aria-pressed={isCustom}
          className={cn(
            'inline-flex min-h-touch items-center gap-1.5 rounded-xl border px-3 text-sm',
            isCustom
              ? 'border-gray-900 font-semibold text-gray-900'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50',
          )}
        >
          {isCustom ? (
            <span
              className="h-4 w-4 rounded-full border border-black/10"
              style={{ backgroundColor: value ?? undefined }}
              aria-hidden="true"
            />
          ) : (
            <Palette className="h-4 w-4" aria-hidden="true" />
          )}
          Eigene Farbe
        </button>
        <input
          ref={(node) => {
            custom.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          value={isCustom && value ? value : '#2563eb'}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
        />
      </div>
    </div>
  );
});

export default ColorInput;
