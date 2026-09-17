import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Pflicht: ein Icon-Button ohne Beschriftung ist sonst für Screenreader stumm. */
  label: string;
  tone?: 'default' | 'primary' | 'danger';
}

const TONES = {
  default: 'text-gray-600 hover:bg-gray-100',
  primary: 'text-primary hover:bg-primary-soft',
  danger: 'text-danger hover:bg-status-no-soft',
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, tone = 'default', className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-40',
        TONES[tone],
        className,
      )}
      {...props}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
});

export default IconButton;
