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

