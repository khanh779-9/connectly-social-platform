import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PostCard from '@/features/social/PostCard';
import {
  ensureProfiles,
  fetchBookmarks,
  getErrorMessage,
  removeBookmark,
  removeReaction,
  setReaction,
} from '@/lib/social';
import { viewerReactionFrom } from '@/lib/social';
import type { PostDto, ProfileDto } from '@/types/api';

export default function BookmarksPage() {
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [authors, setAuthors] = useState<Record<string, ProfileDto | null>>({});
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string | null>>({});

  async function load(cursor?: string) {
    setStatus('loading');
    setError(null);
    try {
      const page = await fetchBookmarks(cursor, 15);
      setPosts((prev) => {
        if (!cursor) return page.items;
        const newPosts = page.items.filter((p) => !prev.some((x) => x.id === p.id));
        return [...prev, ...newPosts];
      });
      setNextCursor(page.nextCursor ?? null);
      setReactions((prev) => {
        const next = { ...prev };
        page.items.forEach((post) => {
          if (post.viewerReaction) next[post.id] = post.viewerReaction;
        });
        return next;
      });
      const resolved = await ensureProfiles(page.items.map((post) => post.authorUserId));
      setAuthors((prev) => ({ ...prev, ...resolved }));
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  async function handleRemove(post: PostDto) {
    setPosts((prev) => prev.filter((item) => item.id !== post.id));
    try {
      await removeBookmark(post.id);
    } catch {
      setPosts((prev) => [post, ...prev]);
    }
  }

  return (
    <div className="mx-auto space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
          Saved posts
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {status === 'ready' && posts.length > 0
            ? `${posts.length} saved ${posts.length === 1 ? 'post' : 'posts'}, newest first.`
            : 'Posts you save are kept here so you can find them again.'}
        </p>
      </header>

      {status === 'loading' && posts.length === 0 && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Could not load your saved posts</p>
          <p className="mt-1">{error}</p>
          <Button variant="ghost" className="mt-4" onClick={() => load()}>
            Try again
          </Button>
        </Card>
      )}

      {status === 'ready' && posts.length === 0 && (
        <Card className="rounded border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing saved yet. Use “Save” on any post to keep it here.
        </Card>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          author={authors[post.authorUserId] ?? null}
          viewerReaction={viewerReactionFrom(reactions, post)}
          onReact={handleReact}
          bookmarked
          onToggleBookmark={handleRemove}
        />
      ))}

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => load(nextCursor ?? undefined)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
