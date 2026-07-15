import { useState } from 'react';
import { VideoOff } from 'lucide-react';
import MediaPlaceholder from '@/components/ui/media-placeholder';
import SafeImage from '@/components/ui/safe-image';
import { cn } from '@/lib/utils';
import type { PostDto } from '@/types/api';

interface PostMediaProps {
  post: PostDto;
  threadMode: 'dialog' | 'inline';
  onOpenThread: () => void;
  failedVideos: Record<string, boolean>;
  onVideoError: (mediaId: string) => void;
}

export function PostMedia({
  post,
  threadMode,
  onOpenThread,
  failedVideos,
  onVideoError,
}: PostMediaProps) {
  if (post.media.length === 0) return null;

  return (
    <div
      className={cn(
        'mt-3 grid gap-2 overflow-hidden',
        post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
      )}
    >
      {post.media.map((media) =>
        media.contentType.startsWith('video/') ? (
          failedVideos[media.id] ? (
            <MediaPlaceholder
              key={media.id}
              icon={VideoOff}
              label="This video cannot be played right now."
              size="md"
              className="min-h-56 w-full rounded bg-secondary"
            />
          ) : (
            <video
              key={media.id}
              src={media.url}
              className="max-h-96 w-full rounded bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              onError={() => onVideoError(media.id)}
            />
          )
        ) : (
          <button
            key={media.id}
            type="button"
            onClick={() => {
              if (threadMode === 'dialog') onOpenThread();
            }}
            className={cn(
              'block w-full overflow-hidden rounded media-focus',
              threadMode === 'dialog' && 'cursor-zoom-in',
            )}
            aria-label="Open post"
          >
            <SafeImage
              src={media.url}
              alt=""
              loading="lazy"
              className="max-h-96 w-full object-cover"
              fallbackClassName="min-h-56"
            />
          </button>
        ),
      )}
    </div>
  );
}