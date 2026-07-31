import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  ImageOff,
  Loader2,
  Lock,
  Users,
  VideoOff,
  X,
} from 'lucide-react';
import MediaPlaceholder from '@/components/ui/media-placeholder';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { avatarTone } from '@/lib/avatar';
import {
  ensureProfiles,
  getErrorMessage,
  initials,
  updateStory,
  viewStory,
  visibilityLabel,
} from '@/lib/social';
import StoryViewersPanel from '@/features/stories/StoryViewersPanel';
import type { ProfileDto, StoryDto } from '@/types/api';
import Overlay from '@/components/ui/overlay';

const STORY_DURATION_MS = 6000;

const STORY_VISIBILITY = [
  { value: 0, label: 'Public', icon: Globe2 },
  { value: 1, label: 'Friends', icon: Users },
  { value: 2, label: 'Only me', icon: Lock },
];

export interface StoryViewerProps {
  stories: StoryDto[];
  authorUserId: string;
  onClose: () => void;
  /** called after a story was marked as seen (the rail can grey it out) */
  onViewed?: (storyId: string) => void;
  /** owner-only: archive this story into a highlight */
  onArchive?: (storyId: string) => void;
  /** owner-only: delete this story */
  onDelete?: (storyId: string) => void;
  /** owner-only: take this story out of the highlight it belongs to */
  onRemove?: (storyId: string) => void;
}

