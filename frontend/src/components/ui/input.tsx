import { forwardRef, type InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  toggleIcon?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', autoComplete = 'off', toggleIcon = false, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const isPassword = type === 'password';
    const showToggle = isPassword && toggleIcon;

    const input = (
      <input
        ref={ref}
        type={isPassword && visible ? 'text' : type}
        autoComplete={autoComplete}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
          showToggle && 'pr-10',
        )}
        {...props}
      />
    );

    if (!showToggle) return input;

    return (
      <div className="relative w-full">
        {input}
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-0.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded bg-transparent text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
Input.displayName = 'Input';
export { Input };
