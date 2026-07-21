import { useEffect, useRef, useState } from 'react';
import { History, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { avatarTone } from '@/lib/avatar';
import {
  ensureProfiles,
  fetchCommentEdits,
  fetchPostEdits,
  getErrorMessage,
  initials,
  timeAgo,
} from '@/lib/social';
import { cn } from '@/lib/utils';
import type { ContentEditDto, ProfileDto } from '@/types/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

/**
 * Revision history for a post or a comment. Anyone who can read the content can
 * open this, so the dialog only lists what the server already let them read.
 */
export default function EditHistoryDialog({
  kind,
  contentId,
  onClose,
}: {
  kind: 'post' | 'comment';
  contentId: string;
  onClose: () => void;
}) {
  const [edits, setEdits] = useState<ContentEditDto[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (kind === 'post' ? fetchPostEdits(contentId) : fetchCommentEdits(contentId))
      .then(async (items) => {
        if (cancelled) return;
        setEdits(items);
        setStatus('ready');
        const resolved = await ensureProfiles(items.map((item) => item.editorUserId));
        if (!cancelled) setProfiles(resolved);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [kind, contentId]);

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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-history-title"
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card sm:max-w-lg sm:rounded sm:border sm:border-border"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 id="edit-history-title" className="flex-1 text-[15px] font-semibold text-foreground">
            Edit history
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close edit history"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 scroll-quiet">
          {status === 'loading' && (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {status === 'error' && (
            <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
              Could not load the history. {error}
            </p>
          )}

          {status === 'ready' && edits.length === 0 && (
            <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
              This {kind} has no edits yet.
            </p>
          )}

          {status === 'ready' &&
            edits.map((edit, index) => {
              const profile = profiles[edit.editorUserId];
              return (
                <article
                  key={`${edit.editedAt}-${index}`}
                  className={cn(
                    'rounded border border-border p-3',
                    index > 0 && 'mt-2',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {profile?.avatarUrl ? (
                        <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                      ) : null}
                      <AvatarFallback
                        className="text-[12px]"
                        style={avatarTone(edit.editorUserId)}
                      >
                        {initials(profile?.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {profile?.displayName ?? 'Someone'}
                      </span>{' '}
                      edited · {timeAgo(edit.editedAt)}
                    </p>
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="rounded bg-destructive/5 px-2.5 text-[13px] text-muted-foreground line-through decoration-destructive/40">
                      {edit.previousText?.trim() || <em>empty</em>}
                    </p>
                    <p className="rounded bg-accent-soft/60 px-2.5 py-1.5 text-[13px] text-foreground">
                      {edit.newText?.trim() || <em className="text-muted-foreground">empty</em>}
                    </p>
                  </div>
                </article>
              );
            })}
        </div>

        <footer className="flex justify-end border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </Overlay>
  );
}
