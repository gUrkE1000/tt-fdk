import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/cn';
import { inputClasses, type InputProps } from './Input';

/**
 * Passwortfeld mit Auge: Ein Tipp zeigt das Passwort im Klartext, noch einer verbirgt
 * es wieder. Auf dem Telefon vertippt man sich leicht, und ohne Auge merkt man es erst
 * an der Fehlermeldung.
 */
const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(inputClasses, 'pr-12', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex min-w-touch items-center justify-center rounded-r-xl text-gray-500 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        >
          {visible ? (
            <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
          ) : (
            <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);

export default PasswordInput;
