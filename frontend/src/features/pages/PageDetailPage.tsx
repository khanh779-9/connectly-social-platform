import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PostCard from '@/features/social/PostCard';
import { useAppSelector } from '@/store/hooks';
import { avatarTone } from '@/lib/avatar';
import {
  createPost,
  ensureProfiles,
  fetchPage,
  fetchPageAdmins,
  fetchPagePosts,
  getErrorMessage,
  initials,
  removeReaction,
  setReaction,
  timeAgo,
} from '@/lib/social';
import { viewerReactionFrom } from '@/lib/social';
import type { PageAdminDto, PageDto, PostDto, ProfileDto } from '@/types/api';

export default function PageDetailPage() {
  const { pageId = '' } = useParams<{ pageId: string }>();
  const meId = useAppSelector((state) => state.auth.userId);

  const [page, setPage] = useState<PageDto | null>(null);
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [admins, setAdmins] = useState<PageAdminDto[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDto | null>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string | null>>({});

  const canPublish = ['owner', 'admin', 'editor'].includes(page?.viewerRole ?? '');

  async function load() {
    if (!pageId) return;
    setStatus('loading');
    setError(null);
    try {
      const info = await fetchPage(pageId);
      setPage(info);
      const [postPage, adminList] = await Promise.all([
        fetchPagePosts(pageId, undefined, 20),
        fetchPageAdmins(pageId),
      ]);
      setPosts(postPage.items);
      setAdmins(adminList);
      const resolved = await ensureProfiles([
        ...postPage.items.map((post) => post.authorUserId),
        ...adminList.map((admin) => admin.userId),
      ]);
      setProfiles((prev) => ({ ...prev, ...resolved }));
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, [pageId]);

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !page || posting) return;
    setPosting(true);
    try {
      const created = await createPost(content, [], 0, null, null, page.id);
      setPosts((prev) => [created, ...prev]);
      setDraft('');
      const resolved = await ensureProfiles([created.authorUserId]);
      setProfiles((prev) => ({ ...prev, ...resolved }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPosting(false);
    }
  }

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

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === 'error' || !page) {
    return (
      <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Could not load this page</p>
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
        to="/pages"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All pages
      </Link>

      <Card className="overflow-hidden rounded border border-border bg-card">
        <div className="h-24 bg-secondary" />
        <div className="px-4 pb-4">
          <span
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-md border-2 border-card bg-accent text-white"
            style={avatarTone(page.id)}
          >
            <Building2 className="h-6 w-6" />
          </span>
          <h1 className="mt-2 text-[20px] font-semibold leading-tight text-foreground">{page.name}</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {page.category ? `${page.category} · ` : ''}
            <span className="tnum">{page.postCount}</span> posts ·{' '}
            <span className="tnum">{page.adminCount}</span> admins
            {page.viewerRole && ` · you are ${page.viewerRole}`}
          </p>
          {page.description && (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
              {page.description}
            </p>
          )}
        </div>
      </Card>

      {canPublish && (
        <Card onSubmit={submitPost} className="rounded border border-border bg-card p-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            maxLength={5000}
            placeholder={`Publish on ${page.name}`}
            aria-label="Write a page post"
            className="w-full resize-none rounded border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={!draft.trim() || posting}>
              <Send className="h-3.5 w-3.5" />
              {posting ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </Card>
      )}

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      <div className="space-y-4">
        {posts.length === 0 ? (
          <Card className="rounded border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            No posts on this page yet.
          </Card>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={profiles[post.authorUserId] ?? null}
              viewerReaction={viewerReactionFrom(reactions, post)}
              onReact={handleReact}
              onProfilesResolved={(resolved) => setProfiles((prev) => ({ ...prev, ...resolved }))}
            />
          ))
        )}
      </div>

      <Card className="rounded border border-border bg-card">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">Admins</h2>
        <ul className="divide-y divide-border">
          {admins.map((admin) => {
            const profile = profiles[admin.userId];
            return (
              <li key={admin.userId} className="flex items-center gap-3 px-5 py-3">
                <Avatar className="h-9 w-9">
                  {profile?.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                  ) : null}
                  <AvatarFallback style={avatarTone(admin.userId)}>
                    {initials(profile?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/profile/${admin.userId}`}
                    className="block truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {profile?.displayName ?? 'User'}
                  </Link>
                  <p className="text-[12px] capitalize text-muted-foreground">
                    {admin.role} · since {timeAgo(admin.addedAt)}
                  </p>
                </div>
                {admin.userId === meId && <span className="text-[12px] text-accent">You</span>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
