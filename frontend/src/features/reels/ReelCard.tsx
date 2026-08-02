import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Heart, MessageCircle, Share2, VideoOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import MediaPlaceholder from '@/components/ui/media-placeholder';
import { avatarTone } from '@/lib/avatar';
import { initials } from '@/lib/social';
import { cn } from '@/lib/utils';
import RichText from '@/features/social/RichText';
import type { ProfileDto, ReelDto } from '@/types/api';

export interface ReelCardProps {
  reel: ReelDto;
  author?: ProfileDto | null;
  /** the reel is the active one in the feed — autoplay with sound is allowed */
  active?: boolean;
  onOpen?: (reel: ReelDto) => void;
  onToggleReaction?: (reel: ReelDto) => void;
  onToggleBookmark?: (reel: ReelDto) => void;
  onShare?: (reel: ReelDto) => void;
}

/**
 * A single reel in the vertical feed: 9:16 video, creator identity, caption
 * with hashtags/mentions and the action rail on the right.
 */
export default function ReelCard({
  reel,
  author,
  active = false,
  onOpen,
  onToggleReaction,
  onToggleBookmark,
  onShare,
}: ReelCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // only the reel in view plays; it stays muted until the viewer opens it
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.muted = true;
      const attempt = video.play();
      if (attempt) attempt.catch(() => undefined);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  const liked = Boolean(reel.viewerReaction);

  return (
    <article className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded border border-border bg-[#111315]">
      <div className="relative aspect-[9/16] w-full">
        {failed ? (
          <MediaPlaceholder
            icon={VideoOff}
            label="This video cannot be played right now."
            size="md"
            className="h-full w-full px-4 text-white/90"
          />
        ) : (
          <video
            ref={videoRef}
            src={reel.url}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={() => onOpen?.(reel)}
            onError={() => setFailed(true)}
          />
        )}

        {/* tap target to open the full player */}
        <button
          type="button"
          aria-label={`Open reel by ${author?.displayName ?? 'creator'}`}
          onClick={() => onOpen?.(reel)}
          className="absolute inset-0"
        />

        {/* creator + caption */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-3">
          <div className="pointer-events-auto min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {author?.avatarUrl ? (
                  <AvatarImage src={author.avatarUrl} alt={author.displayName} />
                ) : null}
                <AvatarFallback style={avatarTone(reel.authorUserId)}>
                  {initials(author?.displayName)}
                </AvatarFallback>
              </Avatar>
              <Link
                to={`/profile/${reel.authorUserId}`}
                className="truncate text-[13px] font-medium text-white hover:underline"
              >
                {author?.displayName ?? 'Creator'}
              </Link>
            </div>
            {reel.caption && (
              <RichText
                text={reel.caption}
                mentions={reel.mentions}
                className="mt-2 line-clamp-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/90"
              />
            )}
          </div>
        </div>

        {/* action rail */}
        <div className="absolute right-2 bottom-16 z-20 flex flex-col items-center gap-3">
          <button
            type="button"
            aria-label={liked ? 'Remove reaction' : 'Like this reel'}
            onClick={() => onToggleReaction?.(reel)}
            className="flex flex-col items-center gap-1 text-white/90 transition-colors hover:text-white"
          >
            <Heart className={cn('h-6 w-6', liked && 'fill-accent text-accent')} />
            <span className="text-[12px] font-medium tnum">{reel.reactionCount}</span>
          </button>
          <button
            type="button"
            aria-label="Open comments"
            onClick={() => onOpen?.(reel)}
            className="flex flex-col items-center gap-1 text-white/90 transition-colors hover:text-white"
          >
            <MessageCircle className="h-6 w-6" />
            <span className="text-[12px] font-medium tnum">{reel.commentCount}</span>
          </button>
          <button
            type="button"
            aria-label="Share this reel"
            onClick={() => onShare?.(reel)}
            className="flex flex-col items-center gap-1 text-white/90 transition-colors hover:text-white"
          >
            <Share2 className="h-6 w-6" />
            <span className="text-[12px] font-medium tnum">{reel.shareCount}</span>
          </button>
          <button
            type="button"
            aria-label={reel.viewerBookmarked ? 'Remove bookmark' : 'Save this reel'}
            onClick={() => onToggleBookmark?.(reel)}
            className="flex flex-col items-center gap-1 text-white/90 transition-colors hover:text-white"
          >
            <Bookmark className={cn('h-6 w-6', reel.viewerBookmarked && 'fill-white')} />
          </button>
        </div>

        {/* view count */}
        <div className="absolute right-2 top-3 z-20 rounded-full bg-black/45 px-2 py-1 text-[12px] font-medium text-white tnum">
          {reel.viewCount} views
        </div>

        {active && !playing && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-2 py-1 text-[12px] text-white">
            Tap to play
          </span>
        )}
      </div>
    </article>
  );
}
