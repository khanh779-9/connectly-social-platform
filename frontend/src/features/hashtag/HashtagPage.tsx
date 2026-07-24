import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PostCard from '@/features/social/PostCard';
import {
  ensureProfiles,
  fetchHashtagFeed,
  getErrorMessage,
  removeReaction,
  setReaction,
} from '@/lib/social';
import { viewerReactionFrom } from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';

export default function HashtagPage() {
  const { tag = '' } = useParams<{ tag: string }>();
  const normalized = tag.trim().replace(/^#/, '').toLowerCase();

  const [posts, setPosts] = useState<PostDto[]>([]);
  const [authors, setAuthors] = useState<Record<string, ProfileDto | null>>({});
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string | null>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(cursor?: string) {
    if (!normalized) return;
    if (cursor) setLoadingMore(true);
    else {
      setStatus('loading');
      setError(null);
      setPosts([]);
      setReactions({});
    }
    try {
      const page = await fetchHashtagFeed(normalized, cursor, 10);
      setPosts((prev) => {
        if (!cursor) return page.items;
        const newPosts = page.items.filter((item) => !prev.some((x) => x.id === item.id));
        return [...prev, ...newPosts];
      });
      setNextCursor(page.nextCursor ?? null);
      const resolved = await ensureProfiles(page.items.map((item) => item.authorUserId));
      setAuthors((prev) => ({ ...prev, ...resolved }));
      setStatus('ready');
    } catch (err) {
      if (cursor) {
        setNextCursor(null);
      } else {
        setError(getErrorMessage(err));
        setStatus('error');
      }
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
  }, [normalized]);

  async function handleReact(post: PostDto, type: string | null) {
    const previous = viewerReactionFrom(reactions, post);
    if (previous === type) return;
    setReactions((prev) => {
      const next = { ...prev };
      if (type) next[post.id] = type;
      else next[post.id] = null;
      return next;
    });
    try {
      if (type) await setReaction(post.id, type);
      else await removeReaction(post.id);
    } catch {
      setReactions((prev) => {
        const next = { ...prev };
        if (previous) next[post.id] = previous;
        else next[post.id] = null;
        return next;
      });
    }
  }

  if (!normalized) {
    return (
      <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hashtag in this address.
      </Card>
    );
  }

  return (
    <div className="mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-foreground">#{normalized}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Posts with this hashtag from people in your network
        </p>
      </header>

      {status === 'loading' && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Could not load this hashtag</p>
          <p className="mt-1">{error}</p>
          <Button variant="ghost" className="mt-4" onClick={() => load()}>
            Try again
          </Button>
        </Card>
      )}

      {status === 'ready' && posts.length === 0 && (
        <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No posts with this hashtag in your network yet.
        </Card>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          author={authors[post.authorUserId] ?? null}
          viewerReaction={viewerReactionFrom(reactions, post)}
          onReact={handleReact}
        />
      ))}

      {loadingMore && (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="ghost" disabled={loadingMore} onClick={() => load(nextCursor ?? undefined)}>
            Load more posts
          </Button>
        </div>
      )}
    </div>
  );
}
