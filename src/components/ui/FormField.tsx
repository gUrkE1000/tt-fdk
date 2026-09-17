import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface FormFieldProps {
  label: string;
  /** Erwartet ein Eingabeelement; bekommt id, aria-describedby und aria-invalid gesetzt. */
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * Beschriftung, Hilfetext und Fehlermeldung für genau ein Eingabefeld. Die Verdrahtung
 * der IDs passiert hier, damit sie nicht in jedem Formular wiederholt werden muss.
 */
export default function FormField({
  label,
  children,
  hint,
  error,
  required,
  className,
}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
