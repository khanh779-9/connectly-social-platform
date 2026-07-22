import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Hash, Loader2, Search as SearchIcon, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VirtualizedFeed } from '@/components/ui/VirtualizedFeed';
import { avatarTone } from '@/lib/avatar';
import { getErrorMessage, initials, searchAll, timeAgo } from '@/lib/social';
import { cn } from '@/lib/utils';
import type { EventDto, GroupDto, PageDto, PostDto, ProfileDto } from '@/types/api';

type Tab = 'all' | 'people' | 'posts' | 'groups' | 'pages' | 'events' | 'hashtags';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'posts', label: 'Posts' },
  { key: 'groups', label: 'Groups' },
  { key: 'pages', label: 'Pages' },
  { key: 'events', label: 'Events' },
  { key: 'hashtags', label: 'Hashtags' },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q')?.trim() ?? '';
  const requestedTab = params.get('type');
  // An unknown ?type= would render no result block at all, so fall back to All.
  const tab: Tab = TABS.some((item) => item.key === requestedTab)
    ? (requestedTab as Tab)
    : 'all';

  const [draft, setDraft] = useState(query);
  const [users, setUsers] = useState<ProfileDto[]>([]);
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [pages, setPages] = useState<PageDto[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  // One request per query: the server filters people, posts, groups, pages, events and hashtags.
  useEffect(() => {
    if (query.length < 2) {
      setStatus('idle');
      setUsers([]);
      setPosts([]);
      setGroups([]);
      setPages([]);
      setEvents([]);
      setTags([]);
      return;
    }
    let cancelled = false;

    setStatus('loading');
    setError(null);
    searchAll(query, 30)
      .then((result) => {
        if (cancelled) return;
        setUsers(result.users ?? []);
        setPosts(result.posts ?? []);
        setGroups(result.groups ?? []);
        setPages(result.pages ?? []);
        setEvents(result.events ?? []);
        setTags(result.hashtags ?? []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (!next) return;
    setParams({ q: next, type: tab });
  }

  function selectTab(next: Tab) {
    setParams({ q: query, type: next });
  }

  const counts: Record<Tab, number | null> = {
    all: null,
    people: users.length,
    posts: posts.length,
    groups: groups.length,
    pages: pages.length,
    events: events.length,
    hashtags: tags.length,
  };

  const show = (key: Tab) => tab === 'all' || tab === key;

  // Stable identity: otherwise the virtualized list re-renders on every parent render.
  const renderPost = useCallback(
    (post: PostDto) => (
      <Link
        to={`/post/${post.id}`}
        className="block rounded px-3 py-2 transition-colors hover:bg-secondary"
      >
        <span className="line-clamp-2 text-[13px] text-foreground">
          {post.textContent?.trim() || 'Post with media'}
        </span>
        <span className="mt-0.5 block text-[12px] text-muted-foreground">
          {timeAgo(post.createdAt)} · {post.reactionCount} reactions ·{' '}
          {post.commentCount} comments
        </span>
      </Link>
    ),
    [],
  );
  const total =
    users.length + posts.length + groups.length + pages.length + events.length + tags.length;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Search</h1>
        <form onSubmit={submit} className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search people, posts, groups, pages and events"
            aria-label="Search"
            className="h-10 w-full rounded border border-border bg-card pl-10 pr-24 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            disabled={!draft.trim()}
          >
            Search
          </Button>
        </form>

        <nav className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => selectTab(item.key)}
                className={cn(
                  'border-b-2 px-3 py-2 text-[13px] transition-colors',
                  active
                    ? 'border-accent font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {counts[item.key] !== null && (
                  <span className="ml-1.5 text-[12px] text-muted-foreground tnum">
                    {counts[item.key]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {query.length < 2 && (
        <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Type at least two characters to search.
        </Card>
      )}

      {status === 'loading' && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Could not search: {error}
        </Card>
      )}

      {status === 'ready' && (
        <div className="space-y-4">
          {total === 0 && (
            <Card className="rounded border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </Card>
          )}

