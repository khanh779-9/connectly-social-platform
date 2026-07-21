import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { avatarTone } from '@/lib/avatar';
import { ensureProfiles, fetchReactors, getErrorMessage, initials, timeAgo } from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';
import { reactionDef } from './reactions';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Overlay from '@/components/ui/overlay';

interface ReactionBreakdownProps {
  post: PostDto;
  onClose: () => void;
}

interface ReactorRow {
  userId: string;
  reactionType: string;
  createdAt: string;
  profile: ProfileDto | null;
}

/** "Post options → who reacted" dialog: all reactions, filterable by type. */
export default function ReactionBreakdown({ post, onClose }: ReactionBreakdownProps) {
  const [rows, setRows] = useState<ReactorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useFocusTrap(true, { initialFocus: closeRef, returnFocus: closeRef });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const actors = await fetchReactors(post.id);
        const profiles = await ensureProfiles(actors.map((actor) => actor.userId));
        if (!cancelled) {
          setRows(
            actors.map((actor) => ({
              userId: actor.userId,
              reactionType: actor.reactionType,
              createdAt: actor.createdAt,
              profile: profiles[actor.userId] ?? null,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  // the reaction types of this post, the most used one first
  const presentTypes: [string, number][] = [];
  if (rows) {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.reactionType, (counts.get(row.reactionType) ?? 0) + 1));
    presentTypes.push(...[...counts.entries()].sort((a, b) => b[1] - a[1]));
  }

  const visible = rows?.filter((row) => !filter || row.reactionType === filter) ?? [];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reactions"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Reactions</p>
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

        {presentTypes.length > 0 && (
          <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
            <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} />
            {presentTypes.map(([type, count]) => (
              <FilterChip
                key={type}
                label={`${reactionDef(type).emoji} ${count}`}
                active={filter === type}
                onClick={() => setFilter(type)}
              />
            ))}
          </div>
        )}

        <div className="min-h-24 flex-1 overflow-y-auto p-2">
          {rows === null && !error && (
            <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}
          {error && <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">{error}</p>}
          {rows !== null && visible.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No reactions yet.</p>
          )}
          {visible.map((row) => (
            <Link
              key={`${row.userId}-${row.createdAt}`}
              to={`/profile/${row.userId}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary"
            >
              <Avatar className="h-9 w-9">
                {row.profile?.avatarUrl ? (
                  <AvatarImage src={row.profile.avatarUrl} alt={row.profile.displayName} />
                ) : null}
                <AvatarFallback style={avatarTone(row.userId)}>
                  {initials(row.profile?.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {row.profile?.displayName ?? 'User'}
                </p>
                <p className="text-[12px] text-muted-foreground">{timeAgo(row.createdAt)}</p>
              </div>
              <span className="text-base" title={reactionDef(row.reactionType).label}>
                {reactionDef(row.reactionType).emoji}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded px-2.5 py-1 text-[12px] font-medium transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
