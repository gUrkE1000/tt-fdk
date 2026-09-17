import { forwardRef } from 'react';
import Input, { type InputProps } from './Input';

const TimeInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function TimeInput(
  props,
  ref,
) {
  return <Input ref={ref} type="time" {...props} />;
});

export default TimeInput;
