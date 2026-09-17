import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover border-primary',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent',
  danger: 'bg-danger text-white hover:brightness-95 border-danger',
};

const SIZES: Record<ButtonSize, string> = {
  // min-h-touch überall: auch der kleine Button bleibt auf dem Smartphone treffsicher.
  sm: 'min-h-touch px-3 py-1.5 text-xs gap-1.5',
  md: 'min-h-touch px-4 py-2 text-sm gap-2',
  lg: 'min-h-[48px] px-5 py-2.5 text-base gap-2',
};

/**
 * Die Klassen eines Buttons ohne das <button> selbst — für Fälle, in denen ein anderes
 * Element wie ein Button aussehen muss (etwa der Auslöser eines Radix-Menüs, der sein
 * eigenes Element mitbringt).
 */
export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  block,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}): string {
  return cn(
    'inline-flex items-center justify-center rounded-xl border font-semibold transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Über die volle Breite, typisch für Rückmelde-Buttons auf dem Smartphone. */
  block?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, block, className, children, disabled, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
