import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { avatarTone } from '@/lib/avatar';
import {
  createDirectConversation,
  ensureProfiles,
  fetchFriends,
  getErrorMessage,
  initials,
  sendChatMessage,
} from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

interface ShareDialogProps {
  post: PostDto;
  viewerId: string | null;
  onClose: () => void;
}

/** "Send in message": pick a friend, drop the post link into a DM. */
export default function ShareDialog({ post, viewerId, onClose }: ShareDialogProps) {
  const [friends, setFriends] = useState<ProfileDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!viewerId) throw new Error('You need to log in again.');
        const list = await fetchFriends(viewerId);
        await ensureProfiles(list.map((friend) => friend.userId));
        if (!cancelled) setFriends(list);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  async function shareWith(friend: ProfileDto) {
    if (sendingId || sentTo[friend.userId]) return;
    setSendingId(friend.userId);
    try {
      const conversation = await createDirectConversation(friend.userId);
      await sendChatMessage(conversation.id, `Shared a post: ${window.location.origin}/post/${post.id}`);
      setSentTo((prev) => ({ ...prev, [friend.userId]: conversation.id }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSendingId(null);
    }
  }

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
    <Overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Send in message"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Send in message</p>
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
          {friends === null && !error && (
            <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}
          {friends !== null && friends.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              Add friends to share posts directly.
            </p>
          )}
          {friends?.map((friend) => {
            const sent = sentTo[friend.userId];
            return (
              <button
                key={friend.userId}
                type="button"
                disabled={Boolean(sent) || sendingId === friend.userId}
                onClick={() => shareWith(friend)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary disabled:opacity-70"
              >
                <Avatar className="h-9 w-9">
                  {friend.avatarUrl ? (
                    <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
                  ) : null}
                  <AvatarFallback style={avatarTone(friend.userId)}>
                    {initials(friend.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {friend.displayName}
                </span>
                {sent ? (
                  <span className="flex items-center gap-1 text-[12px] text-accent">
                    <Check className="h-3.5 w-3.5" /> Sent
                  </span>
                ) : sendingId === friend.userId ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Button variant="ghost" size="sm" tabIndex={-1}>
                    Send
                  </Button>
                )}
              </button>
            );
          })}
          {friends !== null && (
            <Link
              to="/messages"
              onClick={onClose}
              className="mt-2 block rounded-md px-2 py-2 text-center text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Or open Messages to pick a group chat
            </Link>
          )}
          {error && <p className="px-3 py-2 text-center text-[12px] text-destructive">{error}</p>}
        </div>
      </div>
    </Overlay>
  );
}
