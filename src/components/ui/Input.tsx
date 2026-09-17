import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const inputClasses = cn(
  'block w-full min-h-touch rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/30',
);

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClasses, className)} {...props} />;
});

export default Input;
