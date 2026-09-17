import { useId } from 'react';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export default function Checkbox({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
  className,
  id,
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <RadixCheckbox.Root
        id={inputId}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixCheckbox.Indicator>
          <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <label htmlFor={inputId} className="cursor-pointer select-none text-sm text-gray-700">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      </label>
    </div>
  );
}
