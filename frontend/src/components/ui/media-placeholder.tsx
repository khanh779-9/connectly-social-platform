import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

/** Any Lucide-style icon component (className-driven sizing). */
export type MediaIcon = ComponentType<{
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

export interface MediaPlaceholderProps {
  icon: MediaIcon;
  /** One plain sentence: no storage, CDN or HTTP vocabulary. */
  label: string;
  /**
   * `sm` for thumbnails and inline boxes, `md` for post media and the
   * full-surface players. Sizes live here so every fallback matches.
   */
  size?: 'sm' | 'md';
  /** Extra icon classes, e.g. `animate-spin` for a progress icon. */
  iconClassName?: string;
  /** Size, background and text tone of the box. */
  className?: string;
}

/**
 * The single stand-in for media that cannot be shown. Shared by SafeImage /
 * SafeVideo and by the players that own their <video> element, so every broken
 * image or clip reads the same across the app.
 */
export default function MediaPlaceholder({
  icon: Icon,
  label,
  size = 'sm',
  iconClassName,
  className,
}: MediaPlaceholderProps) {
  const large = size === 'md';

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'flex flex-col items-center justify-center text-center text-muted-foreground',
        large ? 'gap-2' : 'gap-1.5',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn(large ? 'h-7 w-7' : 'h-5 w-5', iconClassName)} />
      <span className={cn(large ? 'px-3 text-[13px] leading-relaxed' : 'px-2 text-[12px] leading-tight')}>
        {label}
      </span>
    </span>
  );
}
