import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<PostDto | null>(null);
  const [author, setAuthor] = useState<ProfileDto | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    if (!postId) return;
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

  async function handleReact(target: PostDto, type: string | null) {
    setMyReaction(type);
    try {
      if (type) await setReaction(target.id, type);
      else await removeReaction(target.id);
    } catch {
      setMyReaction(target.viewerReaction ?? null);
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

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === 'error' || !post) {
    return (
      <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Could not load this post</p>
        <p className="mt-1">{error}</p>
        <Button variant="ghost" className="mt-4" onClick={load}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the feed
      </Link>

      <PostCard
        post={post}
        author={author}
        viewerReaction={myReaction}
        onReact={handleReact}
        bookmarked={saved}
        onToggleBookmark={handleToggleBookmark}
      />
    </div>
  );
}
