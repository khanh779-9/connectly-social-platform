import { useEffect, useState } from 'react';
import { Loader2, VideoOff } from 'lucide-react';
import MediaPlaceholder from '@/components/ui/media-placeholder';
import { cn } from '@/lib/utils';

/**
 * How long a thumbnail may stay unresolved. metadata is a few kilobytes, so a
 * source that has not answered by now is unusable for this viewer. The tile
 * still links to the player, which retries the full file.
 */
const LOAD_TIMEOUT_MS = 10_000;

export interface SafeVideoProps {
  src: string;
  /** Size and shape of the box, e.g. `aspect-[9/16] w-full`. */
  className?: string;
  /** Tone for both placeholders, e.g. `text-white/90` on a dark tile. */
  placeholderClassName?: string;
  fallbackLabel?: string;
  loadingLabel?: string;
}

/**
 * A <video> that never leaves a bare black box: a neutral "loading" panel shows
 * until the first frame arrives, and a plain-language message replaces it when
 * the media service cannot deliver the file.
 *
 * It owns the <video> element, so it fits a thumbnail. Players that need a ref,
 * custom controls or playback handlers keep their own element and only borrow
 * MediaPlaceholder.
 */
export default function SafeVideo({
  src,
  className,
  placeholderClassName,
  fallbackLabel = 'Video unavailable',
  loadingLabel = 'Loading video',
}: SafeVideoProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Restart on a new URL, and arm the stall timer in the same pass: a hung
  // request fires neither loadedmetadata nor error, so it needs its own ending.
  useEffect(() => {
    if (!src) return;
    setStatus('loading');
    const timer = setTimeout(
      () => setStatus((prev) => (prev === 'loading' ? 'error' : prev)),
      LOAD_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [src]);

  // loadedmetadata already proves the file is reachable; loadeddata adds the
  // frame. Neither may revive a video that has already failed.
  const markReady = () => setStatus((prev) => (prev === 'loading' ? 'ready' : prev));

  if (!src || status === 'error') {
    return (
      <MediaPlaceholder
        icon={VideoOff}
        label={fallbackLabel}
        className={cn(className, placeholderClassName)}
      />
    );
  }

  return (
    <span className={cn('relative block overflow-hidden', className)}>
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        className={cn('h-full w-full object-cover', status === 'ready' ? 'opacity-100' : 'opacity-0')}
        onLoadedMetadata={markReady}
        onLoadedData={markReady}
        onError={() => setStatus('error')}
      />
      {status === 'loading' && (
        <MediaPlaceholder
          icon={Loader2}
          iconClassName="animate-spin"
          label={loadingLabel}
          className={cn('absolute inset-0', placeholderClassName)}
        />
      )}
    </span>
  );
}
