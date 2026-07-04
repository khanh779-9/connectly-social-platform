import { forwardRef, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  toggleIcon?: boolean;
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ toggleIcon = true, className, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="password"
      toggleIcon={toggleIcon}
      autoComplete={props.autoComplete ?? 'current-password'}
      className={className}
    />
  ),
);
PasswordField.displayName = 'PasswordField';

export { PasswordField };
