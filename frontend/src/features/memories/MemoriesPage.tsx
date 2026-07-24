import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PostCard from '@/features/social/PostCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppSelector } from '@/store/hooks';
import {
  fetchMyProfile,
  fetchUserPosts,
  getErrorMessage,
  removeReaction,
  setReaction,
  viewerReactionFrom,
} from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';

/** Posts per request while looking for earlier years. */
const PAGE_SIZE = 30;
/** Hard cap on requests, so opening the tab stays cheap. */
const PAGE_BUDGET = 3;
/** Stop early once we have enough to fill "On this day". */
const ENOUGH_MEMORIES = 6;
/** Recent posts shown under "Recently yours". */
const RECENT_COUNT = 5;

function isOnThisDay(createdAt: string, now: Date): boolean {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return (
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate() &&
    created.getFullYear() < now.getFullYear()
  );
}

export default function MemoriesPage() {
  const myId = useAppSelector((state) => state.auth.userId);

  const [posts, setPosts] = useState<PostDto[]>([]);
  const [me, setMe] = useState<ProfileDto | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string | null>>({});

  async function load() {
    if (!myId) return;
    setStatus('loading');
    setError(null);
    const now = new Date();
    try {
      // The profile is awaited with the first page so the cards do not flash "Unknown user".
      const [firstPage, profile] = await Promise.all([
        fetchUserPosts(myId, undefined, PAGE_SIZE),
        fetchMyProfile().catch(() => null),
      ]);
      setMe(profile);

      // Posts come newest-first, so earlier years live on later pages.
      let collected = firstPage.items;
      let cursor = firstPage.nextCursor ?? undefined;
      let found = collected.filter((post) => isOnThisDay(post.createdAt, now)).length;

      for (let page = 1; page < PAGE_BUDGET && cursor && found < ENOUGH_MEMORIES; page += 1) {
        const next = await fetchUserPosts(myId, cursor, PAGE_SIZE);
        collected = collected.concat(next.items);
        cursor = next.nextCursor ?? undefined;
        found = collected.filter((post) => isOnThisDay(post.createdAt, now)).length;
      }

      setPosts(collected);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, [myId]);

  const now = new Date();
  const memories = posts
    .filter((post) => isOnThisDay(post.createdAt, now))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recent = posts.slice(0, RECENT_COUNT);

  async function handleReact(post: PostDto, type: string | null) {
    const previous = viewerReactionFrom(reactions, post);
    if (previous === type) return;
    setReactions((prev) => ({ ...prev, [post.id]: type }));
    try {
      if (type) await setReaction(post.id, type);
      else await removeReaction(post.id);
    } catch {
      setReactions((prev) => ({ ...prev, [post.id]: previous }));
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Could not load memories</p>
        <p className="mt-1">{error}</p>
        <Button variant="ghost" className="mt-4" onClick={() => load()}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto space-y-6">
      <header>
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
          Memories
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {memories.length > 0
            ? `${memories.length} ${memories.length === 1 ? 'post' : 'posts'} from this day in earlier years.`
            : 'Posts you made on this day in earlier years will surface here.'}
        </p>
      </header>

      {memories.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[15px] font-semibold text-foreground">On this day</h2>
          {memories.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={me}
              viewerReaction={viewerReactionFrom(reactions, post)}
              onReact={handleReact}
            />
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-[15px] font-semibold text-foreground">Recently yours</h2>
        {recent.length === 0 ? (
          <Card className="rounded border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            You have not posted yet. Share your first thought on the home feed.
          </Card>
        ) : (
          recent.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={me}
              viewerReaction={viewerReactionFrom(reactions, post)}
              onReact={handleReact}
            />
          ))
        )}
        {recent.length > 0 && (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => load()}>
              Refresh memories
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
