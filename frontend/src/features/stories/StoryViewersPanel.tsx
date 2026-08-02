import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarTone } from '@/lib/avatar';
import { ensureProfiles, fetchStoryViews, getErrorMessage, initials, timeAgo } from '@/lib/social';
import type { ProfileDto, StoryViewDto } from '@/types/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

export interface StoryViewersPanelProps {
  storyId: string;
  onClose: () => void;
}

// Who watched one of your stories — only the author can open this list.
export default function StoryViewersPanel({ storyId, onClose }: StoryViewersPanelProps) {
  const [views, setViews] = useState<StoryViewDto[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchStoryViews(storyId);
      setViews(list);
      const resolved = await ensureProfiles(list.map((view) => view.viewerUserId));
      setProfiles((prev) => ({ ...prev, ...resolved }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [storyId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <Overlay
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Story viewers"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Eye className="h-4 w-4" />
            Viewers
          </p>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-24 flex-1 overflow-y-auto p-2">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}

          {!loading && error && (
            <p className="px-3 py-6 text-center text-[12px] text-destructive">{error}</p>
          )}

          {!loading && !error && views?.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              Nobody has watched this story yet.
            </p>
          )}

          {views?.map((view) => {
            const profile = profiles[view.viewerUserId];
            return (
              <Link
                key={view.viewerUserId}
                to={`/profile/${view.viewerUserId}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-secondary"
              >
                <Avatar className="h-9 w-9">
                  {profile?.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                  ) : null}
                  <AvatarFallback style={avatarTone(view.viewerUserId)}>
                    {initials(profile?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {profile?.displayName ?? 'User'}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    {timeAgo(view.viewedAt)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
}
