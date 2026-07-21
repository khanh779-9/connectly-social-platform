import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PostCard from '@/features/social/PostCard';
import {
  ensureProfiles,
  fetchPost,
  getErrorMessage,
  removeBookmark,
  removeReaction,
  saveBookmark,
  setReaction,
} from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

/**
 * Post detail dialog opened from the "N comments" link on a feed card.
 * On small screens it becomes a full-screen sheet instead of a floating card.
 */
export default function PostDialog({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const [post, setPost] = useState<PostDto | null>(null);
  const [author, setAuthor] = useState<ProfileDto | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const found = await fetchPost(postId);
      setPost(found);
      setMyReaction(found.viewerReaction ?? null);
      setSaved(Boolean(found.viewerBookmarked));
      const resolved = await ensureProfiles([found.authorUserId]);
      setAuthor(resolved[found.authorUserId] ?? null);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, [postId]);

  // Lock the page behind the dialog, move focus inside and close on Escape.
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

  async function handleReact(target: PostDto, type: string | null) {
    const previous = myReaction;
    setMyReaction(type);
    try {
      if (type) await setReaction(target.id, type);
      else await removeReaction(target.id);
    } catch {
      setMyReaction(previous);
    }
  }

  async function handleToggleBookmark(target: PostDto, wasSaved: boolean) {
    setSaved(!wasSaved);
    try {
      if (wasSaved) await removeBookmark(target.id);
      else await saveBookmark(target.id);
    } catch {
      setSaved(wasSaved);
    }
  }

  return (
    <Overlay
      className="fixed inset-0 z-[55] flex items-stretch justify-center bg-black/45 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-dialog-title"
        className="flex h-full w-full flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[90vh] sm:max-w-[740px] sm:rounded sm:border sm:border-border"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <h2 id="post-dialog-title" className="text-[15px] font-semibold text-foreground">
            Post
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close post"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 scroll-quiet sm:p-4">
          {status === 'loading' && (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {status === 'error' && (
            <div className="px-2 py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Could not load this post</p>
              <p className="mt-1">{error}</p>
              <Button variant="ghost" className="mt-4" onClick={load}>
                Try again
              </Button>
            </div>
          )}

          {status === 'ready' && post && (
            <PostCard
              post={post}
              author={author}
              viewerReaction={myReaction}
              onReact={handleReact}
              bookmarked={saved}
              onToggleBookmark={handleToggleBookmark}
              onProfilesResolved={() => undefined}
              threadMode="inline"
              defaultCommentsOpen
              onDeleted={onClose}
            />
          )}
        </div>
      </div>
    </Overlay>
  );
}
