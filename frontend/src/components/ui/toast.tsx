import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface ToastProps {
  /** Unique identifier for the toast */
  id: string;
  /** Toast message */
  message: string;
  /** Toast variant for styling */
  variant?: ToastVariant;
  /** Time in ms before auto-dismiss (0 to disable) */
  duration?: number;
  /** Called when the toast is dismissed */
  onClose: (id: string) => void;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * A single toast notification with auto-dismiss and keyboard support.
 * Uses aria-live="polite" for screen reader announcements.
 */
export function Toast({
  id,
  message,
  variant = 'default',
  duration = 5000,
  onClose,
  action,
}: ToastProps) {
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  const variantClasses: Record<ToastVariant, string> = {
    default: 'border-border bg-card text-foreground',
    success: 'border-success-soft/30 bg-success-soft/10 text-success-foreground',
    warning: 'border-warning-soft/30 bg-warning-soft/10 text-warning-foreground',
    danger: 'border-destructive-soft/30 bg-destructive-soft/10 text-destructive',
    info: 'border-info-soft/30 bg-info-soft/10 text-info-foreground',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'flex items-start gap-3 rounded border p-4 shadow-lg',
        variantClasses[variant]
      )}
    >
      <div className="flex-1 min-w-0 text-sm">{message}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex-shrink-0 px-3 py-1 text-xs font-medium rounded hover:bg-black/5 hover:text-foreground transition-colors"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onClose(id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 ml-2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground hover:bg-black/5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export interface ToastContainerProps {
  /** Maximum number of toasts to show at once */
  maxToasts?: number;
  /** Position of the toast container */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

type ToastPosition = NonNullable<ToastContainerProps['position']>;

const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

/**
 * Toast container that manages multiple toasts.
 * Place this once in your app layout (e.g., in App.tsx).
 */
export function ToastContainer({ maxToasts = 5, position = 'top-right' }: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = (toast: Omit<ToastProps, 'id' | 'onClose'> & { id?: string }) => {
    const id = toast.id ?? crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-(maxToasts - 1)), { ...toast, id, onClose: removeToast }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Expose the toast API globally
  useEffect(() => {
    (window as Window & { __toast?: { add: typeof addToast } }).__toast = { add: addToast };
    return () => {
      delete (window as Window & { __toast?: { add: typeof addToast } }).__toast;
    };
  }, [addToast]);

  return (
    <div
      className={cn(
        'fixed z-[600] flex flex-col gap-2 pointer-events-none',
        positionClasses[position ?? 'top-right']
      )}
      aria-live="polite"
      aria-atomic="true"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}

// Helper functions for easy toast usage
type ToastAdder = (toast: Omit<ToastProps, 'id' | 'onClose'> & { id?: string }) => string;

export const toast = {
  /** Show a success toast */
  success: (message: string, options?: Partial<Omit<ToastProps, 'id' | 'onClose' | 'message' | 'variant'>>) =>
    (window as Window & { __toast?: { add: ToastAdder } }).__toast?.add({
      message,
      variant: 'success',
      ...options,
    }),

  /** Show an error toast */
  error: (message: string, options?: Partial<Omit<ToastProps, 'id' | 'onClose' | 'message' | 'variant'>>) =>
    (window as Window & { __toast?: { add: ToastAdder } }).__toast?.add({
      message,
      variant: 'danger',
      ...options,
    }),

  /** Show a warning toast */
  warning: (message: string, options?: Partial<Omit<ToastProps, 'id' | 'onClose' | 'message' | 'variant'>>) =>
    (window as Window & { __toast?: { add: ToastAdder } }).__toast?.add({
      message,
      variant: 'warning',
      ...options,
    }),

  /** Show an info toast */
  info: (message: string, options?: Partial<Omit<ToastProps, 'id' | 'onClose' | 'message' | 'variant'>>) =>
    (window as Window & { __toast?: { add: ToastAdder } }).__toast?.add({
      message,
      variant: 'info',
      ...options,
    }),

  /** Show a default toast */
  default: (message: string, options?: Partial<Omit<ToastProps, 'id' | 'onClose' | 'message' | 'variant'>>) =>
    (window as Window & { __toast?: { add: ToastAdder } }).__toast?.add({
      message,
      variant: 'default',
      ...options,
    }),
};

export default Toast;