import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled]):not([aria-hidden="true"])',
  'textarea:not([disabled]):not([aria-hidden="true"])',
  'input:not([disabled]):not([aria-hidden="true"])',
  'select:not([disabled]):not([aria-hidden="true"])',
  '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])',
  '[contenteditable="true"]:not([aria-hidden="true"])',
].join(',');

/**
 * Keeps the keyboard focus inside a dialog while it is open and gives the
 * focus back to the button that opened it when it closes.
 */
export function useFocusTrap(
  enabled = true,
  options: {
    /** The element to focus when the dialog opens. Defaults to the first focusable child. */
    initialFocus?: React.RefObject<HTMLElement | null>;
    /** The element to focus when the dialog closes. Defaults to the element that had the focus. */
    returnFocus?: React.RefObject<HTMLElement | null>;
  } = {},
): React.RefCallback<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const { initialFocus, returnFocus } = options;

  useEffect(() => {
    const element = containerRef.current;
    if (!enabled || !element) return;

    const container: HTMLDivElement = element;
    previousFocus.current = document.activeElement as HTMLElement;

    function focusableElements(): HTMLElement[] {
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (item) => item.offsetWidth > 0 || item.offsetHeight > 0,
      );
    }

    const first = focusableElements()[0];
    (initialFocus?.current ?? first)?.focus({ preventScroll: true });

    // Tab moves the focus from the last element back to the first one, and
    // Shift+Tab does the opposite, so the focus stays inside the dialog.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;

      const elements = focusableElements();
      if (elements.length === 0) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    }

    // Clicking outside the dialog would leave the focus outside of it, so we
    // move it back. The flag stops the focus() call from starting a loop.
    let movingFocus = false;

    function onFocusIn(event: FocusEvent) {
      const target = event.target as Node | null;
      if (target && container.contains(target)) return;
      if (movingFocus) return;

      const firstElement = focusableElements()[0];
      if (!firstElement) return;

      movingFocus = true;
      firstElement.focus({ preventScroll: true });
      window.setTimeout(() => {
        movingFocus = false;
      }, 0);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);

      const target = returnFocus?.current ?? previousFocus.current;
      target?.focus({ preventScroll: true });
    };
  }, [enabled, initialFocus, returnFocus]);

  return (element) => {
    containerRef.current = element;
  };
}

export default useFocusTrap;