/** Full-screen story player: progress bar, keyboard navigation, auto-advance. */
export default function StoryViewer({
  stories,
  authorUserId,
  onClose,
  onViewed,
  onArchive,
  onDelete,
  onRemove,
}: StoryViewerProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, string>>({});

  // refs keep the timers/effects stable even when the parent re-renders
  const viewedRef = useRef<Set<string>>(new Set());
  const onViewedRef = useRef(onViewed);
  const onCloseRef = useRef(onClose);
  const onArchiveRef = useRef(onArchive);
  const onDeleteRef = useRef(onDelete);
  const onRemoveRef = useRef(onRemove);
  const startedAtRef = useRef<number>(Date.now());

  onViewedRef.current = onViewed;
  onCloseRef.current = onClose;
  onArchiveRef.current = onArchive;
  onDeleteRef.current = onDelete;
  onRemoveRef.current = onRemove;

  const storyCount = stories.length;
  const current = stories[index] ?? null;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= storyCount) {
        onCloseRef.current();
        return;
      }
      setIndex(next);
      setProgress(0);
      startedAtRef.current = Date.now();
    },
    [storyCount],
  );

  // mark as seen + load the author profile (once per story)
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    if (!viewedRef.current.has(current.id)) {
      viewedRef.current.add(current.id);
      viewStory(current.id)
        .then(() => {
          if (!cancelled) onViewedRef.current?.(current.id);
        })
        .catch((err) => {
          if (!cancelled) setError(getErrorMessage(err));
        });
    }
    ensureProfiles([authorUserId]).then((resolved) => {
      if (!cancelled) setProfile(resolved[authorUserId] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [current, authorUserId]);

  // Images auto-advance on a timer; a video advances when the clip ends, so it is
  // not cut off mid-way when it is longer than STORY_DURATION_MS.
  useEffect(() => {
    if (!current) return;
    startedAtRef.current = Date.now();
    setProgress(0);
    setMediaFailed(false);
    if (current.contentType.startsWith('video/')) return;
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const ratio = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(ratio);
      if (ratio >= 1) goTo(index + 1);
    }, 100);
    return () => window.clearInterval(tick);
  }, [current, index, goTo]);

  // keyboard navigation
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'ArrowRight') goTo(index + 1);
      if (event.key === 'ArrowLeft') goTo(index - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo]);

  // lock body scroll while the viewer is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // keep the cursor inside the list when a story is removed
  useEffect(() => {
    if (index >= stories.length) setIndex(Math.max(0, stories.length - 1));
  }, [index, stories.length]);

  // the last story was removed (deleted or detached) — close the viewer
  useEffect(() => {
    if (!current) onCloseRef.current();
  }, [current]);

  if (!current) return null;

  const isVideo = current.contentType.startsWith('video/');
  const visibility = visibilityOverrides[current.id] ?? visibilityLabel(current.visibility);

  async function changeVisibility(next: number) {
    const previous = visibilityOverrides;
    setVisibilityOverrides((prev) => ({ ...prev, [current.id]: visibilityLabel(next) }));
    setError(null);
    try {
      await updateStory(current.id, { visibility: next });
    } catch (err) {
      setVisibilityOverrides(previous);
      setError(getErrorMessage(err));
    }
  }

  return (
    <Overlay
      role="dialog"
      aria-modal="true"
      aria-label="Story"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-0 sm:p-6"
    >
      <div className="relative flex h-full w-full max-w-[420px] flex-col overflow-hidden bg-[#111315] sm:h-[85vh] sm:rounded">
        {/* progress bars */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-3">
          {stories.map((story, i) => (
            <span key={story.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full bg-white"
                style={{
                  width: i < index ? '100%' : i === index ? `${Math.round(progress * 100)}%` : '0%',
                }}
              />
            </span>
          ))}
        </div>

        {/* header */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pb-6 pt-5 text-white">
          <Avatar className="h-8 w-8">
            {profile?.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            ) : null}
            <AvatarFallback style={avatarTone(authorUserId)}>
              {initials(profile?.displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {profile?.displayName ?? 'Story'}
          </span>
          <button
            type="button"
            aria-label="Close story"
            onClick={onCloseRef.current}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* owner actions */}
        {(onArchiveRef.current || onDeleteRef.current || onRemoveRef.current) && (
          <div className="absolute right-3 top-14 z-20 flex flex-wrap items-center justify-end gap-2">
            {onDeleteRef.current && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Audience: ${visibility}. Change who can see this story`}
                    className="rounded border border-white/25 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    {visibility}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Who can see this story</DropdownMenuLabel>
                  {STORY_VISIBILITY.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem key={value} onSelect={() => changeVisibility(value)}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{label}</span>
                      {visibility === label && <Check className="h-4 w-4 text-accent" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              type="button"
              onClick={() => setShowViewers(true)}
              className="flex items-center gap-1 rounded border border-white/25 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-white/10"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="tnum">{current.viewCount}</span>
            </button>
            {onArchiveRef.current && (
              <button
                type="button"
                onClick={() => onArchiveRef.current?.(current.id)}
                className="rounded border border-white/25 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-white/10"
              >
                Save to highlight
              </button>
            )}
            {onRemoveRef.current && (
              <button
                type="button"
                aria-label="Remove from highlight"
                onClick={() => onRemoveRef.current?.(current.id)}
                className="rounded border border-white/25 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-white/10"
              >
                Remove
              </button>
            )}
            {onDeleteRef.current && (
              <button
                type="button"
                aria-label="Delete story"
                onClick={() => onDeleteRef.current?.(current.id)}
                className="rounded border border-white/25 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-white/10"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {/* media */}
        <div className="flex h-full w-full items-center justify-center">
          {mediaFailed ? (
            <MediaPlaceholder
              icon={isVideo ? VideoOff : ImageOff}
              label="This story cannot be loaded right now."
              size="md"
              className="h-full w-full px-6 text-white/90"
            />
          ) : isVideo ? (
            <video
              key={current.id}
              src={current.url}
              className="h-full w-full object-contain"
              autoPlay
              muted
              playsInline
              onError={() => setMediaFailed(true)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (video.duration > 0) {
                  setProgress(Math.min(1, video.currentTime / video.duration));
                }
              }}
              onEnded={() => goTo(index + 1)}
            />
          ) : (
            <img
              key={current.id}
              src={current.url}
              alt={current.caption ?? 'Story'}
              className="h-full w-full object-contain"
              decoding="async"
              onError={() => setMediaFailed(true)}
            />
          )}
        </div>

        {/* caption */}
        {current.caption && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-black/60 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-white">{current.caption}</p>
          </div>
        )}

        {/* navigation */}
        <button
          type="button"
          aria-label="Previous story"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Next story"
          onClick={() => goTo(index + 1)}
          className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {error && (
          <p className="absolute inset-x-0 bottom-16 z-20 flex items-center justify-center gap-2 text-[12px] text-white/90">
            <Loader2 className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>

      {showViewers && (
        <StoryViewersPanel storyId={current.id} onClose={() => setShowViewers(false)} />
      )}
    </Overlay>
  );
}
