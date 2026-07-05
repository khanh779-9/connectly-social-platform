import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import MediaPlaceholder from '@/components/ui/media-placeholder';
import { cn } from '@/lib/utils';

export interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Copy shown instead of the broken-image icon. Keep it plain: the people using
   * this app are not going to read a storage/CDN error message.
   */
  fallbackLabel?: string;
  /** Extra classes for the placeholder box (e.g. a minimum height). */
  fallbackClassName?: string;
}

/**
 * An <img> that degrades into a neutral placeholder when the file cannot be
 * fetched — an expired pre-signed URL or an unreachable media service must not
 * leave the surrounding post looking broken.
 */
export default function SafeImage({
  src,
  alt,
  className,
  fallbackLabel = 'Image unavailable',
  fallbackClassName,
  ...rest
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  // A new URL deserves a new attempt (the same component instance can be reused).
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <MediaPlaceholder
        icon={ImageOff}
        label={fallbackLabel}
        className={cn('bg-secondary', className, fallbackClassName)}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
