import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ensureProfiles,
  fetchReels,
  getErrorMessage,
  removeBookmark,
  removeReaction,
  saveBookmark,
  setReaction,
  sharePost,
} from '@/lib/social';
import { cn } from '@/lib/utils';
import ReelCard from '@/features/reels/ReelCard';
import ReelPlayer from '@/features/reels/ReelPlayer';
import CreateReelDialog from '@/features/reels/CreateReelDialog';
import type { ProfileDto, ReelDto } from '@/types/api';

type FeedTab = 'foryou' | 'following';

const TABS: { value: FeedTab; label: string }[] = [
  { value: 'foryou', label: 'For you' },
  { value: 'following', label: 'Following' },
];

export default function ReelsPage() {
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [reels, setReels] = useState<ReelDto[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);

  async function load(nextTab: FeedTab) {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchReels(nextTab);
      setReels(page.items);
      setCursor(page.nextCursor ?? null);
      const ids = page.items.map((reel) => reel.authorUserId);
      const resolved = await ensureProfiles(ids);
      setProfiles((prev) => ({ ...prev, ...resolved }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchReels(tab, cursor);
      setReels((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor ?? null);
      const ids = page.items.map((reel) => reel.authorUserId);
      const resolved = await ensureProfiles(ids);
      setProfiles((prev) => ({ ...prev, ...resolved }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  // Patches one reel inside the list (counts, viewer state).
  function patch(reel: ReelDto) {
    setReels((prev) => prev.map((item) => (item.id === reel.id ? { ...item, ...reel } : item)));
  }

  async function toggleReaction(reel: ReelDto) {
    const liked = Boolean(reel.viewerReaction);
    const next = {
      ...reel,
      viewerReaction: liked ? null : 'like',
      reactionCount: liked ? Math.max(0, reel.reactionCount - 1) : reel.reactionCount + 1,
    };
    patch(next);
    try {
      if (liked) await removeReaction(reel.id);
      else await setReaction(reel.id, 'like');
    } catch (err) {
      patch(reel);
      setError(getErrorMessage(err));
    }
  }

  async function toggleBookmark(reel: ReelDto) {
    const saved = reel.viewerBookmarked;
    patch({ ...reel, viewerBookmarked: !saved });
    try {
      if (saved) await removeBookmark(reel.id);
      else await saveBookmark(reel.id);
    } catch (err) {
      patch(reel);
      setError(getErrorMessage(err));
    }
  }

  async function share(reel: ReelDto) {
    try {
      await sharePost(reel.id);
      patch({ ...reel, shareCount: reel.shareCount + 1 });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // the reel closest to the viewport centre plays
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const container = activeRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId((visible.target as HTMLElement).dataset.reelId ?? null);
      },
      { threshold: [0.5] },
    );
    container.querySelectorAll('[data-reel-id]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [reels]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Reels</h1>
          <p className="text-[13px] text-muted-foreground">
            Short vertical videos from the people and pages you follow.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New reel
        </Button>
      </header>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              'relative px-3 py-2 text-[13px] font-medium transition-colors',
              tab === item.value
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {tab === item.value && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reels…
        </div>
      ) : reels.length === 0 ? (
        <Card className="rounded border border-border bg-card px-4 py-16 text-center">
          <p className="text-[14px] font-medium text-foreground">No reels yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {tab === 'following'
              ? 'Follow more people to see their reels here.'
              : 'Publish your first reel to start the feed.'}
          </p>
        </Card>
      ) : (
        <div ref={activeRef} className="space-y-6">
          {reels.map((reel) => (
            <div key={reel.id} data-reel-id={reel.id}>
              <ReelCard
                reel={reel}
                author={profiles[reel.authorUserId] ?? null}
                active={activeId === reel.id}
                onOpen={() => setPlayerIndex(reels.findIndex((item) => item.id === reel.id))}
                onToggleReaction={toggleReaction}
                onToggleBookmark={toggleBookmark}
                onShare={share}
              />
            </div>
          ))}

          {cursor && (
            <div className="flex justify-center pb-4">
              <Button variant="ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {creating && (
        <CreateReelDialog
          onClose={() => setCreating(false)}
          onCreated={(reel) => {
            setReels((prev) => [reel, ...prev]);
            ensureProfiles([reel.authorUserId]).then((resolved) =>
              setProfiles((prev) => ({ ...prev, ...resolved })),
            );
          }}
        />
      )}

      {playerIndex !== null && reels[playerIndex] && (
        <ReelPlayer
          reels={reels}
          startIndex={playerIndex}
          onClose={() => setPlayerIndex(null)}
          onUpdate={patch}
          onToggleReaction={toggleReaction}
          onToggleBookmark={toggleBookmark}
          onShare={share}
        />
      )}
    </div>
  );
}
