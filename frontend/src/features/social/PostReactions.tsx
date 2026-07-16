import { useRef, useState, useEffect } from 'react';
import ReactionPicker from './ReactionPicker';
import { reactionDef } from './reactions';
import { REACTION_TEXT } from './postUtils';
import { cn } from '@/lib/utils';
import type { PostDto } from '@/types/api';

interface PostReactionsProps {
  post: PostDto;
  activeReaction: string | null;
  serverReaction: string | null;
  reactionCount: number;
  topReactions: { type: string; count: number }[];
  onReact: (post: PostDto, type: string | null) => void;
  onOpenBreakdown: () => void;
}

export function PostReactions({
  post,
  activeReaction,
  serverReaction,
  reactionCount,
  topReactions,
  onReact,
  onOpenBreakdown,
}: PostReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hoverOpenTimer = useRef<number | null>(null);
  const hoverCloseTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const likeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      [hoverOpenTimer, hoverCloseTimer, longPressTimer].forEach((timer) => {
        if (timer.current !== null) window.clearTimeout(timer.current);
      });
    },
    [],
  );

  const activeDef = reactionDef(activeReaction);

  function openPickerSoon() {
    if (hoverOpenTimer.current !== null) return;
    hoverOpenTimer.current = window.setTimeout(() => {
      hoverOpenTimer.current = null;
      setPickerOpen(true);
    }, 350);
  }
  function cancelOpenAndCloseSoon() {
    if (hoverOpenTimer.current !== null) {
      window.clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
    keepPickerOrCloseSoon(false);
  }
  function keepPickerOrCloseSoon(keep: boolean) {
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    if (!keep) {
      hoverCloseTimer.current = window.setTimeout(() => {
        hoverCloseTimer.current = null;
        setPickerOpen(false);
      }, 250);
    }
  }
  function onLikePointerDown() {
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      suppressClick.current = true;
      setPickerOpen(true);
    }, 400);
  }
  function onLikePointerUp() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }
  function handleLikeClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      setPickerOpen(false);
      return;
    }
    setPickerOpen(false);
    onReact(post, activeReaction ? null : 'like');
  }
  function handlePickReaction(type: string) {
    setPickerOpen(false);
    onReact(post, type === activeReaction ? null : type);
  }

  if (reactionCount === 0) return null;

  return (
    <>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
        <button
          type="button"
          onClick={onOpenBreakdown}
          className="flex items-center gap-1 rounded transition-colors hover:text-foreground"
        >
          <span className="flex -space-x-1">
            {topReactions.map((item) => (
              <span
                key={item.type}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-card text-[12px] leading-none ring-1 ring-card"
                title={reactionDef(item.type).label}
              >
                {reactionDef(item.type).emoji}
              </span>
            ))}
          </span>
          <span className="tnum">{reactionCount}</span>
        </button>
      </div>

      <div className="relative">
        <button
          ref={likeButtonRef}
          type="button"
          onClick={handleLikeClick}
          onPointerEnter={openPickerSoon}
          onPointerLeave={cancelOpenAndCloseSoon}
          onPointerDown={onLikePointerDown}
          onPointerUp={onLikePointerUp}
          aria-pressed={Boolean(activeReaction)}
          aria-label={activeReaction ? `Reacted with ${activeDef.label}` : 'React'}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded px-2 text-[13px] transition-colors',
            activeReaction
              ? REACTION_TEXT[activeReaction] ?? 'text-accent-action'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          {activeReaction ? (
            <span className="text-base leading-none">{activeDef.emoji}</span>
          ) : (
            <span className="inline-block">👍</span>
          )}
          {activeReaction ? activeDef.label : 'Like'}
        </button>
        {pickerOpen && (
          <ReactionPicker
            onSelect={handlePickReaction}
            onPointerEnterCard={() => keepPickerOrCloseSoon(true)}
            onPointerLeaveCard={() => keepPickerOrCloseSoon(false)}
          />
        )}
      </div>
    </>
  );
}