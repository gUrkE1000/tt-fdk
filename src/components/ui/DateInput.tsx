import { forwardRef } from 'react';
import Input, { type InputProps } from './Input';

/**
 * Datumsfeld. Bewusst der native Browser-Picker: er ist auf dem Smartphone deutlich besser
 * bedienbar als jede nachgebaute Variante und lokalisiert sich selbst.
 */
const DateInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function DateInput(
  props,
  ref,
) {
  return <Input ref={ref} type="date" {...props} />;
});

export default DateInput;
