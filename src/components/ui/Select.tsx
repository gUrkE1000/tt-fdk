import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { inputClasses } from './Input';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  /** Erster, nicht wählbarer Eintrag, z. B. „Bitte auswählen". */
  placeholder?: string;
}

/**
 * Einfachauswahl über das native <select>. Auf dem Smartphone öffnet das den
 * System-Picker — bedienbarer als jede nachgebaute Liste.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(inputClasses, 'pr-8', className)} {...props}>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

export default Select;
