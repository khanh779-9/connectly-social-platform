import { forwardRef, type InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  type?: 'checkbox' | 'radio';
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, type = 'checkbox', checked, onChange, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      checked={checked}
      onChange={onChange}
      className={`h-4 w-4 shrink-0 appearance-none rounded border border-border bg-card checked:border-accent checked:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`.trim()}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';
export { Checkbox };
