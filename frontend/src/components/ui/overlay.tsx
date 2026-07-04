import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

export type OverlayProps = HTMLAttributes<HTMLDivElement>;

/**
 * A fixed overlay rendered into <body>.
 *
 * `position: fixed` resolves against the nearest transformed ancestor, and the
 * virtualized feed wraps every row in a `transform: translateY(...)` wrapper.
 * Without a portal, a dialog opened from a post is positioned - and clipped -
 * by that row instead of by the viewport.
 */
const Overlay = forwardRef<HTMLDivElement, OverlayProps>(function Overlay(
  { className, children, ...props },
  ref,
) {
  return createPortal(
    <div ref={ref} className={className} {...props}>
      {children}
    </div>,
    document.body,
  );
});

export default Overlay;
